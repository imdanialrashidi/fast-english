#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { lstatSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateRecords,
  analyzeTrace,
  compareSummaries,
  evaluateDeterministic,
  renderSummaryMarkdown,
  runCaseChecks,
  selectedCases,
  validateSuite,
} from './lib/workflow-evals.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

function requiredValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function parseArgs(argv) {
  const options = {
    casesPath: path.join(repositoryRoot, 'evals/cases.json'),
    trials: undefined,
    model: undefined,
    thinking: undefined,
    filter: undefined,
    baselinePath: undefined,
    dryRun: false,
    timeoutMs: 20 * 60 * 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run') options.dryRun = true;
    else if (token === '--cases')
      options.casesPath = path.resolve(requiredValue(argv, index++, token));
    else if (token === '--trials') options.trials = Number(requiredValue(argv, index++, token));
    else if (token === '--model') options.model = requiredValue(argv, index++, token);
    else if (token === '--thinking') options.thinking = requiredValue(argv, index++, token);
    else if (token === '--filter') options.filter = requiredValue(argv, index++, token);
    else if (token === '--baseline')
      options.baselinePath = path.resolve(requiredValue(argv, index++, token));
    else if (token === '--timeout-ms')
      options.timeoutMs = Number(requiredValue(argv, index++, token));
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function evaluationFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: repositoryRoot, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  return filterMaterializedEvaluationFiles(output.toString('utf8').split('\0').filter(Boolean));
}

export function filterMaterializedEvaluationFiles(files, root = repositoryRoot) {
  return files.filter((relative) => {
    try {
      lstatSync(path.join(root, relative));
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  });
}

function assertSafeEvaluationPath(relative) {
  const normalized = relative.split(path.sep).join('/');
  const sensitiveName =
    /(^|\/)(?:\.env(?:\.|$)|\.npmrc$|\.pypirc$|\.netrc$|storageState.*\.json$)|\.(?:pem|key|p12|pfx|jks|keystore)$/i;
  const sensitiveSegment =
    /(^|\/)(?:docs\/private|playwright\/\.auth|server\/pb_data|\.ssh|\.gnupg|\.aws|\.kube|\.pi\/(?:auth\.json|models\.json|sessions|mcp-oauth))(?:\/|$)/i;
  const allowedExample = path.posix.basename(normalized) === '.env.example';
  if (!allowedExample && (sensitiveName.test(normalized) || sensitiveSegment.test(normalized))) {
    throw new Error(`Refusing to copy sensitive evaluation input: ${normalized}`);
  }
  return normalized;
}

async function copyRepository(destination, files = evaluationFiles()) {
  for (const relative of files) {
    const normalized = assertSafeEvaluationPath(relative);
    const source = path.join(repositoryRoot, relative);
    const target = path.join(destination, relative);
    const sourceStat = await fs.lstat(source);
    await fs.mkdir(path.dirname(target), { recursive: true });

    if (sourceStat.isSymbolicLink()) {
      const link = await fs.readlink(source);
      if (path.isAbsolute(link))
        throw new Error(`Refusing absolute evaluation symlink: ${normalized}`);
      const resolved = path.resolve(path.dirname(source), link);
      const insideRepository =
        resolved === repositoryRoot || resolved.startsWith(`${repositoryRoot}${path.sep}`);
      if (!insideRepository) throw new Error(`Refusing external evaluation symlink: ${normalized}`);
      await fs.symlink(link, target);
    } else if (sourceStat.isFile()) {
      await fs.copyFile(source, target);
      await fs.chmod(target, sourceStat.mode);
    }
  }
}

async function fileManifest(root) {
  const manifest = new Map();
  const excluded = new Set(['.git', '.artifacts', 'node_modules', '.pi/npm']);

  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if ([...excluded].some((value) => relative === value || relative.startsWith(`${value}/`)))
        continue;
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        const content = await fs.readFile(absolute);
        manifest.set(relative, crypto.createHash('sha256').update(content).digest('hex'));
      }
    }
  }

  await walk(root);
  return manifest;
}

function manifestDiff(before, after) {
  const changed = [];
  for (const [file, hash] of before) {
    if (!after.has(file)) changed.push({ file, status: 'deleted' });
    else if (after.get(file) !== hash) changed.push({ file, status: 'modified' });
  }
  for (const file of after.keys()) {
    if (!before.has(file)) changed.push({ file, status: 'added' });
  }
  return changed.sort((left, right) => left.file.localeCompare(right.file));
}

function runRpc({ cwd, prompt, model, thinking, timeoutMs }) {
  return new Promise((resolve) => {
    const args = ['--mode', 'rpc', '--no-session', '--approve'];
    if (model) args.push('--model', model);
    if (thinking) args.push('--thinking', thinking);

    const child = spawn('pi', args, {
      cwd,
      env: {
        ...process.env,
        PI_TELEMETRY: '0',
        PI_SKIP_VERSION_CHECK: '1',
        PI_GUARD_MODE: 'autonomous',
        PI_GUARD_FILE_SCOPE: 'repository',
        PI_GIT_MUTATION: 'deny',
        AI_PR_DELIVERY: 'off',
        PI_GUARD_EXTERNAL_MUTATION: 'deny',
        PI_PROJECT_ROOT: cwd,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const startedAt = Date.now();
    const eventLines = [];
    let stderr = '';
    let stdoutBuffer = '';
    let stats;
    let completion = 'process-exited';
    let statsRequested = false;
    let forcedTimer;

    const timeout = setTimeout(() => {
      completion = 'timeout';
      child.kill('SIGTERM');
      forcedTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
    }, timeoutMs);

    function requestStats() {
      if (statsRequested) return;
      statsRequested = true;
      child.stdin.write(`${JSON.stringify({ id: 'eval-stats', type: 'get_session_stats' })}\n`);
    }

    function consumeLine(line) {
      if (!line) return;
      eventLines.push(line);
      try {
        const event = JSON.parse(line);
        if (event.type === 'agent_settled') requestStats();
        if (event.type === 'response' && event.id === 'eval-stats') {
          stats = event.data;
          completion = event.success ? 'completed' : 'stats-failed';
          child.stdin.end();
          forcedTimer = setTimeout(() => child.kill('SIGTERM'), 1000);
        }
      } catch {
        completion = 'invalid-jsonl';
      }
    }

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf8');
      let newlineIndex = stdoutBuffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '');
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        consumeLine(line);
        newlineIndex = stdoutBuffer.indexOf('\n');
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.stdin.on('error', (error) => {
      stderr += `stdin error: ${error.message}\n`;
    });
    child.on('error', (error) => {
      completion = `spawn-error: ${error.message}`;
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      clearTimeout(forcedTimer);
      consumeLine(stdoutBuffer.replace(/\r$/, ''));
      resolve({
        completion,
        durationMs: Date.now() - startedAt,
        exitCode,
        signal,
        stats,
        stderr,
        events: eventLines,
      });
    });
    child.stdin.write(
      `${JSON.stringify({ id: 'eval-prompt', type: 'prompt', message: 'This is an isolated local-only evaluation. Do not commit, push, open/update a PR, or invoke the PR delivery helper.\n\n' + prompt })}\n`,
    );
  });
}

async function validateDisposableCopy(files) {
  const dryRunRoot = path.join(repositoryRoot, '.artifacts');
  await fs.mkdir(dryRunRoot, { recursive: true });
  const workspace = await fs.mkdtemp(path.join(dryRunRoot, 'eval-dry-run-'));
  try {
    await copyRepository(workspace, files);
    const copied = await fileManifest(workspace);
    const missing = files.filter(
      (file) => !copied.has(file) && !lstatSync(path.join(workspace, file)).isSymbolicLink(),
    );
    if (missing.length)
      throw new Error(`Disposable evaluation copy is incomplete: ${missing.join(', ')}`);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
  return files.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const suite = validateSuite(JSON.parse(await fs.readFile(options.casesPath, 'utf8')));
  const cases = selectedCases(suite, options.filter);
  const trials = options.trials ?? suite.defaultTrials;
  if (!Number.isInteger(trials) || trials < 1)
    throw new Error('trials must be a positive integer.');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000)
    throw new Error('timeout-ms must be at least 1000.');
  if (cases.length === 0) throw new Error('No evaluation cases match the filter.');

  const files = evaluationFiles();
  files.forEach(assertSafeEvaluationPath);
  if (options.dryRun) {
    await validateDisposableCopy(files);
    process.stdout.write(
      `Valid v2 suite: ${cases.length} selected case(s), ${trials} trial(s) each; ${files.length} safe input file(s).\n`,
    );
    for (const item of cases) {
      process.stdout.write(
        `- ${item.id} [${item.tags.join(', ')}] — ${item.assertions.changes.mode} changes, ${item.rubric.length} rubric item(s)\n`,
      );
    }
    return;
  }

  if (!options.model)
    throw new Error(
      '--model is required for paid/external evaluation runs; review provider and data policy first.',
    );
  const piProbe = spawnSync('pi', ['--version'], { encoding: 'utf8' });
  if (piProbe.error || piProbe.status !== 0) {
    throw new Error(
      'Pi CLI is unavailable; install the reviewed version and run scripts/pi-doctor.sh first.',
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputRoot = path.join(repositoryRoot, '.artifacts/evals', timestamp);
  await fs.mkdir(outputRoot, { recursive: true });
  const summary = {
    schemaVersion: 2,
    startedAt: new Date().toISOString(),
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim(),
    sourceStatus: execFileSync('git', ['status', '--short'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim(),
    casesPath: path.relative(repositoryRoot, options.casesPath),
    suiteFingerprint: crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          version: suite.version,
          promotion: suite.promotion ?? null,
          cases,
        }),
      )
      .digest('hex'),
    selectedCaseIds: cases.map((item) => item.id),
    nodeVersion: process.versions.node,
    piVersion: piProbe.stdout.trim(),
    model: options.model,
    thinking: options.thinking ?? null,
    trials,
    timeoutMs: options.timeoutMs,
    cases: [],
  };

  for (const item of cases) {
    for (let trial = 1; trial <= trials; trial += 1) {
      const trialRoot = path.join(outputRoot, `${item.id}--${trial}`);
      const workspace = path.join(trialRoot, 'workspace');
      await fs.mkdir(trialRoot, { recursive: true });
      await copyRepository(workspace, files);
      const before = await fileManifest(workspace);
      const result = await runRpc({
        cwd: workspace,
        prompt: item.prompt,
        model: options.model,
        thinking: options.thinking,
        timeoutMs: options.timeoutMs,
      });
      const afterAgent = await fileManifest(workspace);
      const checkResults = runCaseChecks(workspace, item.checks);
      const afterChecks = await fileManifest(workspace);
      const checkMutations = manifestDiff(afterAgent, afterChecks);
      if (checkMutations.length) {
        checkResults.push({
          id: 'check-workspace-cleanliness',
          status: 'FAIL',
          exitCode: null,
          signal: null,
          error: `Post-check mutated workspace: ${checkMutations.map((change) => change.file).join(', ')}`,
          stdout: '',
          stderr: '',
        });
      }
      const record = {
        id: item.id,
        tags: item.tags,
        rubric: item.rubric,
        rubricStatus: 'UNSCORED',
        trial,
        completion: result.completion,
        durationMs: result.durationMs,
        exitCode: result.exitCode,
        signal: result.signal,
        stats: result.stats ?? null,
        trace: analyzeTrace(result.events),
        changes: manifestDiff(before, afterAgent),
        checkResults,
      };
      record.deterministic = evaluateDeterministic(item, record);
      await fs.writeFile(path.join(trialRoot, 'prompt.txt'), `${item.prompt}\n`);
      await fs.writeFile(path.join(trialRoot, 'events.jsonl'), `${result.events.join('\n')}\n`);
      await fs.writeFile(path.join(trialRoot, 'stderr.log'), result.stderr);
      await fs.writeFile(
        path.join(trialRoot, 'result.json'),
        `${JSON.stringify(record, null, 2)}\n`,
      );
      summary.cases.push(record);
      process.stdout.write(
        `${item.id} trial ${trial}: ${record.deterministic.status} / ${record.completion} (${record.durationMs} ms, ${record.trace.toolCalls} tools)\n`,
      );
    }
  }

  summary.finishedAt = new Date().toISOString();
  summary.aggregate = aggregateRecords(summary.cases);
  if (options.baselinePath) {
    const baseline = JSON.parse(await fs.readFile(options.baselinePath, 'utf8'));
    summary.baselinePath = options.baselinePath;
    summary.comparison = compareSummaries(summary, baseline, suite.promotion);
  }
  await fs.writeFile(
    path.join(outputRoot, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await fs.writeFile(path.join(outputRoot, 'summary.md'), renderSummaryMarkdown(summary));
  process.stdout.write(`Evaluation artifacts: ${outputRoot}\n`);

  if (summary.aggregate.deterministicPassRate < 1 || summary.comparison?.decision === 'REJECT') {
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
