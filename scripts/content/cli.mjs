#!/usr/bin/env node
// scripts/content/cli.mjs — Podcast Slice 3 content pipeline CLI.
//
// Commands:
//   pnpm content:new <slug> [--levels A1,B1,C1]
//   pnpm content:validate <package-dir>
//   pnpm content:plan <package-dir> [--json]
//   pnpm content:import <package-dir> [--yes]
//
// Exit codes (documented in docs/CONTENT_PIPELINE.md):
//   0 = success (valid / planned / imported / no-change)
//   1 = validation or import rejection
//   2 = environment or tool failure (missing env, unreachable server)
//
// The CLI never prints secrets, tokens, transcripts or storage paths.

import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { isatty } from 'node:tty';
import { fileURLToPath } from 'node:url';
import { formatPlanText } from '../../shared/content-package/versioning.ts';
import { CliError, executeImport, requestPlan, resolveBaseUrl, staffLogin } from './auth.mjs';
import { validatePackage } from './parser.mjs';
import { generateTemplate } from './template.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
// FEP_CONTENT_DIR allows tests/tooling to point `content:new` at a
// disposable directory; the default is the repository's package library.
const CONTENT_DIR = process.env.FEP_CONTENT_DIR
  ? resolve(process.env.FEP_CONTENT_DIR)
  : resolve(REPO_ROOT, 'content-packages');

function printLine(text = '') {
  console.log(text);
}

function printValidationResult(result) {
  printLine(result.valid ? 'PASS' : 'FAIL');
  if (result.errors.length > 0) {
    printLine(`Errors (${result.errors.length})`);
    for (const e of result.errors) {
      printLine(`  [${e.code}] ${e.path}: ${e.message}`);
      if (e.suggestion) printLine(`    → ${e.suggestion}`);
    }
  }
  if (result.warnings.length > 0) {
    printLine(`Warnings (${result.warnings.length})`);
    for (const w of result.warnings) {
      printLine(`  [${w.code}] ${w.path}: ${w.message}`);
    }
  }
  if (result.package) {
    const pkg = result.package;
    printLine('Detected media');
    for (const a of pkg.assets) {
      const extra =
        a.width && a.height
          ? ` ${a.width}x${a.height}`
          : a.durationSeconds
            ? ` ${a.durationSeconds}s`
            : '';
      printLine(`  ${a.path} (${a.mimeType}, ${a.sizeBytes} bytes${extra})`);
    }
    printLine('Extracted durations');
    for (const a of pkg.assets) {
      if (a.durationSeconds) printLine(`  ${a.path}: ${a.durationSeconds}s`);
    }
    printLine('Package fingerprint');
    printLine(`  ${pkg.fingerprint}`);
  }
}

async function confirmImport(plan, yesFlag) {
  if (yesFlag) return true;
  if (!isatty(0)) {
    throw new CliError(
      'Import requires explicit confirmation. Pass --yes for automation (non-interactive terminal detected).',
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolvePromise) => {
    rl.question(
      `Import ${plan.contentKey} (v${plan.contentVersion}) as Draft? Type "import" to confirm: `,
      (a) => resolvePromise(a),
    );
  });
  rl.close();
  return answer.trim().toLowerCase() === 'import';
}

async function cmdNew(args) {
  const slug = args._[0];
  if (!slug) throw new CliError('Usage: pnpm content:new <episode-slug> [--levels A1,B1,C1]');
  let levels;
  const levelsArg = args['--levels'] ?? args.levels;
  if (levelsArg) {
    levels = String(levelsArg).split(',');
  }
  const created = generateTemplate(CONTENT_DIR, slug, { levels });
  printLine(`Created package at ${created.dir}`);
  for (const p of created.paths) printLine(`  ${p}`);
  printLine('');
  printLine('Next commands:');
  printLine(`  pnpm content:validate ${created.dir}`);
  printLine(`  pnpm content:plan ${created.dir}`);
  printLine(`  pnpm content:import ${created.dir}`);
  printLine('');
  printLine(
    `Replace every TODO_REPLACE value, add artwork/audio/transcripts, then validate. The template intentionally fails validation.`,
  );
}

async function cmdValidate(args) {
  const dir = args._[0];
  if (!dir) throw new CliError('Usage: pnpm content:validate <package-dir>');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    printLine('FAIL');
    printLine(`  [PACKAGE_DIR_MISSING] ${dir}: no such directory`);
    return 1;
  }
  const result = await validatePackage(resolve(dir));
  printValidationResult(result);
  return result.valid ? 0 : 1;
}

async function cmdPlan(args) {
  const dir = args._[0];
  if (!dir) throw new CliError('Usage: pnpm content:plan <package-dir>');
  const result = await validatePackage(resolve(dir));
  if (!result.valid || !result.package) {
    printLine('FAIL');
    printValidationResult(result);
    return 1;
  }
  const baseUrl = resolveBaseUrl({ localTest: Boolean(args['--local-test']) });
  const token = await staffLogin(baseUrl);
  const serverPlan = await requestPlan(baseUrl, token, result.package);
  if (args['--json']) {
    printLine(JSON.stringify(serverPlan, null, 2));
    return 0;
  }
  // Deterministic text plan (server-authoritative).
  const pkg = result.package;
  const plan = serverPlan.plan ?? serverPlan;
  printLine(formatPlanText(plan, pkg.fingerprint));
  return 0;
}

async function cmdImport(args) {
  const dir = args._[0];
  if (!dir) throw new CliError('Usage: pnpm content:import <package-dir> [--yes]');
  const result = await validatePackage(resolve(dir));
  if (!result.valid || !result.package) {
    printLine('FAIL');
    printValidationResult(result);
    return 1;
  }
  const baseUrl = resolveBaseUrl({ localTest: Boolean(args['--local-test']) });
  const token = await staffLogin(baseUrl);
  const serverPlan = await requestPlan(baseUrl, token, result.package);
  const pkg = result.package;

  if (serverPlan.result === 'no_change') {
    printLine(
      `No change: ${pkg.manifest.contentKey} v${pkg.manifest.contentVersion} is already imported (same fingerprint).`,
    );
    return 0;
  }
  if (serverPlan.result === 'conflict') {
    printLine('CONFLICT: same content version with a different fingerprint.');
    printLine('Increment contentVersion in episode.json and re-run.');
    return 1;
  }
  if (serverPlan.result === 'stale') {
    printLine('STALE: the imported content version is lower than the existing one.');
    return 1;
  }
  if (serverPlan.result === 'rejected') {
    printLine(`REJECTED: category "${pkg.manifest.categoryKey}" does not exist.`);
    printLine('The pipeline never creates Categories; create it first (superuser tooling).');
    return 1;
  }

  printLine(formatPlanText(serverPlan.plan ?? serverPlan, pkg.fingerprint));
  const confirmed = await confirmImport(pkg.manifest, Boolean(args['--yes']));
  if (!confirmed) {
    printLine('Import cancelled.');
    return 1;
  }

  const resultBody = await executeImport(
    baseUrl,
    token,
    resolve(dir),
    pkg,
    serverPlan.planStateHash,
  );
  printLine('Import result');
  printLine(`  status: ${resultBody.status ?? 'completed'}`);
  if (resultBody.summary) {
    for (const [k, v] of Object.entries(resultBody.summary)) {
      printLine(`  ${k}: ${String(v)}`);
    }
  }
  if (resultBody.auditId) printLine(`  auditId: ${resultBody.auditId}`);
  return 0;
}

const COMMANDS = {
  new: cmdNew,
  validate: cmdValidate,
  plan: cmdPlan,
  import: cmdImport,
};

// Flags that take a value. When written space-separated (`--levels A1,B1`),
// the following non-flag token is consumed as the value; `--levels=A1,B1`
// keeps working through the `=` branch below.
const VALUE_FLAGS = new Set(['--levels']);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        args[a.slice(0, eq)] = a.slice(eq + 1);
      } else if (VALUE_FLAGS.has(a) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[a] = argv[++i];
      } else {
        args[a] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function main() {
  const argv = process.argv.slice(2);
  const [command, ...rest] = argv;
  if (!command || !COMMANDS[command]) {
    printLine('Fast English Podcast — Content Package CLI');
    printLine('');
    printLine('Usage:');
    printLine('  pnpm content:new <episode-slug> [--levels A1,B1,C1]');
    printLine('  pnpm content:validate <package-dir>');
    printLine('  pnpm content:plan <package-dir> [--json]');
    printLine('  pnpm content:import <package-dir> [--yes]');
    printLine('');
    printLine('Environment: FEP_PB_URL, FEP_STAFF_EMAIL, FEP_STAFF_PASSWORD (plan/import).');
    return command ? 1 : 0;
  }
  const args = parseArgs(rest);
  try {
    return await COMMANDS[command](args);
  } catch (err) {
    if (err instanceof CliError) {
      printLine(`ERROR: ${err.message}`);
      return err.exitCode ?? 1;
    }
    printLine(`ERROR: ${err?.message ?? String(err)}`);
    return 2;
  }
}

main().then((code) => {
  process.exitCode = code;
});
