// scripts/check-android-version.mjs
// P4-S2 — Version-consistency gate for the Android release.
//
// Verifies that the same version identity is used across:
//   1. Android Gradle configuration (android/app/build.gradle)
//   2. Capacitor configuration (capacitor.config.json) and package metadata
//   3. The generated Release APK filename
//   4. Landing release-metadata input (VITE_ANDROID_APK_VERSION / release metadata JSON)
//
// Version policy (documented in docs/PLAN.md, P4-S2):
//   - versionName is user-facing (semver-ish, e.g. 1.0.0)
//   - versionCode is an integer that must strictly increase per update
//   - future APK updates must keep the same applicationId and signing certificate
//
// Never auto-increments versions during ordinary builds.
//
// Usage: node scripts/check-android-version.mjs
// Env:   VITE_ANDROID_APK_VERSION (optional) — Landing release input to check.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`Version consistency check FAILED: ${message}`);
  process.exit(1);
}

// --- 1. Android Gradle configuration ---
const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8');
const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1];
const applicationId = gradle.match(/applicationId\s+"([^"]+)"/)?.[1];
if (!versionName || !versionCode || !applicationId) {
  fail('could not parse versionName/versionCode/applicationId from android/app/build.gradle');
}

// --- 2. Capacitor configuration ---
const capacitor = JSON.parse(readFileSync(join(ROOT, 'capacitor.config.json'), 'utf8'));
if (capacitor.appId !== applicationId) {
  fail(
    `capacitor.config.json appId "${capacitor.appId}" != gradle applicationId "${applicationId}"`,
  );
}

// --- 3. APK filename (deterministic release artifact name) ---
const apkFileName = `fast-english-podcast-v${versionName}.apk`;
if (!/^fast-english-podcast-v[0-9]+\.[0-9]+\.[0-9]+\.apk$/.test(apkFileName)) {
  fail(`APK filename "${apkFileName}" must follow fast-english-podcast-v<semver>.apk`);
}

// --- 4. Landing release-metadata input ---
const envVersion = process.env.VITE_ANDROID_APK_VERSION;
if (envVersion && envVersion !== versionName) {
  fail(`VITE_ANDROID_APK_VERSION "${envVersion}" != versionName "${versionName}"`);
}

// --- 5. Existing release metadata (when a Release APK was already built) ---
const metadataPath = join(ROOT, 'releases', 'release-metadata.json');
if (existsSync(metadataPath)) {
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const expected = {
    versionName,
    versionCode: Number(versionCode),
    packageId: applicationId,
    fileName: apkFileName,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (metadata[key] !== value) {
      fail(`release-metadata.json ${key} "${metadata[key]}" != expected "${value}"`);
    }
  }
}

console.log(
  `Version consistency OK: ${applicationId} versionName=${versionName} versionCode=${versionCode} -> ${apkFileName}`,
);
