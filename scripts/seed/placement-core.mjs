// scripts/seed/placement-core.mjs
// Business Configuration slice — pure validation + record planning for the
// placement-bank seeding tool. No network, no IO beyond the dataset file.
// Kept free of CLI/auth code so tests can exercise every guard
// deterministically (tests/placement-seed.test.mjs).

export const DEMO_KINDS = ['demo', 'reviewed'];

export class SeedError extends Error {
  constructor(message, { exitCode = 1 } = {}) {
    super(message);
    this.name = 'SeedError';
    this.exitCode = exitCode;
  }
}

/**
 * Validate a placement-bank dataset against the collection contract.
 * Returns { ok: true, errors: [] } or { ok: false, errors: [string...] }.
 * Every error is a human-readable sentence; no exception is thrown for
 * invalid data.
 */
export function validateDataset(dataset) {
  const errors = [];
  if (!dataset || typeof dataset !== 'object') {
    return { ok: false, errors: ['Dataset is not a JSON object.'] };
  }
  if (dataset.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1, got ${JSON.stringify(dataset.schemaVersion)}.`);
  }
  if (!DEMO_KINDS.includes(dataset.kind)) {
    errors.push(
      `kind must be one of ${DEMO_KINDS.join('/')}, got ${JSON.stringify(dataset.kind)}.`,
    );
  }
  if (!Number.isInteger(dataset.version) || dataset.version < 1) {
    errors.push('version must be a positive integer.');
  }
  const questions = Array.isArray(dataset.questions) ? dataset.questions : [];
  if (questions.length !== 20) {
    errors.push(`Expected exactly 20 questions, got ${questions.length}.`);
  }

  const seenPositions = new Set();
  const seenKeys = new Set();
  questions.forEach((q, idx) => {
    const where = `question ${idx + 1}`;
    if (!q || typeof q !== 'object') {
      errors.push(`${where} is not an object.`);
      return;
    }
    if (
      typeof q.question_key !== 'string' ||
      !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(q.question_key)
    ) {
      errors.push(`${where}: question_key must match ^[a-z0-9][a-z0-9._-]{0,119}$.`);
    } else if (seenKeys.has(q.question_key)) {
      errors.push(`${where}: duplicate question_key ${q.question_key}.`);
    } else {
      seenKeys.add(q.question_key);
    }
    if (!Number.isInteger(q.position) || q.position < 1 || q.position > 20) {
      errors.push(`${where}: position must be an integer 1-20.`);
    } else if (seenPositions.has(q.position)) {
      errors.push(`${where}: duplicate position ${q.position}.`);
    } else {
      seenPositions.add(q.position);
    }
    if (typeof q.prompt !== 'string' || q.prompt.trim().length === 0 || q.prompt.length > 500) {
      errors.push(`${where}: prompt must be 1-500 characters.`);
    }
    const opts = Array.isArray(q.options) ? q.options : [];
    if (opts.length !== 4) {
      errors.push(`${where}: expected exactly 4 options, got ${opts.length}.`);
    }
    const optIds = new Set();
    opts.forEach((o, oi) => {
      if (
        !o ||
        typeof o !== 'object' ||
        typeof o.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,20}$/.test(o.id)
      ) {
        errors.push(`${where}: option ${oi + 1} id must match ^[a-zA-Z0-9_-]{1,20}$.`);
        return;
      }
      if (optIds.has(o.id)) errors.push(`${where}: duplicate option id ${o.id}.`);
      optIds.add(o.id);
      if (typeof o.text !== 'string' || o.text.trim().length === 0 || o.text.length > 300) {
        errors.push(`${where}: option ${o.id} text must be 1-300 characters.`);
      }
    });
    if (typeof q.correct_option_id !== 'string' || !optIds.has(q.correct_option_id)) {
      errors.push(`${where}: correct_option_id must reference one of the option ids.`);
    }
  });

  if (errors.length === 0) return { ok: true, errors };
  return { ok: false, errors };
}

/**
 * Build the exact record payloads the seed CLI will POST. The server
 * reads options from the `options_text` Text field (migration
 * 1700000009); both `options` (JSON) and `options_text` are written so
 * legacy reads and the real route agree.
 */
export function buildQuestionRecords(dataset) {
  return dataset.questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      question_key: q.question_key,
      version: dataset.version,
      position: q.position,
      prompt: q.prompt.trim(),
      options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
      options_text: JSON.stringify(q.options.map((o) => ({ id: o.id, text: o.text.trim() }))),
      correct_option_id: q.correct_option_id,
      is_active: true,
    }));
}

/** True when the dataset is explicitly marked as demo (not reviewed). */
export function isDemoDataset(dataset) {
  return dataset && dataset.kind === 'demo';
}

/**
 * Resolve the target intent. Returns { target } or throws SeedError.
 * - explicit --target wins, but it is CROSS-VALIDATED against the URL
 *   hostname so a mislabelled target can never downgrade the guards:
 *     local      -> must be a loopback hostname;
 *     production -> must be a non-loopback hostname;
 *     staging    -> either (explicit operator staging intent).
 * - loopback base URL without a target defaults to "local" ONLY for
 *   interactive runs; non-interactive (`--yes`) callers must declare
 *   --target explicitly (see requireExplicitTargetForYes).
 * - any non-loopback URL without an explicit target is refused.
 */
export function resolveTarget({ baseUrl, explicitTarget }) {
  const url = String(baseUrl || '').replace(/\/+$/, '');
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new SeedError(`Invalid FEP_PB_URL: ${url}`, { exitCode: 2 });
  }
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (explicitTarget) {
    if (!['local', 'staging', 'production'].includes(explicitTarget)) {
      throw new SeedError(`--target must be local|staging|production, got ${explicitTarget}`, {
        exitCode: 2,
      });
    }
    if (explicitTarget === 'local' && !loopback) {
      throw new SeedError(
        `--target=local with a non-loopback PocketBase (${url}) is refused: ` +
          'the production host would only get "local" guards. Use --target=staging or --target=production.',
        { exitCode: 2 },
      );
    }
    if (explicitTarget === 'production' && loopback) {
      throw new SeedError(
        `--target=production with a loopback PocketBase (${url}) is refused: ` +
          'production intent must point at a real host.',
        { exitCode: 2 },
      );
    }
    return { target: explicitTarget, hostname };
  }
  if (loopback) return { target: 'local', hostname };
  throw new SeedError(
    `Target looks like a non-local PocketBase (${url}). Pass --target=staging or --target=production (with --confirm-production) explicitly.`,
    { exitCode: 2 },
  );
}

/**
 * Non-interactive seeding (`--yes`) must always declare the target
 * explicitly: a loopback URL is ALSO how an SSH-tunnelled production
 * PocketBase appears, so silently defaulting to "local" would let
 * `--yes` skip the production guards.
 */
export function requireExplicitTargetForYes({ yes, explicitTarget }) {
  if (yes && !explicitTarget) {
    throw new SeedError(
      'Non-interactive seeding (--yes) requires an explicit --target (local|staging|production). ' +
        'This also protects SSH-tunnelled production instances, which look like loopback URLs.',
      { exitCode: 2 },
    );
  }
}

/**
 * Apply the promotion guards for a placement-bank import.
 * Throws SeedError when intent is insufficient.
 */
export function enforcePlacementGuards({
  dataset,
  target,
  confirmProduction,
  allowDemo,
  replace,
  hasActiveQuestions,
}) {
  if (!confirmProduction && target === 'production') {
    throw new SeedError(
      'Production target requires --confirm-production (explicit operator intent).',
      { exitCode: 2 },
    );
  }
  if (isDemoDataset(dataset) && target === 'production' && !allowDemo) {
    throw new SeedError(
      'The dataset is marked kind=demo. Demo data must never be promoted to production; ' +
        'pass --allow-demo ONLY if you explicitly accept installing demo questions into a production target.',
      { exitCode: 2 },
    );
  }
  if (isDemoDataset(dataset) && target === 'production' && allowDemo) {
    console.warn(
      'WARNING: installing a kind=demo placement bank into a production target. ' +
        'The final reviewed bank remains HUMAN INPUT REQUIRED before live launch.',
    );
  }
  if (hasActiveQuestions && !replace) {
    throw new SeedError(
      'An active placement bank already exists. Pass --replace to deactivate the current active set before installing the new bank.',
      { exitCode: 2 },
    );
  }
}

/** Same intent guards for the plans seed (no demo concept; still explicit). */
export function enforcePlansGuards({ target, confirmProduction }) {
  if (target === 'production' && !confirmProduction) {
    throw new SeedError(
      'Production target requires --confirm-production (explicit operator intent).',
      { exitCode: 2 },
    );
  }
}
