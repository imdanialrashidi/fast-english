// @ts-nocheck
// shared/content-package/zip-export.ts
// Draft — inverse of zip.ts for export round-trip (spike 036).
// Reuses checksums.ts/versioning.ts helpers from import for export checksum.

import { sha256Hex } from './checksums';

export interface ExportManifest {
  contentKey: string;
  version: number;
  files: { path: string; checksum: string }[];
}

export async function buildExportZip(
  contentKey: string,
  version: number,
  assets: { path: string; bytes: Uint8Array }[],
): Promise<Uint8Array> {
  // Draft: canonical manifest + per-asset SHA256 + ZIP stream via CompressionStream
  // Reuse DecompressionStream inverse (CompressionStream when available)
  const manifest: ExportManifest = {
    contentKey,
    version,
    files: assets.map((a) => ({ path: a.path, checksum: sha256Hex(a.bytes) })),
  };
  // TODO: serialize manifest + assets into ZIP with 64-entry/60MB limits
  return new Uint8Array([]);
}
