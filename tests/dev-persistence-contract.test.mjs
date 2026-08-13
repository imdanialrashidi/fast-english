import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

// The observed defect: local development used a disposable PocketBase data
// directory (mktemp) that was deleted on exit, so Student accounts created
// in one session silently vanished after a PocketBase restart. The fix makes
// the dev PocketBase persistent by default (server/pb_data) with disposable
// mode as an explicit opt-in, and the production deployment contract keeps
// pb_data outside the immutable release tree. These assertions fail on the
// pre-fix contract so the persistence guarantee cannot silently regress.

test('local dev PocketBase is persistent by default (server/pb_data)', () => {
  const dev = fs.readFileSync(path.join(repositoryRoot, 'scripts/dev.sh'), 'utf8');
  // The default data dir must be the repository's persistent pb_data.
  assert.ok(
    dev.includes('${PB_DATA_DIR:-$REPO_ROOT/server/pb_data}'),
    'dev.sh must default to server/pb_data',
  );
  // Disposable data must be an explicit opt-in, never the default.
  assert.ok(dev.includes('PB_DEV_EPHEMERAL'), 'dev.sh must expose an explicit ephemeral flag');
  assert.ok(dev.includes('EPHEMERAL=0'), 'dev.sh must default to non-ephemeral');
  // Cleanup must only remove the ephemeral directory, never the persistent one.
  assert.ok(dev.includes('rm -rf "$DATA_DIR"'), 'cleanup keeps an rm for the ephemeral branch');
  assert.ok(dev.includes('[[ "$EPHEMERAL" -eq 1 ]]'), 'cleanup must only remove ephemeral dirs');
  // The disposable dir is allowed ONLY inside the explicit ephemeral branch.
  const guardIdx = dev.indexOf('${PB_DEV_EPHEMERAL:-0}');
  const mktempIdx = dev.indexOf('mktemp -d -t pb-dev');
  assert.ok(mktempIdx >= 0, 'ephemeral mode keeps its disposable dir');
  assert.ok(guardIdx >= 0 && mktempIdx > guardIdx, 'mktemp must be guarded by the ephemeral flag');
});

test('production PocketBase storage is a dedicated persistent path outside releases', () => {
  const unit = fs.readFileSync(
    path.join(repositoryRoot, 'deploy/systemd/fast-english-pocketbase.service'),
    'utf8',
  );
  const install = fs.readFileSync(path.join(repositoryRoot, 'deploy/install.sh'), 'utf8');
  const deploy = fs.readFileSync(path.join(repositoryRoot, 'deploy/deploy.sh'), 'utf8');

  // The service must point at the shared persistent volume, never a release
  // directory or a temporary path.
  assert.ok(unit.includes('--dir=/opt/fast-english/shared/pb_data'));
  assert.ok(unit.includes('ReadWritePaths=/opt/fast-english/shared/pb_data'));
  // The bootstrap must create the persistent data directory.
  assert.ok(install.includes('shared/pb_data'));
  // deploy.sh restarts the service but must never replace or delete pb_data.
  assert.ok(!/rm -rf[^\n]*pb_data/.test(deploy), 'deploy.sh must never rm pb_data');
  assert.ok(deploy.includes('$CURRENT.tmp'), 'deploy.sh flips the release symlink');
  assert.ok(!deploy.includes('pb_data'), 'deploy.sh must never touch pb_data');
});

test('restart/redeploy documentation states the persistent storage requirement', () => {
  const deployment = fs.readFileSync(path.join(repositoryRoot, 'docs/DEPLOYMENT.md'), 'utf8');
  assert.ok(
    /pb_data never lives\s*inside a release/.test(deployment) ||
      /pb_data[^\n]*outside releases/.test(deployment),
    'pb_data must be documented outside releases',
  );
  assert.ok(
    /pb_data\/\s+PocketBase data \(DB, storage, local backups\)/.test(deployment),
    'pb_data table row must document the persistent data directory',
  );
  assert.ok(
    deployment.includes('`pb_data` is untouched by a rollback.'),
    'rollback must never touch pb_data',
  );
});
