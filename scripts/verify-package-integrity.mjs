#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const cliArgs = process.argv.slice(2);
const online = cliArgs.includes('--online');
const unexpected = cliArgs.filter((value) => value !== '--online');
if (unexpected.length) throw new Error(`Unknown argument(s): ${unexpected.join(', ')}`);

const manifestPath = path.join(repositoryRoot, '.pi/package-integrity.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const settings = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, '.pi/settings.json'), 'utf8'),
);
const mcp = JSON.parse(fs.readFileSync(path.join(repositoryRoot, '.pi/mcp.json'), 'utf8'));

if (manifest.version !== 1 || !Array.isArray(manifest.packages)) {
  throw new Error('package integrity manifest must be version 1 with a packages array');
}
if (typeof manifest.reviewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.reviewedAt)) {
  throw new Error('package integrity manifest needs an ISO reviewedAt date');
}

const entries = new Map();
for (const entry of manifest.packages) {
  if (!entry || typeof entry.source !== 'string' || !entry.source.startsWith('npm:')) {
    throw new Error('every integrity entry needs an npm: source');
  }
  if (entries.has(entry.source)) throw new Error(`duplicate integrity source: ${entry.source}`);
  if (typeof entry.integrity !== 'string' || !entry.integrity.startsWith('sha512-')) {
    throw new Error(`missing sha512 integrity: ${entry.source}`);
  }
  if (typeof entry.license !== 'string' || entry.license.length === 0) {
    throw new Error(`missing published license metadata: ${entry.source}`);
  }
  if (typeof entry.repository !== 'string' || !entry.repository.startsWith('https://github.com/')) {
    throw new Error(`missing reviewed repository URL: ${entry.source}`);
  }
  entries.set(entry.source, entry);
}

const configured = (settings.packages ?? []).map((entry) =>
  typeof entry === 'string' ? entry : entry?.source,
);
const playwrightSpec = (mcp.mcpServers?.playwright?.args ?? []).find(
  (value) => typeof value === 'string' && value.startsWith('@playwright/mcp@'),
);
if (!playwrightSpec) throw new Error('Playwright MCP pin is missing');
configured.push(`npm:${playwrightSpec}`);
const context7Spec = (mcp.mcpServers?.context7?.args ?? []).find(
  (value) => typeof value === 'string' && value.startsWith('@upstash/context7-mcp@'),
);
if (!context7Spec) throw new Error('Context7 MCP pin is missing');
configured.push(`npm:${context7Spec}`);
const docker = fs.readFileSync(path.join(repositoryRoot, 'Dockerfile.pi'), 'utf8');
const piVersion = docker.match(/^ARG PI_VERSION=(\d+\.\d+\.\d+)$/m)?.[1];
if (!piVersion) throw new Error('Dockerfile Pi pin is missing');
configured.push(`npm:@earendil-works/pi-coding-agent@${piVersion}`);

for (const source of configured) {
  if (!entries.has(source))
    throw new Error(`configured package has no integrity record: ${source}`);
}
for (const source of entries.keys()) {
  if (!configured.includes(source))
    throw new Error(`stale integrity record is not configured: ${source}`);
}

if (online) {
  for (const [source, entry] of entries) {
    const npmSpec = source.slice('npm:'.length);
    const output = execFileSync('npm', ['view', npmSpec, 'dist.integrity', 'license', '--json'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const parsed = JSON.parse(output);
    // `npm view --json` returns an array when the spec resolves to one
    // version (observed for every pinned spec here); unwrap it so the
    // comparison below reads the real record instead of `undefined`.
    const published = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!published || typeof published !== 'object') {
      throw new Error(`registry lookup returned no record for ${source}`);
    }
    if (published['dist.integrity'] !== entry.integrity) {
      throw new Error(
        `registry integrity mismatch for ${source}: reviewed=${entry.integrity} published=${published['dist.integrity']}`,
      );
    }
    if (published.license !== entry.license)
      throw new Error(`registry license mismatch for ${source}`);
    process.stdout.write(`PASS ${source}\n`);
  }
} else {
  process.stdout.write(`Validated ${entries.size} exact package integrity record(s).\n`);
}
