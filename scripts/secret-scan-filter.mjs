#!/usr/bin/env node
// scripts/secret-scan-filter.mjs
//
// Applies the documented exemptions to the pi-doctor secret scan. The scan
// itself (full working tree, fixed pattern) is unchanged; this filter only
// decides whether a scan hit is a *real* secret-pattern hit or one of the
// documented non-secret classes:
//
//   1. Placeholder values: `...` and `change-me-*` (env example files and
//      deploy docs document variable *names* only, never values).
//   2. Environment references: values that start with `process.env.` are
//      the JS/TS equivalent of `${VAR}` — the scanner already excludes
//      `${...}`/`$VAR` references, so this closes the same gap for JS.
//   3. Known committed synthetic/sentinel test credentials: exact value at
//      an exact path from scripts/secret-scan-allowlist.json. The match is
//      byte-exact and path-scoped, so the same string at an unexpected path
//      still fails.
//
// Input: lines of the form `path:line:content` (pi-doctor scan output).
// Output: only the lines that remain suspicious. Exit 0 when the filter
// itself is healthy; a non-zero exit means the filter could not run.
//
// Defect-sensitivity contract (tests/secret-scan.test.mjs):
//   - every allowlist entry must correspond to a real current scan hit;
//   - filtering the current scan output must leave zero lines;
//   - a real-looking credential line must always pass through.

import fs from 'node:fs';
import process from 'node:process';
import readline from 'node:readline';

const ALLOWLIST_URL = new URL('./secret-scan-allowlist.json', import.meta.url);

// Keep in sync with the grep -E pattern in scripts/pi-doctor.sh.
const SECRET_PATTERN =
  /sk-[A-Za-z0-9_-]{16,}|(?:API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)\s*=\s*[^"<${]\S+/;

function normalizePath(value) {
  return value.replace(/^\.\//, '');
}

function loadAllowlist() {
  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_URL, 'utf8'));
  if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error('scripts/secret-scan-allowlist.json must have version 1 and an entries array.');
  }
  for (const entry of parsed.entries) {
    if (
      !entry ||
      typeof entry.path !== 'string' ||
      typeof entry.value !== 'string' ||
      typeof entry.why !== 'string' ||
      entry.path.length === 0 ||
      entry.value.length === 0
    ) {
      throw new Error('Every allowlist entry needs non-empty string path, value, and why fields.');
    }
  }
  return parsed.entries;
}

function extractValue(match) {
  if (match.startsWith('sk-')) return match;
  const equalsIndex = match.indexOf('=');
  if (equalsIndex === -1) return match;
  return match.slice(equalsIndex + 1).replace(/^\s*/, '');
}

// Strip one leading quote and any trailing quote/punctuation so
// `'Probe-Staff-12345!';` normalizes to `Probe-Staff-12345!`.
function normalizeValue(value) {
  let normalized = value.replace(/^['"]/, '');
  while (/['"`;,)\]}]$/.test(normalized)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function isAllowed(path, rawValue, allowlist) {
  const value = extractValue(rawValue);
  const normalized = normalizeValue(value);
  const candidates = [value, normalized];
  // 1. Documented placeholder values.
  if (candidates.some((candidate) => candidate === '...')) return true;
  if (candidates.some((candidate) => candidate.startsWith('change-me-'))) return true;
  // 2. Environment references (same class as the already-excluded ${VAR}).
  if (candidates.some((candidate) => candidate.startsWith('process.env.'))) return true;
  // 3. Exact, path-scoped synthetic/sentinel test credentials.
  return allowlist.some((entry) => entry.path === path && candidates.includes(entry.value));
}

async function main() {
  const allowlist = loadAllowlist();
  const input = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  for await (const line of input) {
    if (line.trim() === '') continue;
    const firstColon = line.indexOf(':');
    const secondColon = line.indexOf(':', firstColon + 1);
    if (firstColon === -1 || secondColon === -1) {
      process.stderr.write(`secret scan line is not path:line:content — ${line}\n`);
      process.exitCode = 1;
      continue;
    }
    const path = normalizePath(line.slice(0, firstColon));
    const content = line.slice(secondColon + 1);
    const match = content.match(SECRET_PATTERN);
    if (!match) {
      // A scan line that no longer matches the pattern is stale evidence;
      // keep it visible so the scan contract stays honest.
      process.stdout.write(`${line}\n`);
      continue;
    }
    if (!isAllowed(path, match[0], allowlist)) {
      process.stdout.write(`${line}\n`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
