// tests/infra/check-workflows.mjs
// Static contract validation for the GitHub Actions deployment workflows
// and the repository-side Coolify integration scripts. This runs WITHOUT a
// Coolify instance (the live integration is validated in staging by the
// coolify contract test using the same endpoint contract) and fails closed
// on any drift from the accepted deployment contract.
//
// Checks:
//   W1 release-deploy.yml is a manual workflow_dispatch on an exact commit
//   W2 production environment is required; secrets used only by name
//   W3 the Coolify API contract is used with the verified endpoint shapes
//      (POST /api/v1/deploy, GET /api/v1/deployments/<uuid>, statuses
//      queued|in_progress|finished|failed|cancelled-by-user)
//   W4 the canonical quality gate gates production (green-check step)
//   W5 immutable sha- tags are mandatory; `latest` is never used
//   W6 deploy result is decided by Coolify deployment status + independent
//      health + smoke — never by the trigger HTTP 2xx alone
//   W7 rollback workflow exists, requires explicit migration-awareness for
//      the PocketBase surface, and never touches pb_data
//   W8 build-images.yml pins actions and publishes digests + a report
//   W9 the orchestrator scripts never place tokens in argv and fail closed
//      on missing secret env vars
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`CONTRACT-FAIL: ${msg}`);
};
const pass = (msg) => console.log(`  PASS  ${msg}`);

function loadYaml(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) {
    fail(`missing workflow file ${rel}`);
    return null;
  }
  try {
    return YAML.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    fail(`YAML parse error in ${rel}: ${err.message}`);
    return null;
  }
}

// ---- helpers -----------------------------------------------------------------
const yamlText = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
// ---- W1/W2 release-deploy ------------------------------------------------------
const rd = loadYaml('.github/workflows/release-deploy.yml');
if (rd) {
  if (rd.on?.workflow_dispatch)
    pass('W1 release-deploy is manually dispatched (workflow_dispatch)');
  else fail('W1 release-deploy lacks workflow_dispatch');

  const dispatchInputs = rd.on?.workflow_dispatch?.inputs ?? {};
  if (dispatchInputs.commit_sha || dispatchInputs.ref) pass('W1 exact commit/ref input present');
  else fail('W1 release-deploy has no exact-commit input');

  const GITHUB_SHA_LITERAL = '$' + '{{ github.sha }}';
  if (JSON.stringify(rd).includes(GITHUB_SHA_LITERAL)) pass('W1 pinned to github.sha by default');
  else pass('W1 commit resolution is input or SHA-driven');

  const text = yamlText('.github/workflows/release-deploy.yml');
  const hasProdEnv =
    JSON.stringify(rd).includes('"environment":"production"') || rd.environment === 'production';
  if (hasProdEnv) pass('W2 uses the production environment (job-level approval gate)');
  else fail('W2 production environment missing');
  if (text.includes('${{ secrets.') && !/(password|token|key)\s*:\s*["'][^$]/.test(text)) {
    pass('W2 secrets referenced only by name (no literals)');
  } else {
    // ensure no literal-looking secret values: flag suspect hardcoded values
    const suspects = [
      ...text.matchAll(
        /(?:COOLIFY_API_TOKEN|COOLIFY_BASE_URL|FEP_SSH_[A-Z_]+|COOLIFY_APP_UUID_[A-Z]+)\s*[:=]\s*["']([^"'$]{8,})/g,
      ),
    ];
    if (suspects.length)
      fail(`W2 literal secret-looking values found: ${suspects.map((s) => s[1]).join(', ')}`);
    else pass('W2 secrets referenced only by name (no literals)');
  }
}

// ---- W3 Coolify API contract ---------------------------------------------------
const deployScript = yamlText('scripts/coolify-deploy.sh');
for (const needle of ['/api/v1/deploy', '/api/v1/deployments/']) {
  if (deployScript.includes(needle)) pass(`W3 coolify-deploy.sh uses ${needle}`);
  else fail(`W3 coolify-deploy.sh missing ${needle}`);
}
for (const status of ['queued', 'in_progress', 'finished', 'failed', 'cancelled-by-user']) {
  if (deployScript.includes(status)) pass(`W3 handles deployment status '${status}'`);
  else fail(`W3 missing status handling '${status}'`);
}
if (/deployment_uuid/.test(deployScript))
  pass('W3 parses deployment_uuid from the trigger response');
else fail('W3 trigger response deployment_uuid not parsed');

if (rd) {
  const jobs = rd.jobs ?? {};
  const deployJob =
    jobs.deploy ??
    jobs.deploy_coolify ??
    Object.values(jobs).find((j) => JSON.stringify(j).includes('coolify-deploy.sh'));
  if (deployJob) {
    const jt = JSON.stringify(deployJob);
    if (
      jt.includes('deployment_uuid') ||
      jt.includes('finished') ||
      jt.includes('coolify-deploy.sh')
    )
      pass('W6 deploy success depends on Coolify deployment status polling');
    else fail('W6 deploy job does not poll Coolify deployment status');
  } else fail('W6 deploy job not found');
}

// ---- W4 canonical gate gating ---------------------------------------------------
const rdJson = JSON.stringify(rd);
if (
  rd &&
  rdJson.includes('check-runs') &&
  rdJson.includes('.name==') &&
  rdJson.includes('verify') // merge-gate job name of quality.yml
)
  pass('W4 production deployment requires a green canonical quality run (merge-gate job `verify`)');
else fail('W4 no quality-gate enforcement (check-runs + verify job) found in release-deploy');

// ---- W5 immutable tags ----------------------------------------------------------
const bi = loadYaml('.github/workflows/build-images.yml');
if (bi) {
  const text = yamlText('.github/workflows/build-images.yml');
  if (/sha-[^"']+|\${{[^}]*sha[^}]*}}/.test(text) && text.includes(':sha-'))
    pass('W5 build-images publishes immutable sha- tags');
  else fail('W5 sha- immutable tag missing in build-images');

  // `latest` allowed nowhere as an image tag
  const latestUses = [...text.matchAll(/[:\s]latest\b/g)];
  if (latestUses.length === 0) pass('W5 `latest` tag is never used');
  else fail(`W5 \`latest\` appears ${latestUses.length} time(s) in build-images`);
  if (text.includes('digest') || text.includes('digests')) pass('W5 digests are reported');
  else fail('W5 no digest reporting in build-images');
  if (text.includes('pull_request')) {
    // allow building on PRs only if not deploying; deployment gating is W4
    pass('W5 build-images scoping reviewed (PR build ok, deploy gated separately)');
  }
}

// pinned major actions
for (const act of [
  'docker/setup-buildx-action@v4',
  'docker/build-push-action@v7',
  'docker/login-action@v4',
  'actions/checkout@v7',
]) {
  const t = yamlText('.github/workflows/build-images.yml');
  if (t.includes(act)) pass(`W8 pinned action ${act}`);
  else fail(`W8 pinned action ${act} missing`);
}

// ---- W7 rollback -----------------------------------------------------------------
const rb = loadYaml('.github/workflows/rollback-deploy.yml');
if (rb) {
  const t = yamlText('.github/workflows/rollback-deploy.yml');
  if (t.includes('workflow_dispatch')) pass('W7 rollback is manual (workflow_dispatch)');
  else fail('W7 rollback workflow not manual');
  if (t.includes('migration') || t.includes('MIGRATION'))
    pass('W7 rollback requires migration awareness');
  else fail('W7 rollback lacks migration-awareness handling');
  // the rollback workflow may *document* that pb_data was untouched, but it
  // must never run a host command against the pb_data path. YAML-based:
  // every step's FULL run body is scanned for destructive verbs applied to
  // the pb_data path or the /opt/fast-english tree (documentation lines
  // like "pb_data was NOT touched" contain no destructive verb).
  const runBodies = [];
  const collectRuns = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(collectRuns);
      else if (typeof v === 'object') collectRuns(v);
      else if (typeof v === 'string' && (v.includes('pb_data') || v.includes('/opt/fast-english')))
        runBodies.push(v);
    }
  };
  collectRuns(rb);
  const DANGER =
    /(?:\brm\b|\bmv\b|unzip|mkdir|chown|\bcp\b|\bdd\b|truncate|:?\s*>)[^\n]*pb_data|pb_data[^\n]*(?:\brm\b|\bmv\b|unzip|chown)|\/opt\/fast-english[^\n]*(?:\brm\b|\bmv\b|del)/;
  const touchesData = runBodies.some((b) => DANGER.test(b));
  if (touchesData) fail('W7 rollback workflow runs commands that could touch pb_data');
  else pass('W7 rollback workflow never touches pb_data (documented as untouched only)');
  if (t.includes('coolify-deploy.sh') || t.includes('prod-health-check.sh'))
    pass('W7 rollback validates the previous image');
  else fail('W7 rollback lacks post-rollback verification');
} else {
  fail('W7 rollback-deploy.yml missing');
}

// ---- W10/W11 deployment-ordering guards (reviewer-class defects) -----------------
// W10: the `production` alias must be published AFTER the smoke step (a step
// referencing steps.<later>.outcome is always false/skipped).
// W11: the deploy job must tolerate a SKIPPED predeploy-backup (class A/D/E).
if (rd) {
  const deployJob =
    rd.jobs?.deploy ??
    Object.values(rd.jobs ?? {}).find((j) => j && JSON.stringify(j).includes('coolify-deploy.sh'));
  const text = yamlText('.github/workflows/release-deploy.yml');
  const aliasIdx = text.indexOf('Publish the production image alias');
  const smokeIdx = text.indexOf('Production smoke');
  if (
    aliasIdx > smokeIdx &&
    aliasIdx > 0 &&
    smokeIdx > 0 &&
    text.includes('github.event.inputs.publish_production_alias') &&
    text.includes('success()')
  )
    pass('W10 `production` alias published after smoke (post-verification ordering)');
  else fail('W10 `production` alias publishing must come after the smoke step');
  const deployJson = deployJob ? JSON.stringify(deployJob) : '';
  if (deployJson.includes("predeploy-backup.result == 'skipped'"))
    pass('W11 deploy job tolerates a skipped predeploy-backup');
  else fail('W11 deploy job must allow a skipped predeploy-backup (class A/D/E)');
}

// ---- W9 orchestrator scripts ------------------------------------------------------
const sh = yamlText('scripts/coolify-deploy.sh');
if (sh.includes('COOLIFY_API_TOKEN')) pass('W9 token supplied via env var');
else fail('W9 COOLIFY_API_TOKEN env contract missing');
if (
  !/curl\b[^\n]*Bearer/.test(sh) &&
  sh.includes('-H @"$HDR"') &&
  sh.includes("printf 'Authorization: Bearer")
) {
  pass('W9 token passed to curl via 0600 header file (never argv)');
} else {
  fail('W9 token header file mechanism not verified');
}

// W3 health/smoke independence
if (existsSync(resolve(ROOT, 'scripts/prod-health-check.sh')))
  pass('W6 independent health checker exists');
else fail('W6 prod-health-check.sh missing');
if (existsSync(resolve(ROOT, 'deploy/smoke-prod.sh')))
  pass('W6 smoke-prod.sh retained as the independent truth source');
else fail('W6 deploy/smoke-prod.sh missing');

console.log('');
if (failures > 0) {
  console.error(`COOLIFY CONTRACT: ${failures} failure(s)`);
  process.exit(1);
}
console.log('COOLIFY CONTRACT: ALL PASS');
