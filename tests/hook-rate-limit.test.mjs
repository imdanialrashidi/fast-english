// tests/hook-rate-limit.test.mjs
// Static invariants for the custom-route rate limiting (plan 001).
//
// Every per-user rate-limit window in server/pb_hooks must be bounded:
// the maps are created/used through the shared module
// (server/pb_hooks/rate_limit.pb.js) whose checkRate() evicts stale
// buckets once a map exceeds 2048 keys. The four pre-existing bounded
// artwork-family closures keep their own eviction branch — the count
// equality below covers them too (declaration paired with eviction).
//
// Structural checks only (string/regex counting over source text), like
// the other static-guard suites in this repo. This test does not parse
// JavaScript.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const hooksDir = path.resolve(import.meta.dirname, '..', 'server', 'pb_hooks');
const files = fs
  .readdirSync(hooksDir)
  .filter((f) => f.endsWith('.pb.js'))
  .sort();

test('every per-user rate window is paired with a bounded eviction branch', () => {
  for (const f of files) {
    const src = fs.readFileSync(path.join(hooksDir, f), 'utf8');
    const decls = (src.match(/var RATE_WIN = globalThis\.__fep/g) || []).length;
    const evictions = (src.match(/Object\.keys\(RATE_WIN\)\.length >= 2048/g) || []).length;
    assert.equal(
      decls,
      evictions,
      `${f}: ${decls} rate-window declarations but ${evictions} eviction branches — ` +
        'every per-user map must be bounded (use rate_limit.pb.js or copy the 2048 eviction branch)',
    );
  }
});

test('public sample routes are keyed per-IP through the shared module (no global arrays)', () => {
  const src = fs.readFileSync(path.join(hooksDir, 'lesson_routes.pb.js'), 'utf8');
  assert.ok(
    !src.includes('globalThis.__fepPublicSample = []'),
    'public sample budget must not be a global array (per-IP keying required)',
  );
  assert.ok(
    !src.includes('globalThis.__fepSampleAudio = []'),
    'sample audio budget must not be a global array (per-IP keying required)',
  );
  assert.ok(
    src.includes('window("__fepPublicSample")') && src.includes('window("__fepSampleAudio")'),
    'public sample routes must use the shared bounded window module',
  );
});

test('every shared window name is __fep-prefixed', () => {
  const names = [];
  for (const f of files) {
    if (f === 'rate_limit.pb.js') continue; // the module itself has no rl.window calls (only the doc example)
    const src = fs.readFileSync(path.join(hooksDir, f), 'utf8');
    const m = src.matchAll(/\brl\w*\.window\("([^"]+)"\)/g);
    for (const hit of m) names.push(hit[1]);
  }
  assert.ok(names.length >= 12, `expected many shared windows, got ${names.length}`);
  for (const name of names) {
    assert.ok(
      name.startsWith('__fep'),
      `window name "${name}" must start with __fep (globalThis namespace)`,
    );
  }
});

test('rate-limit active-key cap stays at EVICT_AT under distinct-key cycling', async () => {
  // Load the shared module without relying on CJS require (repo is type:module, .pb.js is not CJS).
  // Evaluate the file in a vm if global not yet populated.
  if (!globalThis.__fepRateLimit || typeof globalThis.__fepRateLimit.checkRate !== 'function') {
    const src = fs.readFileSync(path.join(hooksDir, 'rate_limit.pb.js'), 'utf8');
    const vm = await import('node:vm');
    vm.runInThisContext(src, { filename: 'rate_limit.pb.js' });
  }
  const rl = globalThis.__fepRateLimit;
  assert.ok(rl && typeof rl.checkRate === 'function', 'rate_limit module loaded');
  assert.equal(rl.EVICT_AT, 2048);
  const win = {};
  const max = 1000;
  const ms = 60 * 1000;
  for (let i = 0; i < 3000; i++) {
    rl.checkRate(win, `k${i}`, max, ms);
  }
  assert.ok(
    Object.keys(win).length <= rl.EVICT_AT,
    `expected <= ${rl.EVICT_AT}, got ${Object.keys(win).length}`,
  );
  const win2 = {};
  for (let i = 0; i < rl.EVICT_AT; i++) {
    rl.checkRate(win2, `k${i}`, max, ms);
  }
  assert.equal(Object.keys(win2).length, rl.EVICT_AT);
  rl.checkRate(win2, 'k-next', max, ms);
  assert.ok(
    Object.keys(win2).length <= rl.EVICT_AT,
    `expected cap after oldest eviction, got ${Object.keys(win2).length}`,
  );
});
