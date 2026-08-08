// shared/content-package/checksums.ts
// Podcast Slice 3 — deterministic checksums and the Package fingerprint.
//
// `sha256Hex` is a compact, browser-safe SHA-256 implementation written
// for this pipeline. It is NOT a security control: the fingerprint is
// content identity for change detection (new / unchanged / changed /
// conflicting). The PocketBase hooks re-implement the exact same
// algorithm and fingerprint layout in `content_import_core.pb.js`; the
// smoke suite asserts CLI/server fingerprint parity for every fixture.
//
// The fingerprint is stable across machines: it depends only on the
// canonical manifest content and each asset's path, byte size and SHA-256
// — never on absolute paths, timestamps, directory ordering, usernames
// or machine metadata.

// --- Compact SHA-256 (FIPS 180-4) -----------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Compress(state: Uint32Array, block: Uint8Array): void {
  const w = new Uint32Array(64);
  for (let i = 0; i < 16; i++) {
    w[i] =
      (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3];
  }
  for (let i = 16; i < 64; i++) {
    const s0 =
      ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
      ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
      (w[i - 15] >>> 3);
    const s1 =
      ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
      ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
      (w[i - 2] >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + temp1) | 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) | 0;
  }
  state[0] = (state[0] + a) | 0;
  state[1] = (state[1] + b) | 0;
  state[2] = (state[2] + c) | 0;
  state[3] = (state[3] + d) | 0;
  state[4] = (state[4] + e) | 0;
  state[5] = (state[5] + f) | 0;
  state[6] = (state[6] + g) | 0;
  state[7] = (state[7] + h) | 0;
}

/** SHA-256 of a byte array, hex-encoded (lowercase). */
export function sha256Hex(bytes: Uint8Array): string {
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const len = bytes.length;
  const paddedLen = (((len + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[len] = 0x80;
  const bitLenHi = Math.floor(len / 0x20000000);
  const bitLenLo = len << 3;
  padded[paddedLen - 8] = (bitLenHi >>> 24) & 0xff;
  padded[paddedLen - 7] = (bitLenHi >>> 16) & 0xff;
  padded[paddedLen - 6] = (bitLenHi >>> 8) & 0xff;
  padded[paddedLen - 5] = bitLenHi & 0xff;
  padded[paddedLen - 4] = (bitLenLo >>> 24) & 0xff;
  padded[paddedLen - 3] = (bitLenLo >>> 16) & 0xff;
  padded[paddedLen - 2] = (bitLenLo >>> 8) & 0xff;
  padded[paddedLen - 1] = bitLenLo & 0xff;
  for (let off = 0; off < paddedLen; off += 64) {
    sha256Compress(state, padded.subarray(off, off + 64));
  }
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += state[i].toString(16).padStart(8, '0');
  }
  return out;
}

// --- Canonical manifest + package fingerprint -------------------------------

/**
 * Deterministic canonical form of the manifest object: JSON with sorted
 * object keys (stable across property ordering and whitespace). Arrays
 * keep declared order (Vocabulary order is editorial content).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

/**
 * Deterministic package fingerprint. Inputs:
 *   - canonical manifest content (canonicalJson of the parsed manifest);
 *   - every asset as `path` + `sizeBytes` + `sha256`, sorted by path.
 * The fingerprint is identical on any machine for identical content.
 */
export function packageFingerprint(
  manifestCanonical: string,
  assets: ReadonlyArray<{ path: string; sizeBytes: number; sha256: string }>,
): string {
  const sorted = [...assets].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const lines = sorted.map((a) => `${a.path}\u0000${a.sizeBytes}\u0000${a.sha256}`).join('\n');
  const input = `fep-episode-package-v1\n${manifestCanonical}\n${lines}`;
  return sha256Hex(new TextEncoder().encode(input));
}

/**
 * Deterministic plan-state hash: proves the authoritative server state a
 * plan was computed against. Only version-relevant facts are included:
 * the Episode's status/version, each Variant's status/version, the last
 * completed import fingerprint and the category's existence. Any import
 * that changes those facts invalidates an older plan.
 */
export function planStateHash(state: {
  contentKey: string;
  episode: { status: string; contentVersion: number; previousFingerprint: string } | null;
  variants: Record<string, { status: string; contentVersion: number }>;
  categoryExists: boolean;
}): string {
  const canonical = canonicalJson({
    contentKey: state.contentKey,
    episode: state.episode,
    variants: Object.keys(state.variants)
      .sort()
      .reduce<Record<string, { status: string; contentVersion: number }>>((acc, level) => {
        acc[level] = state.variants[level];
        return acc;
      }, {}),
    categoryExists: state.categoryExists,
  });
  return sha256Hex(new TextEncoder().encode(`fep-plan-state-v1\n${canonical}`));
}
