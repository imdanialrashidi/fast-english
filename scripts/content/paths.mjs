// scripts/content/paths.mjs
// Podcast Slice 3 — safe package-relative path resolution.
//
// Every asset path from the manifest is resolved against the package
// root and must satisfy BOTH structural rules (shared/content-package/
// constants.ts) and filesystem containment: the real (symlink-resolved)
// path must stay inside the real package root. A symlink inside the
// package that points outside is rejected.
//
// Browser-incompatible (node:fs) — never imported by the app surfaces.

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { isUnsafeAssetPath } from '../../shared/content-package/constants.ts';

/** Resolved, canonicalized package root (real path). */
export function packageRoot(pathArg) {
  const abs = resolve(pathArg);
  const root = realpathSync(abs);
  const st = lstatSync(root);
  if (!st.isDirectory()) {
    throw new Error(`Package path is not a directory: ${pathArg}`);
  }
  return root;
}

/**
 * Resolves a manifest asset path to a real file inside the package root.
 * Throws a ContentPackageError with a stable code when the path is
 * structurally unsafe, escapes the root, is a symlink pointing outside
 * the root, or does not exist.
 */
export function resolveAssetPath(root, assetPath, { mustExist = true } = {}) {
  if (isUnsafeAssetPath(assetPath)) {
    throw new ContentPackagePathError('PACKAGE_PATH_UNSAFE', assetPath);
  }
  const abs = join(root, assetPath);
  // Symlink escape: the real path of every component (including the file
  // itself) must stay inside the real package root.
  let realFile = null;
  try {
    realFile = realpathSync(abs);
  } catch (err) {
    if (!mustExist && err?.code === 'ENOENT') return null;
    throw new ContentPackagePathError('PACKAGE_PATH_UNRESOLVABLE', assetPath);
  }
  const rootWithSep = root.endsWith('/') ? root : `${root}/`;
  if (!realFile.startsWith(rootWithSep)) {
    throw new ContentPackagePathError('PACKAGE_PATH_ESCAPE', assetPath);
  }
  // Also verify the direct parent directory (in case the file itself is a
  // symlink target that resolves outside — realpathSync already covers it).
  const st = lstatSync(abs);
  if (!st.isFile()) {
    throw new ContentPackagePathError('PACKAGE_PATH_NOT_FILE', assetPath);
  }
  if (!mustExist) return realFile;
  return realFile;
}

/** Reads a package asset as a Buffer (bounded by the caller). */
export function readAssetBytes(root, assetPath, maxBytes) {
  const real = resolveAssetPath(root, assetPath);
  const st = lstatSync(real);
  if (st.size > maxBytes) {
    throw new ContentPackagePathError('PACKAGE_ASSET_TOO_LARGE', assetPath, st.size, maxBytes);
  }
  return readFileSync(real);
}

/** Reads a package text asset as UTF-8 (bounded). */
export function readAssetText(root, assetPath, maxBytes) {
  const real = resolveAssetPath(root, assetPath);
  const st = lstatSync(real);
  if (st.size > maxBytes) {
    throw new ContentPackagePathError('PACKAGE_ASSET_TOO_LARGE', assetPath, st.size, maxBytes);
  }
  return readFileSync(real, 'utf8');
}

/** Relative path of a real file inside the root (for diagnostics). */
export function relativeToRoot(root, realPath) {
  return relative(root, realPath);
}

export class ContentPackagePathError extends Error {
  constructor(code, path, size, limit) {
    super(`${code}: ${path}`);
    this.name = 'ContentPackagePathError';
    this.code = code;
    this.path = path;
    this.size = size;
    this.limit = limit;
  }
}

export { dirname };
