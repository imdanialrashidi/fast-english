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
