import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { repairLspPackage } from '../scripts/pi-extension-compat.mjs';

function fixture(t, version = '0.1.3') {
  fs.mkdirSync(path.join(import.meta.dirname, '../.artifacts'), { recursive: true });
  const root = fs.mkdtempSync(path.join(import.meta.dirname, '../.artifacts/lsp-compat-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifestPath = path.join(root, '.pi/npm/node_modules/pi-lsp-adapter/package.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const settingsPath = path.join(root, '.pi/settings.json');
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ packages: ['npm:pi-lsp-adapter@0.1.3'], theme: 'custom' }),
  );
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      name: 'pi-lsp-adapter',
      version,
      pi: { extensions: ['./src/index.ts'] },
      dependencies: {
        '@earendil-works/pi-tui': '^0.74.1',
        typebox: '^1.1.38',
        'vscode-uri': '^3.0.8',
      },
      peerDependencies: { '@earendil-works/pi-ai': '*' },
    }),
  );
  return { root, manifestPath, settingsPath };
}

test('known LSP packaging is corrected once without changing product settings or extension code', (t) => {
  const { root, manifestPath, settingsPath } = fixture(t);
  const sourcePath = path.join(path.dirname(manifestPath), 'src/index.ts');
  fs.mkdirSync(path.dirname(sourcePath));
  fs.writeFileSync(sourcePath, '// upstream source is preserved\n');
  fs.chmodSync(manifestPath, 0o640);
  const settingsBefore = fs.readFileSync(settingsPath);
  assert.throws(() => repairLspPackage(root, { checkOnly: true }), /duplicate host/);
  assert.equal(repairLspPackage(root), true);
  const repaired = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(repaired);
  assert.deepEqual(manifest.dependencies, { 'vscode-uri': '^3.0.8' });
  assert.deepEqual(manifest.peerDependencies, {
    '@earendil-works/pi-ai': '*',
    '@earendil-works/pi-tui': '*',
    typebox: '*',
  });
  assert.equal(manifest.peerDependenciesMeta.typebox.optional, true);
  assert.equal(manifest.peerDependenciesMeta['@earendil-works/pi-tui'].optional, true);
  assert.deepEqual(manifest.pi.extensions, ['./src/index.ts']);
  assert.equal(fs.statSync(manifestPath).mode & 0o777, 0o640);
  assert.deepEqual(fs.readFileSync(settingsPath), settingsBefore);
  assert.equal(fs.readFileSync(sourcePath, 'utf8'), '// upstream source is preserved\n');
  assert.equal(repairLspPackage(root), false);
  assert.equal(repairLspPackage(root, { checkOnly: true }), false);
  assert.deepEqual(fs.readFileSync(manifestPath), repaired);
});

test('unknown installed releases and dependency drift remain unchanged', (t) => {
  const { root, manifestPath } = fixture(t, '0.2.0');
  const original = fs.readFileSync(manifestPath);
  assert.throws(() => repairLspPackage(root), /Expected pi-lsp-adapter/);
  assert.deepEqual(fs.readFileSync(manifestPath), original);
  const drift = JSON.parse(original);
  drift.version = '0.1.3';
  drift.dependencies.typebox = '^2.0.0';
  fs.writeFileSync(manifestPath, JSON.stringify(drift));
  const before = fs.readFileSync(manifestPath);
  assert.throws(() => repairLspPackage(root), /Unexpected upstream dependency/);
  assert.deepEqual(fs.readFileSync(manifestPath), before);
});

test('removing or upgrading LSP retires this compatibility fix; absent cache checks do not install', (t) => {
  const { root, manifestPath, settingsPath } = fixture(t);
  fs.writeFileSync(settingsPath, JSON.stringify({ packages: ['npm:pi-lsp-adapter@0.2.0'] }));
  const original = fs.readFileSync(manifestPath);
  assert.equal(repairLspPackage(root), false);
  assert.deepEqual(fs.readFileSync(manifestPath), original);
  fs.writeFileSync(settingsPath, JSON.stringify({ packages: ['npm:pi-lsp-adapter@0.1.3'] }));
  fs.unlinkSync(manifestPath);
  assert.equal(repairLspPackage(root, { checkOnly: true }), false);
  assert.equal(fs.existsSync(manifestPath), false);
  fs.writeFileSync(manifestPath, original);
  const externalCache = path.join(root, 'external-cache');
  fs.renameSync(path.join(root, '.pi/npm'), externalCache);
  fs.symlinkSync(externalCache, path.join(root, '.pi/npm'), 'dir');
  assert.throws(
    () => repairLspPackage(root, { installMissing: true }),
    /Pi cache resolves outside/,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(externalCache, 'node_modules/pi-lsp-adapter/package.json')),
    original,
  );
});
