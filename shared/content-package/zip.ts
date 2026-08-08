// shared/content-package/zip.ts
// Podcast Slice 4 — bounded browser-side ZIP ingestion adapter for the
// Admin Content Studio.
//
// The pinned PocketBase 0.39.9 JSVM exposes no ZIP/inflate module
// (probed live), so the Admin UI parses the operator's package ZIP in
// the browser and feeds the EXACT Slice 3 internal representation
// (manifest + asset parts) to the existing Staff plan/execute routes.
// The server remains the security boundary: it re-validates every part
// (paths, sizes, signatures, durations, fingerprints, planStateHash).
//
// This adapter is transport convenience, never authority. It still
// enforces structural safety so a hostile ZIP cannot waste client
// memory or smuggle traversal/symlink entries into the pipeline:
//   - rejects path traversal, absolute/backslash/drive/UNC names;
//   - rejects symlink entries (unix mode bits);
//   - rejects unsupported compression methods (stored + deflate only);
//   - enforces entry count, per-entry and total uncompressed limits;
//   - deflate decompression uses the platform `DecompressionStream`
//     ('deflate-raw'); when unavailable a clear error is returned.
//
// Node (vitest/smoke) and evergreen browsers (Admin) both expose
// DecompressionStream; the fallback error keeps the failure honest.

export interface ZipEntry {
  /** Package-relative path as recorded in the ZIP. */
  path: string;
  bytes: Uint8Array;
  sizeBytes: number;
}

export interface ZipLimits {
  maxEntries: number;
  maxTotalUncompressedBytes: number;
  maxEntryBytes: number;
}

export const ZIP_LIMITS: ZipLimits = {
  // A Slice 3 package has at most ~20 assets; 64 is generous headroom.
  maxEntries: 64,
  // 60 MB total uncompressed cap (6 variants × ~10 MB audio worst case).
  maxTotalUncompressedBytes: 60 * 1024 * 1024,
  // Per-entry cap above the largest asset (10 MB audio) + slack.
  maxEntryBytes: 12 * 1024 * 1024,
};

export type ZipResult =
  | { ok: true; entries: ZipEntry[] }
  | { ok: false; code: string; message: string };

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const SYMLINK_MODE = 0xa000;

function u16(bytes: Uint8Array, off: number): number {
  return bytes[off] | (bytes[off + 1] << 8);
}

function u32(bytes: Uint8Array, off: number): number {
  return (
    (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
  );
}

/** Names are validated as ASCII package-relative paths; decode lossily. */
function decodeName(bytes: Uint8Array, start: number, len: number): string {
  const slice = bytes.slice(start, start + len);
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(slice);
  } catch {
    return Array.from(slice, (b) => String.fromCharCode(b)).join('');
  }
}

/** Structural path safety (mirror of isUnsafeAssetPath, ZIP-specific). */
function unsafeZipPath(name: string): boolean {
  if (!name || name.length > 200) return true;
  if (name.includes('\u0000')) return true;
  if (name.includes('\\')) return true;
  if (name.startsWith('/')) return true;
  if (/^[A-Za-z]:/.test(name)) return true;
  if (name.startsWith('//')) return true;
  const segments = name.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.' || seg === '') return true;
  }
  return !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name);
}

/** Basename of the last path segment. */
export function zipBasename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const DCS = (
    globalThis as {
      DecompressionStream?: new (
        f: string,
      ) => { readable: ReadableStream; writable: WritableStream };
    }
  ).DecompressionStream;
  if (typeof DCS !== 'function') {
    throw new ZipParseError(
      'ZIP_DEFLATE_UNSUPPORTED',
      'این مرورگر از باز کردن بسته فشرده پشتیبانی نمیکند.',
    );
  }
  const ds = new DCS('deflate-raw');
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  const writer = ds.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total > ZIP_LIMITS.maxEntryBytes) {
        await reader.cancel();
        throw new ZipParseError('ZIP_ENTRY_TOO_LARGE', 'یک فایل داخل بسته از حد مجاز بزرگتر است.');
      }
    }
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

class ZipParseError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ZipParseError';
    this.code = code;
  }
}

/**
 * Parses a ZIP archive into bounded entries. Stored (0) and deflate (8)
 * methods are supported; everything else is rejected.
 */
export async function parseZip(
  bytes: Uint8Array,
  limits: ZipLimits = ZIP_LIMITS,
): Promise<ZipResult> {
  try {
    const entries = await doParse(bytes, limits);
    return { ok: true, entries };
  } catch (err) {
    if (err instanceof ZipParseError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'ZIP_INVALID', message: 'بسته فشرده معتبر نیست.' };
  }
}

async function doParse(bytes: Uint8Array, limits: ZipLimits): Promise<ZipEntry[]> {
  const n = bytes.length;
  if (n < 22) throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');

  // 1. End-of-central-directory record (scan the last 64 KB + 22 bytes).
  let eocd = -1;
  const scanStart = Math.max(0, n - 65557);
  for (let i = n - 22; i >= scanStart; i--) {
    if (u32(bytes, i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');
  const cdOffset = u32(bytes, eocd + 16);
  const cdSize = u32(bytes, eocd + 12);
  const entryCount = u16(bytes, eocd + 10);
  if (entryCount > limits.maxEntries) {
    throw new ZipParseError(
      'ZIP_TOO_MANY_ENTRIES',
      'تعداد فایلهای داخل بسته از حد مجاز بیشتر است.',
    );
  }
  if (cdOffset + cdSize > n || cdSize < entryCount * 46) {
    throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');
  }

  // 2. Central directory: collect file entries with safety checks.
  interface CdEntry {
    name: string;
    method: number;
    compressedSize: number;
    uncompressedSize: number;
    localOffset: number;
    isSymlink: boolean;
  }
  const central: CdEntry[] = [];
  let pos = cdOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < entryCount; i++) {
    if (pos + 46 > n || u32(bytes, pos) !== CD_SIG) {
      throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');
    }
    const method = u16(bytes, pos + 10);
    const compressedSize = u32(bytes, pos + 20);
    const uncompressedSize = u32(bytes, pos + 24);
    const nameLen = u16(bytes, pos + 28);
    const extraLen = u16(bytes, pos + 30);
    const commentLen = u16(bytes, pos + 32);
    const externalAttrs = u32(bytes, pos + 38);
    const localOffset = u32(bytes, pos + 42);
    const name = decodeName(bytes, pos + 46, nameLen);
    if (pos + 46 + nameLen + extraLen + commentLen > n) {
      throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');
    }
    pos += 46 + nameLen + extraLen + commentLen;

    const unixMode = (externalAttrs >>> 16) & 0xffff;
    const isSymlink = (unixMode & 0xf000) === SYMLINK_MODE;
    if (name.endsWith('/')) continue; // directory entry
    if (isSymlink) {
      throw new ZipParseError(
        'ZIP_SYMLINK_REJECTED',
        'بسته فشرده شامل پیوند (symlink) است و پذیرفته نمیشود.',
      );
    }
    if (unsafeZipPath(name)) {
      throw new ZipParseError('ZIP_ENTRY_UNSAFE_PATH', 'نام یک فایل داخل بسته ناامن است: ' + name);
    }
    if (method !== 0 && method !== 8) {
      throw new ZipParseError(
        'ZIP_UNSUPPORTED_METHOD',
        'بسته فشرده از روش فشردهسازی پشتیبانینشده استفاده میکند.',
      );
    }
    if (uncompressedSize > limits.maxEntryBytes) {
      throw new ZipParseError('ZIP_ENTRY_TOO_LARGE', 'یک فایل داخل بسته از حد مجاز بزرگتر است.');
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxTotalUncompressedBytes) {
      throw new ZipParseError('ZIP_TOTAL_TOO_LARGE', 'حجم کل محتوای بسته از حد مجاز بیشتر است.');
    }
    central.push({ name, method, compressedSize, uncompressedSize, localOffset, isSymlink });
  }

  // 3. Read + decompress each entry's data via its local header.
  const out: ZipEntry[] = [];
  for (const entry of central) {
    const lo = entry.localOffset;
    if (lo + 30 > n || u32(bytes, lo) !== LOCAL_SIG) {
      throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');
    }
    const nameLen = u16(bytes, lo + 26);
    const extraLen = u16(bytes, lo + 28);
    const dataStart = lo + 30 + nameLen + extraLen;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > n) throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');
    const compressed = bytes.slice(dataStart, dataEnd);
    let data: Uint8Array;
    if (entry.method === 0) {
      data = compressed;
    } else {
      data = await inflateRaw(compressed);
    }
    if (data.byteLength !== entry.uncompressedSize) {
      throw new ZipParseError('ZIP_INVALID', 'بسته فشرده معتبر نیست.');
    }
    out.push({ path: entry.name, bytes: data, sizeBytes: data.byteLength });
  }
  return out;
}
