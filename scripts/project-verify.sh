#!/usr/bin/env bash
# Fast English Podcast — project-specific verification gate.
# Called by scripts/verify.sh. Run from the repository root.
#
# Does not install or modify dependencies. Does not auto-format.
# Fails on the first real failure. Preserves readable command output.
#
# CI backend lane: set FEP_VERIFY_PARALLEL_SMOKES=1 to run the 16 smoke
# suites concurrently (each on its own disposable PocketBase; see
# scripts/verify-smokes-parallel.sh). The default serial order below is
# unchanged for local/review runs.
#
# Steps:
#   1. Strict typecheck
#   2. Biome lint/format check (no auto-fix)
#   3. Unit / contract tests (Vitest)
#   4. Auth smoke (real PB; P0-S3 contract)
#   5. Payment smoke (real PB; P1-S1 23/23 contract)
#   6. Payment-preview smoke (real PB; P1-S1D 12/12 contract)
#   7. Placement smoke (Phase 2)
#   8. Placement-levels smoke (Phase 2)
#   9. Operator smoke (Phase 2)
#  10. Multi-tab race smoke (Phase 2 closure; atomic answer save proof)
#  11. Snapshot capacity smoke (Phase 2 closure; max-content proof)
#  12. Lessons smoke (P3-S1; 25+ assertions for topics, publishing, entitlement, protected audio)
#  12b. Episode smoke (Podcast Slice 7; per-Variant vocabulary, pronunciation authorization,
#       live entitlement revalidation, protected media, Range behavior, prev/next refs)
#  13. Progress smoke (P3-S2; 30+ assertions for progress persistence, entitlement, concurrency)
#  13b. Podcast domain smoke (Podcast Slice 2; categories, Episode/Variant domain, vocabulary,
#       cross-level entitlement, migration backfill proof, Progress integrity, archival semantics)
#  13c. Content-import smoke (Podcast Slice 3; 28-scenario importer suite)
#  13e. Content-admin smoke (Podcast Slice 4; 28-scenario Staff Content Studio suite)
#  13f. Library & Discovery smoke (Podcast Slice 6; 27-scenario Library contract)
#  13d. Content Package Schema validation (Podcast Slice 3)
#  14. Build all surfaces deterministically
#  15. Topology output verification
#
# Playwright E2E is run separately via `pnpm test:e2e` so that
# review-time runs of `scripts/verify.sh` stay fast and offline.
# The E2E suite is documented in the final P1-S1D report.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run() {
  printf '\n=== %s ===\n' "$*"
  "$@"
}

test -x server/pocketbase || {
  echo 'server/pocketbase missing — run scripts/setup-pocketbase.sh first' >&2
  exit 1
}

# 1. Strict typecheck across both surfaces and Vite configs.
run npx tsc --noEmit

# 2. Biome lint/format check (no auto-fix).
run npx biome check .

# 3. Test command (passWithNoTests is acceptable for topology-only slices).
run npx vitest run --passWithNoTests

# 4-13f. Real Backend smoke suites against disposable PocketBases (one PB
# per suite). The CI backend lane sets FEP_VERIFY_PARALLEL_SMOKES=1 to
# overlap the independent suites on dedicated ports; the canonical serial
# order below stays the default for local/review runs so output remains
# deterministic and readable.
if [[ "${FEP_VERIFY_PARALLEL_SMOKES:-0}" == "1" ]]; then
  run bash scripts/verify-smokes-parallel.sh
else
  # 4. Auth smoke against disposable PB.
  run bash scripts/smoke-auth.sh node scripts/smoke-auth.mjs

  # 5. Payment smoke against disposable PB (23/23).
  run bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs

  # 6. Payment-preview smoke against disposable PB (12/12).
  run bash scripts/smoke-payment.sh node scripts/smoke-payment-preview.mjs

  # 7. Placement smoke (Phase 2; 40+ assertions).
  run bash scripts/smoke-placement.sh node scripts/smoke-placement.mjs

  # 8. Placement-levels smoke (Phase 2; level selection + dashboard).
  run bash scripts/smoke-placement.sh node scripts/smoke-placement-levels.mjs

  # 9. Operator smoke (Phase 2; Staff approval + management).
  run bash scripts/smoke-payment.sh node scripts/smoke-operator.mjs

  # 9b. Staff Auth smoke (Podcast Slice 1; schema, locked rules, cross-token
  #     authorization matrix, bootstrap fail-safes, legacy diagnostic).
  run bash scripts/smoke-payment.sh node scripts/smoke-staff.mjs

  # 10. Multi-tab race smoke (Phase 2 closure; atomic answer save proof).
  run bash scripts/smoke-placement.sh node scripts/smoke-placement-race.mjs

  # 11. Snapshot capacity smoke (Phase 2 closure; max-content proof).
  run bash scripts/smoke-placement.sh node scripts/smoke-placement-capacity.mjs

  # 12. Lessons smoke (P3-S1; 25+ assertions for topics, publishing, entitlement, protected audio).
  run bash scripts/smoke-placement.sh node scripts/smoke-lessons.mjs

  # 12b. Episode smoke (Podcast Slice 7; per-Variant vocabulary + protected
  #      pronunciation audio with authorization/revalidation/Range/prev-next
  #      regressions — part of the canonical full gate).
  run bash scripts/smoke-placement.sh node scripts/smoke-episode.mjs

  # 13. Progress smoke (P3-S2; 30+ assertions for progress persistence, entitlement, concurrency).
  run bash scripts/smoke-placement.sh node scripts/smoke-progress.mjs

  # 13b. Podcast domain smoke (Podcast Slice 2; categories, Episode/Variant
  #      domain, vocabulary, cross-level entitlement, migration backfill proof,
  #      Progress integrity, archival semantics).
  run bash scripts/smoke-placement.sh node scripts/smoke-podcast-domain.mjs

  # 13c. Content-import smoke (Podcast Slice 3; the 28-scenario importer suite:
  #      validation, template failure, zero-mutation plan, Draft import,
  #      idempotency, conflicts, version rules, rollback, audit, authz).
  run bash scripts/smoke-placement.sh node scripts/smoke-content-import.mjs

  # 13e. Content-admin smoke (Podcast Slice 4; the 28-scenario Staff Content
  #      Studio suite: categories, episodes, variants, vocabulary, readiness,
  #      publish/archive, draft preview, ZIP ingestion, stale plans, audit).
  run bash scripts/smoke-placement.sh node scripts/smoke-content-admin.mjs

  # 13f. Library & Discovery smoke (Podcast Slice 6; the 27-scenario Library
  #      contract: canonical Episode grouping, published Categories/Episodes/
  #      Variants only, publication filtering before pagination, search,
  #      Category/Level/Progress filters, preferred/recommended fallback,
  #      CEFR availableLevels order, deterministic pagination, Continue
  #      rail, entitlement denial, bounds, sanitization, read-only browsing).
  run bash scripts/smoke-placement.sh node scripts/smoke-library.mjs
fi

# 13d. Content Package Schema validation (Podcast Slice 3): the committed
#      JSON Schema must be parseable JSON, the committed example package
#      must validate, and the generated template must fail as designed.
printf '\n=== content package schema validation (Slice 3) ===\n'
node -e "JSON.parse(require('fs').readFileSync('schemas/episode-package.schema.json', 'utf8')); console.log('episode-package.schema.json: valid JSON')"
node scripts/content/cli.mjs validate content-packages/example-episode >/dev/null || {
  echo 'example content package failed validation' >&2
  exit 1
}
echo 'content-packages/example-episode: PASS'

# 14. Build all surfaces deterministically.
run npx vite build --config vite.app.config.ts
run npx vite build --config vite.landing.config.ts
run node scripts/prerender-landing.mjs
run npx vite build --config vite.admin.config.ts

# 15. Topology output verification.
printf '\n=== topology verification ===\n'

test -f dist-landing/index.html || { echo 'missing dist-landing/index.html' >&2; exit 1; }
test -f dist-app/index.html || { echo 'missing dist-app/index.html' >&2; exit 1; }
test -f dist-admin/index.html || { echo 'missing dist-admin/index.html' >&2; exit 1; }

# Outputs must be distinct files.
for pair in "dist-landing/index.html dist-app/index.html" "dist-app/index.html dist-admin/index.html" "dist-landing/index.html dist-admin/index.html"; do
  set -- $pair
  if [[ "$1" -ef "$2" ]]; then
    echo "$1 and $2 must be distinct files" >&2
    exit 1
  fi
done

# Required markers.
grep -q 'app-surface' dist-app/index.html || {
  echo 'app-surface marker missing in dist-app/index.html' >&2
  exit 1
}
grep -q 'landing-surface' dist-landing/index.html || {
  echo 'landing-surface marker missing in dist-landing/index.html' >&2
  exit 1
}
grep -q 'admin-surface' dist-admin/index.html || {
  echo 'admin-surface marker missing in dist-admin/index.html' >&2
  exit 1
}

# No cross-leakage of the other surface's marker into a built output.
if grep -rq 'landing-surface' dist-app/; then
  echo 'landing-surface marker leaked into dist-app bundle' >&2
  exit 1
fi
if grep -rq 'app-surface' dist-landing/; then
  echo 'app-surface marker leaked into dist-landing bundle' >&2
  exit 1
fi
if grep -rq 'admin-surface' dist-app/ || grep -rq 'app-surface' dist-admin/; then
  echo 'Student/Admin surface markers leaked across bundles' >&2
  exit 1
fi

# 15b. Admin Console must never ship the Student PWA artifacts.
if [[ -f dist-admin/sw.js || -f dist-admin/manifest.webmanifest ]]; then
  echo 'dist-admin must not contain a Service Worker or Student manifest' >&2
  exit 1
fi
echo 'dist-admin has no Service Worker / Student manifest (PWA separation OK)'

# 15c. Student/Admin bundle import boundaries (precise markers, no broad
#      string scanning).
run node scripts/check-bundle-boundaries.mjs dist-app dist-admin

# 16. Landing SEO/link checks against the built output (P4-S1).
run node scripts/check-landing-output.mjs

# 17. Configured-APK build: proves the download CTA is configuration-driven
#     and that a configured official URL renders the correct link + version.
run bash -c 'VITE_ANDROID_APK_URL="https://fastenglishpodcast.com/releases/fast-english-podcast-0.1.0.apk" VITE_ANDROID_APK_VERSION="0.1.0" npx vite build --config vite.landing.config.ts --outDir "$(pwd)/dist-landing-apk" && VITE_ANDROID_APK_URL="https://fastenglishpodcast.com/releases/fast-english-podcast-0.1.0.apk" VITE_ANDROID_APK_VERSION="0.1.0" node scripts/prerender-landing.mjs --out "$(pwd)/dist-landing-apk" && VITE_ANDROID_APK_URL="https://fastenglishpodcast.com/releases/fast-english-podcast-0.1.0.apk" VITE_ANDROID_APK_VERSION="0.1.0" node scripts/check-landing-output.mjs --apk-dir "$(pwd)/dist-landing-apk"'

# 18. P4-S2 — PWA output checks on the built Product App.
printf '\n=== PWA output verification (P4-S2) ===\n'
test -f dist-app/manifest.webmanifest || { echo 'missing dist-app/manifest.webmanifest' >&2; exit 1; }
test -f dist-app/sw.js || { echo 'missing dist-app/sw.js' >&2; exit 1; }
test -f dist-app/pwa-192x192.png || { echo 'missing dist-app/pwa-192x192.png' >&2; exit 1; }
test -f dist-app/pwa-512x512.png || { echo 'missing dist-app/pwa-512x512.png' >&2; exit 1; }
test -f dist-app/pwa-maskable-512x512.png || { echo 'missing dist-app/pwa-maskable-512x512.png' >&2; exit 1; }
grep -q 'rel="manifest"' dist-app/index.html || { echo 'manifest link missing in dist-app/index.html' >&2; exit 1; }
# The Service Worker must be a Product-App artifact only — never the Landing.
if [[ -f dist-landing/sw.js || -f dist-landing/manifest.webmanifest ]]; then
  echo 'Service Worker or manifest leaked into dist-landing' >&2
  exit 1
fi
# The injected precache manifest must contain ONLY public App-shell assets:
# never /api/, /files/ or tokenized URLs (the Service Worker's deny-list
# logic itself legitimately contains those literals, so inspect the manifest).
node -e "
  const fs = require('fs');
  const sw = fs.readFileSync('dist-app/sw.js', 'utf8');
  const urls = [...sw.matchAll(/\"url\":\"([^\"]+)\"/g)].map((m) => m[1]);
  if (urls.length === 0) { console.error('no precache entries found in dist-app/sw.js'); process.exit(1); }
  // Query-precise, matching the Service Worker's own isProtectedUrl guard:
  // protected URLs are /api or /files paths, or URLs carrying a token=
  // query parameter. A public chunk whose NAME contains \"tokens\" (the
  // post-split tokens-*.js module) is NOT protected and must not fail here.
  const bad = urls.filter((u) => u.startsWith('api/') || u.startsWith('files/') || /(^|[?&])token=/.test(u));
  if (bad.length > 0) { console.error('protected URL found in the Service Worker precache:', bad); process.exit(1); }
  console.log('precache manifest clean: ' + urls.length + ' public App-shell entries, no protected URLs');
"

# 19. P4-S2 — Android version-consistency gate (gradle <-> capacitor <-> APK
#     filename <-> Landing release input). No secrets required.
run node scripts/check-android-version.mjs

# 20. P4-S2 — Release signing must fail safely when signing variables are
#     absent (and pass the precheck when they are present).
printf '\n=== release signing fail-safe gate (P4-S2) ===\n'
if [[ -z "${FEP_ANDROID_KEYSTORE_PATH:-}" || -z "${FEP_ANDROID_KEY_ALIAS:-}" || -z "${FEP_ANDROID_KEYSTORE_PASSWORD:-}" || -z "${FEP_ANDROID_KEY_PASSWORD:-}" ]]; then
  gate_output="$(bash scripts/build-release-apk.sh --precheck 2>&1 || true)"
  if ! grep -q 'Production signing material: REQUIRED' <<<"$gate_output"; then
    echo 'expected the release-signing precheck to fail with a REQUIRED message' >&2
    exit 1
  fi
  echo 'release signing precheck fails safely with the REQUIRED message (as expected without secrets)'
else
  run bash scripts/build-release-apk.sh --precheck
fi

# 21. P4-S2 — Release-APK verification when an artifact already exists.
#     Without signing material no APK can exist; the gate then skips.
run bash scripts/verify-release-apk.sh --if-present

# 22. P4-S3 — deployment redaction proofs: sentinel credentials never leak
#     from install.sh (superuser password) or configure.sh (S3/SMTP/superuser),
#     and no credential or token ever appears in a process argument
#     (configure.sh / backup.sh).
printf '\n=== deploy redaction proofs (P4-S3) ===\n'
run bash deploy/test-install-redaction.sh
run bash deploy/test-configure-redaction.sh
run bash deploy/test-process-args-redaction.sh

# 23. P4-S3 — Caddy access-log token-redaction proof. Requires a local caddy
#     binary; the release server runs this drill unconditionally (see
#     deploy/README.md). CI provisions caddy and sets FEP_REQUIRE_CADDY=1 so
#     the canonical gate cannot silently skip the proof.
if command -v caddy >/dev/null 2>&1; then
  run bash deploy/test-log-redaction.sh
elif [ "${FEP_REQUIRE_CADDY:-0}" = "1" ]; then
  echo 'ERROR: FEP_REQUIRE_CADDY=1 but caddy binary not found — access-log redaction drill REQUIRED' >&2
  exit 1
else
  echo 'caddy binary not found — skipping the access-log redaction drill locally (CI/release run it; set FEP_REQUIRE_CADDY=1 to demand it)'
fi

printf '\nAll project verification checks passed.\n'
