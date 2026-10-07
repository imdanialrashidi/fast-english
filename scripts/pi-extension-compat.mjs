#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const source = 'npm:pi-lsp-adapter@0.1.3';
const hostDependencies = { '@earendil-works/pi-tui': '^0.74.1', typebox: '^1.1.38' };

// Temporary packaging correction for the reviewed upstream 0.1.3 release.
// Pi's loader supplies these modules; LSP source and registry pins stay intact.
export function repairLspPackage(projectRoot, { installMissing = false, checkOnly = false } = {}) {
  const settingsPath = path.join(projectRoot, '.pi/settings.json');
  if (!fs.existsSync(settingsPath)) return false;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (
    !(settings.packages ?? []).some(
      (entry) => (typeof entry === 'string' ? entry : entry.source) === source,
    )
  )
    return false;

  const cacheRoot = path.join(fs.realpathSync(projectRoot), '.pi/npm');
  if (fs.existsSync(cacheRoot) && fs.realpathSync(cacheRoot) !== cacheRoot) {
    throw new Error(
      'Pi cache resolves outside its expected project location; no package was installed or changed.',
    );
  }
  const manifestPath = path.join(cacheRoot, 'node_modules/pi-lsp-adapter/package.json');
  if (!fs.existsSync(manifestPath)) {
    if (!installMissing) return false;
    // Use Pi's own project installer rather than touching the product's npm tree.
    const output = execFileSync('pi', ['install', '--local', '--approve', source], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    process.stderr.write(output);
  }
  if (!fs.realpathSync(manifestPath).startsWith(`${cacheRoot}${path.sep}`)) {
    throw new Error(
      "LSP package resolves outside this project's Pi cache; no manifest was changed.",
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.name !== 'pi-lsp-adapter' || manifest.version !== '0.1.3') {
    throw new Error(
      'Expected pi-lsp-adapter 0.1.3. Run ./p install --local --approve npm:pi-lsp-adapter@0.1.3, then retry.',
    );
  }
  let changed = false;
  for (const [name, range] of Object.entries(hostDependencies)) {
    if (manifest.dependencies?.[name] === undefined) continue;
    if (manifest.dependencies[name] !== range)
      throw new Error(`Unexpected upstream dependency ${name}; no manifest was changed.`);
    delete manifest.dependencies[name];
    manifest.peerDependencies ??= {};
    manifest.peerDependencies[name] = '*';
    manifest.peerDependenciesMeta ??= {};
    manifest.peerDependenciesMeta[name] = {
      ...manifest.peerDependenciesMeta[name],
      optional: true,
    };
    changed = true;
  }
  if (!changed) return false;
  if (checkOnly)
    throw new Error(
      'LSP has duplicate host dependency declarations. Run node scripts/pi-extension-compat.mjs or start ./p.',
    );
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: fs.statSync(manifestPath).mode & 0o777,
    });
    fs.renameSync(temporaryPath, manifestPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.slice(2).some((arg) => !['--install-missing', '--check'].includes(arg)))
      throw new Error('Usage: node scripts/pi-extension-compat.mjs [--install-missing | --check]');
    if (process.argv.includes('--check') && process.argv.includes('--install-missing'))
      throw new Error('--check cannot install packages.');
    if (
      repairLspPackage(process.cwd(), {
        installMissing: process.argv.includes('--install-missing'),
        checkOnly: process.argv.includes('--check'),
      })
    ) {
      process.stderr.write('Pi: corrected pi-lsp-adapter 0.1.3 host dependency declarations.\n');
    }
  } catch (error) {
    process.stderr.write(`Pi extension compatibility: ${error.message}\n`);
    process.exitCode = 1;
  }
}
