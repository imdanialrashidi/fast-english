import crypto from 'node:crypto';
import path from 'node:path';

export function isolatedGitEnvironment(workspace, inherited = process.env) {
  // A nested disposable copy must not discover its source .git, nor inherit
  // an explicit GIT_DIR/work-tree/config/index redirect into another checkout.
  const environment = Object.fromEntries(
    Object.entries(inherited).filter(([key]) => !key.startsWith('GIT_')),
  );
  return {
    ...environment,
    GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(workspace)),
    GIT_DISCOVERY_ACROSS_FILESYSTEM: '0',
    GIT_TERMINAL_PROMPT: '0',
  };
}

const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function benchmarkInputSnapshot(manifest, treatmentPaths) {
  if (
    !Array.isArray(treatmentPaths) ||
    treatmentPaths.some(
      (value) =>
        typeof value !== 'string' || value.startsWith('/') || value.split('/').includes('..'),
    )
  )
    throw new Error('Invalid declared harness-treatment paths');
  const paths = [...new Set(treatmentPaths)].sort();
  // Only this deliberate native-config subtree uses a wildcard. Every other
  // treatment path is exact, keeping future product files immutable by default.
  if (paths.some((value) => value.includes('*') && value !== '.omp/**'))
    throw new Error('Overbroad harness-treatment wildcard');
  const ordered = [...manifest.entries()].sort(([a], [b]) => a.localeCompare(b));
  const inputs = ordered.filter(
    ([file]) => !paths.includes(file) && !(paths.includes('.omp/**') && file.startsWith('.omp/')),
  );
  return {
    inputContractFingerprint: digest(paths),
    inputFingerprint: digest(inputs),
    inputFiles: inputs.length,
    fileManifest: Object.fromEntries(ordered),
  };
}
