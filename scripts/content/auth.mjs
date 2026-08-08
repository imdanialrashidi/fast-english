// scripts/content/auth.mjs
// Podcast Slice 3 — Staff-authenticated CLI transport.
//
// The CLI authenticates as `staff_admins` with the documented environment
// variables (FEP_PB_URL, FEP_STAFF_EMAIL, FEP_STAFF_PASSWORD). It never
// prints passwords or tokens, never accepts superuser credentials, and
// reports auth failures with safe messages. `--local-test` is an explicit
// disposable-test mode that never weakens Production authentication
// (it only swaps the default base URL to a loopback PocketBase).

/** Safe CLI error carrying a stable exit code. */
export class CliError extends Error {
  constructor(message, { exitCode = 1 } = {}) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export function resolveBaseUrl({ localTest = false } = {}) {
  const envUrl = process.env.FEP_PB_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (localTest) return 'http://127.0.0.1:8090';
  throw new CliError(
    'FEP_PB_URL is not set. Export FEP_PB_URL, FEP_STAFF_EMAIL and FEP_STAFF_PASSWORD (e.g. FEP_PB_URL=http://127.0.0.1:8090).',
    { exitCode: 2 },
  );
}

/** Authenticates as an active Staff Administrator; returns the token. */
export async function staffLogin(baseUrl) {
  const email = process.env.FEP_STAFF_EMAIL;
  const password = process.env.FEP_STAFF_PASSWORD;
  if (!email || !password) {
    throw new CliError(
      'FEP_STAFF_EMAIL and FEP_STAFF_PASSWORD are required for content:plan and content:import.',
      { exitCode: 2 },
    );
  }
  let res;
  try {
    res = await fetch(`${baseUrl}/api/collections/staff_admins/auth-with-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new CliError(`Could not reach PocketBase at ${baseUrl}: ${err?.message}`, {
      exitCode: 2,
    });
  }
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200 || !body?.token) {
    const code = body?.data?.code ?? body?.code ?? '';
    if (code === 'staff_inactive') {
      throw new CliError('Staff authentication failed: the account is inactive or unverified.');
    }
    if (res.status === 403) {
      throw new CliError(
        'Staff authentication failed: this identity is not an active Staff Administrator.',
      );
    }
    throw new CliError(
      'Staff authentication failed. Check FEP_STAFF_EMAIL and FEP_STAFF_PASSWORD.',
    );
  }
  return body.token;
}

/** Multipart body builder: string fields first, then assets (sorted). */
export function buildMultipart(manifestText, assets) {
  const boundary = `----FepContentImport${Date.now().toString(36)}`;
  const parts = [];
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${manifestText}\r\n`,
    ),
  );
  for (const asset of [...assets].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${asset.path}"; filename="${asset.path.split('/').pop()}"\r\nContent-Type: ${asset.mimeType}\r\n\r\n`,
      ),
    );
    parts.push(asset.bytes);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

/** JSON request to a staff route with the staff token. */
export async function staffJson(baseUrl, token, path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** Multipart request to the execute route. */
export async function staffMultipart(baseUrl, token, path, boundary, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, body: parsed };
}

/**
 * Requests the authoritative plan. Returns the server plan (which
 * includes planStateHash); throws CliError on blocking responses.
 */
export async function requestPlan(baseUrl, token, pkg) {
  const payload = {
    manifest: pkg.manifestText,
    assets: pkg.assets.map((a) => ({ path: a.path, sizeBytes: a.sizeBytes, sha256: a.sha256 })),
    fingerprint: pkg.fingerprint,
  };
  const res = await staffJson(
    baseUrl,
    token,
    '/api/fast-english/staff/content-import/plan',
    payload,
  );
  if (res.status === 401 || res.status === 403) {
    throw new CliError('Plan rejected: this identity is not an active Staff Administrator.');
  }
  if (res.status !== 200) {
    const code = res.body?.code ?? 'plan_failed';
    const message = res.body?.message ?? 'The server rejected the plan request.';
    throw new CliError(`${code}: ${message}`);
  }
  return res.body;
}

/**
 * Executes the import. Returns the server result; throws CliError on
 * blocking responses (conflicts, stale plans, validation failures).
 */
export async function executeImport(baseUrl, token, root, pkg, planStateHashValue) {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const assets = pkg.assets.map((a) => ({
    path: a.path,
    mimeType: a.mimeType,
    bytes: readFileSync(join(root, a.path)),
  }));
  const { boundary, body } = buildMultipart(pkg.manifestText, assets);
  const res = await staffMultipart(
    baseUrl,
    token,
    `/api/fast-english/staff/content-import/execute?planStateHash=${encodeURIComponent(planStateHashValue)}`,
    boundary,
    body,
  );
  if (res.status === 401 || res.status === 403) {
    throw new CliError('Import rejected: this identity is not an active Staff Administrator.');
  }
  if (res.status !== 200) {
    const code = res.body?.code ?? 'import_failed';
    const message = res.body?.message ?? 'The server rejected the import.';
    const detail = res.body?.errorJson ? ` ${res.body.errorJson}` : '';
    throw new CliError(`${code}: ${message}${detail}`);
  }
  return res.body;
}
