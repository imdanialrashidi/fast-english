#!/usr/bin/env node
// scripts/check-bundle-boundaries.mjs
// Podcast Slice 1 — post-build proof that the Student and Admin bundles do
// not leak each other's surfaces. Uses precise surface markers and
// distinctive Persian strings (NOT broad scanning of shared Persian words
// or library code, which would create false positives).
//
// Usage: node scripts/check-bundle-boundaries.mjs [dist-app] [dist-admin]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = process.argv[2] ?? 'dist-app';
const ADMIN_DIR = process.argv[3] ?? 'dist-admin';

let failed = false;
function check(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed = true;
  } else {
    console.log(`✓ ${msg}`);
  }
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (/\.(js|html)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function bundleText(dir) {
  return walk(dir)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}

const appText = bundleText(APP_DIR);
const adminText = bundleText(ADMIN_DIR);

// --- Student bundle must not contain the Admin Console ---
check(!appText.includes('ورود مدیریت'), 'dist-app has no Admin login copy');
check(!appText.includes('داشبورد مدیریت'), 'dist-app has no Admin dashboard copy');
check(!appText.includes('درخواستهای پرداخت'), 'dist-app has no Staff payment queue heading');
check(!appText.includes('staff_admins'), 'dist-app has no staff_admins client model');
check(!appText.includes('admin-surface'), 'dist-app has no Admin surface marker');

// --- Admin bundle must not contain the Student App ---
check(!adminText.includes('ادامه یادگیری'), 'dist-admin has no Student Dashboard hero copy');
check(!adminText.includes('مشاهده درس'), 'dist-admin has no Student lesson-card copy');
check(!adminText.includes('پیشرفت آموزشی'), 'dist-admin has no Student Dashboard copy');
check(!adminText.includes('درسهای شما'), 'dist-admin has no Student lesson copy');
check(!adminText.includes('شروع تعیین سطح'), 'dist-admin has no Student payment CTA copy');
check(!adminText.includes('app-surface'), 'dist-admin has no Student surface marker');

// --- Each bundle carries exactly its own marker ---
check(appText.includes('app-surface'), 'dist-app carries the app-surface marker');
check(adminText.includes('admin-surface'), 'dist-admin carries the admin-surface marker');

if (failed) {
  console.error('\nbundle boundaries: FAIL');
  process.exit(1);
}
console.log('\nbundle boundaries: PASS');
