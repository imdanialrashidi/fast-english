# Fast English Podcast — Android Release Process

Responsible owner: **<TODO: replace with the named release owner>**
Last updated: 2026-08-01.

## 1. Current release (v1.0.0)

| Item | Value |
|---|---|
| File | `fast-english-podcast-v1.0.0.apk` |
| Public URL | `https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk` |
| Package ID | `com.fastenglishpodcast.app` |
| versionName / versionCode | 1.0.0 / 1 |
| Size | 3,676,778 bytes |
| SHA-256 | `e358b5c4654d6c259411c921acd69983d07799a15161c1fd02f6a869a9fdc2c5` |
| Signing cert SHA-256 | `8FE0EA73B1243ABBE9263C28678BEAC521462E8D302F790AF0029E5C4B49D543` |
| Minimum / target API | 24 / 36 |
| Signature scheme | APK Signature Scheme v2 (RSA 4096) |

Public release metadata: `/releases/release-metadata.json`,
`/releases/RELEASE-NOTES.md`. The Landing's install page links the exact
artifact and shows version 1.0.0.

## 2. Signing material (never in Git)

The release keystore and passwords live only in the operator's custody /
server secrets file (names: `FEP_ANDROID_KEYSTORE_PATH`,
`FEP_ANDROID_KEY_ALIAS`, `FEP_ANDROID_KEYSTORE_PASSWORD`,
`FEP_ANDROID_KEY_PASSWORD`). The build fails safely with
"Production signing material: REQUIRED" when they are absent — the debug
keystore must never sign a distributable APK. The debug APK is never
published.

## 3. Building a release

```bash
pnpm android:check:version     # gradle ↔ capacitor ↔ APK filename ↔ landing version
bash scripts/build-release-apk.sh   # requires FEP_ANDROID_* signing env
bash scripts/verify-release-apk.sh  # apksigner/zipalign/aapt/sha256sum + metadata
```

`verify-release-apk.sh` regenerates `release-metadata.json` and
`RELEASE-NOTES.md` with the verified values.

## 4. Verifying a published APK (anyone, from the public URL)

```bash
curl -fsSO https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk
sha256sum fast-english-podcast-v1.0.0.apk
#   must equal the sha256 in release-metadata.json (see §1)
curl -fsS https://fastenglishpodcast.com/releases/release-metadata.json | python3 -m json.tool
apksigner verify --verbose --print-certs fast-english-podcast-v1.0.0.apk
#   Verified using v2 scheme: true; cert SHA-256 matches §1
```

Additional checks: `Content-Length` of the download equals `sizeBytes`;
no directory listing at `/releases/` (404); the APK is served as
`application/vnd.android.package-archive` over HTTPS only.

## 5. Publishing to the server

The APK + metadata are shipped inside each release bundle (`android/`).
`deploy/deploy.sh` verifies the APK sha256 against the bundle metadata
before installing, then the Caddyfile serves `/releases/*` from
`shared/releases` (copy the artifact there once per release). A released
APK is immutable: **never overwrite an existing filename with different
bytes** — the public cache header is `immutable` by design.

## 6. Next version procedure (v1.0.1, v1.1.0, …)

1. Bump `versionCode` (+1 minimum) and `versionName` in
   `android/app/build.gradle`, and `VITE_ANDROID_APK_VERSION` for the
   landing build.
2. Build + verify (§3); keep the same application ID and signing
   certificate (identity stability).
3. New **immutable filename**: `fast-english-podcast-v1.1.0.apk` — old
   versions keep working from `/releases/` (previous APK is never deleted).
4. Ship the new APK + metadata in the next release bundle; update the
   landing build inputs (`VITE_ANDROID_APK_URL`/`VITE_ANDROID_APK_VERSION`).
5. Update `release-metadata.json` and `RELEASE-NOTES.md` for the new file;
   old files remain for the old APK.
6. Smoke: `smoke-prod.sh` re-verifies content-length + sha256 + landing CTA
   against the new metadata automatically.
7. Real-device gate (manual, requires a physical device): install the APK,
   first launch, signup/login, receipt upload, placement, lesson + audio
   play/seek, relaunch progress restore, no Service Worker interference in
   Capacitor (registration is disabled on native).

## 7. Current open gates (from P4-S2)

- **Physical-device gate: NOT RUN** — no Android device was available in the
  build environment (`adb devices` empty). The release APK connects to
  `https://app.fastenglishpodcast.com` by construction (verified in the
  bundle), but install/audio/relaunch behaviour on hardware is unverified
  until a device check is performed.
