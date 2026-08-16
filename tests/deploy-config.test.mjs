// tests/deploy-config.test.mjs
// Static contract for deploy/Caddyfile (plan 006).
//
// The content-import API paths (CLI + Admin ZIP packages up to ~60MB)
// must have a scoped 64MB request-body cap in BOTH site blocks (app and
// admin domains), while every OTHER /api/* path keeps the 6MB boundary
// (5MB receipt + margin). Structural checks only — this test does not
// parse Caddy syntax.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const caddyfile = fs.readFileSync(
  path.resolve(import.meta.dirname, '..', 'deploy', 'Caddyfile'),
  'utf8',
);

test('the scoped content-import handle exists in both site blocks', () => {
  const handles = caddyfile.match(/handle \/api\/fast-english\/staff\/content-import\/\*/g) || [];
  assert.equal(
    handles.length,
    2,
    `expected the import-path handle in both domains, got ${handles.length}`,
  );
});

test('every 64MB cap sits inside an import-scoped handle; generic blocks stay 6MB', () => {
  const lines = caddyfile.split('\n');
  const importHandleLines = [];
  const openHandles = [];
  let currentHandle = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*handle\s+(\S+)\s*\{\s*$/);
    if (m) {
      currentHandle = m[1];
      openHandles.push(currentHandle);
      if (currentHandle === '/api/fast-english/staff/content-import/*') {
        importHandleLines.push(i);
      }
      continue;
    }
    if (/^\s*}\s*$/.test(line)) {
      openHandles.pop();
      if (openHandles.length === 0) currentHandle = null;
      continue;
    }
    if (line.includes('max_size 64MB')) {
      assert.ok(
        currentHandle === '/api/fast-english/staff/content-import/*',
        `max_size 64MB at line ${i + 1} is not inside an import-scoped handle (current: ${currentHandle})`,
      );
    }
  }
  assert.equal(importHandleLines.length, 2, 'import handles must be at top level');
});

test('generic /api/* blocks still cap at 6MB (receipt boundary preserved)', () => {
  const sixMb = caddyfile.match(/max_size 6MB/g) || [];
  assert.equal(sixMb.length, 2, `expected exactly 2 generic 6MB caps, got ${sixMb.length}`);
});

test('landing proxies ONLY the public settings path (no generic /api surface)', () => {
  // The landing site block may contain exactly one /api/* proxy: the
  // public business-settings endpoint. Any other /api handle on the
  // landing domain would widen the static site's API surface.
  const handles = caddyfile.match(/handle \/api[^ ]*/g) || [];
  const landingScoped = handles.filter((h) => h === 'handle /api/fast-english/public/settings');
  assert.equal(landingScoped.length, 1, 'expected exactly one scoped public-settings handle');
  const genericApiOnLanding = caddyfile.match(/handle \/api\/\*/g) || [];
  assert.equal(genericApiOnLanding.length, 2, 'generic /api/* handles belong to app+admin only');
});

test('landing settings handle carries a bounded body cap', () => {
  // Locate the settings handle block and require a request_body cap inside it.
  const lines = caddyfile.split('\n');
  const openHandles = [];
  let currentHandle = null;
  let sawBodyCap = false;
  for (const line of lines) {
    const m = line.match(/^\s*handle\s+(\S+)\s*\{\s*$/);
    if (m) {
      currentHandle = m[1];
      openHandles.push(currentHandle);
      sawBodyCap = false;
      continue;
    }
    if (/^\s*}\s*$/.test(line)) {
      openHandles.pop();
      if (openHandles.length === 0) currentHandle = null;
      continue;
    }
    if (currentHandle === '/api/fast-english/public/settings') {
      if (line.includes('max_size')) sawBodyCap = true;
      if (line.includes('reverse_proxy 127.0.0.1:8090')) {
        assert.ok(sawBodyCap, 'public-settings handle must bound request bodies');
      }
    }
  }
});
