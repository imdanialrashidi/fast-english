#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { matchesAnyGlob } from './lib/workflow-evals.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

function assertStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array.`);
  }
  if (value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${label} must contain non-empty strings.`);
  }
}

function validateCommands(commands, label) {
  if (!Array.isArray(commands) || commands.length === 0)
    throw new Error(`${label} must contain commands.`);
  for (const [index, command] of commands.entries()) {
    assertStringArray(command, `${label}[${index}]`);
  }
}

export function validateVerificationConfig(config) {
  if (
    !config ||
    config.version !== 1 ||
    !Array.isArray(config.routes) ||
    config.routes.length === 0
  ) {
    throw new Error('Verification config must have version 1 and at least one route.');
  }
  const ids = new Set();
  for (const route of config.routes) {
    if (!route || typeof route.id !== 'string' || !/^[a-z0-9-]+$/.test(route.id)) {
      throw new Error('Every verification route needs a lowercase hyphenated id.');
    }
    if (ids.has(route.id)) throw new Error(`Duplicate verification route: ${route.id}`);
    ids.add(route.id);
    assertStringArray(route.include, `${route.id}.include`);
    if (route.exclude !== undefined)
      assertStringArray(route.exclude, `${route.id}.exclude`, { allowEmpty: true });
    validateCommands(route.commands, `${route.id}.commands`);
  }
  validateCommands(config.fallback, 'fallback');
  return config;
}

function normalizeFile(file) {
  return file.split(path.sep).join('/').replace(/^\.\//, '');
}

function routeMatches(route, file) {
  return matchesAnyGlob(file, route.include) && !matchesAnyGlob(file, route.exclude ?? []);
}

export function selectVerificationPlan(config, inputFiles) {
  validateVerificationConfig(config);
  const files = [...new Set(inputFiles.map(normalizeFile).filter(Boolean))].sort();
  const routeFiles = new Map(config.routes.map((route) => [route.id, []]));
  const unmatchedFiles = [];

  for (const file of files) {
    let matched = false;
    for (const route of config.routes) {
      if (routeMatches(route, file)) {
        routeFiles.get(route.id).push(file);
        matched = true;
      }
    }
    if (!matched) unmatchedFiles.push(file);
  }

  const commands = new Map();
  function addCommand(command, source) {
    const key = JSON.stringify(command);
    if (!commands.has(key)) commands.set(key, { command, sources: [] });
    commands.get(key).sources.push(source);
  }

  const routes = [];
  for (const route of config.routes) {
    const matchedFiles = routeFiles.get(route.id);
    if (matchedFiles.length === 0) continue;
    routes.push({ id: route.id, files: matchedFiles });
    for (const command of route.commands) addCommand(command, route.id);
  }
  if (unmatchedFiles.length > 0) {
    for (const command of config.fallback) addCommand(command, 'fallback');
  }

  return { files, routes, unmatchedFiles, commands: [...commands.values()] };
}

function parseNullSeparated(value) {
  return value.toString('utf8').split('\0').filter(Boolean).map(normalizeFile);
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: options.encoding ?? 'buffer',
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.stdio,
  });
}

function refExists(reference) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${reference}^{commit}`], {
    cwd: repositoryRoot,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function defaultBaseReference() {
  if (process.env.PI_VERIFY_BASE) return process.env.PI_VERIFY_BASE;
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master', 'HEAD^']) {
    if (refExists(candidate)) return candidate;
  }
  return null;
}

export function discoverChangedFiles(baseReference) {
  const files = new Set();
  const base = baseReference ?? defaultBaseReference();
  if (base) {
    if (!refExists(base)) throw new Error(`Verification base ref does not exist: ${base}`);
    const mergeBase = git(['merge-base', 'HEAD', base], { encoding: 'utf8' }).trim();
    for (const file of parseNullSeparated(
      git(['diff', '--name-only', '-z', '--diff-filter=ACMRD', mergeBase, 'HEAD']),
    ))
      files.add(file);
  }
  for (const file of parseNullSeparated(git(['diff', '--name-only', '-z', '--diff-filter=ACMRD'])))
    files.add(file);
  for (const file of parseNullSeparated(
    git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRD']),
  ))
    files.add(file);
  for (const file of parseNullSeparated(git(['ls-files', '--others', '--exclude-standard', '-z'])))
    files.add(file);
  return { base, files: [...files].sort() };
}

function requiredValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function parseArgs(argv) {
  const options = {
    configPath: path.join(repositoryRoot, '.pi/verification.json'),
    base: undefined,
    files: [],
    planOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--config')
      options.configPath = path.resolve(requiredValue(argv, index++, token));
    else if (token === '--base') options.base = requiredValue(argv, index++, token);
    else if (token === '--file') options.files.push(requiredValue(argv, index++, token));
    else if (token === '--plan') options.planOnly = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function displayCommand(command) {
  return command
    .map((part) => (/^[A-Za-z0-9_./:=@+-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(' ');
}

function runPlan(plan, base) {
  const environment = {
    ...process.env,
    PI_VERIFY_BASE: base ?? '',
    PI_CHANGED_FILES_JSON: JSON.stringify(plan.files),
  };
  for (const item of plan.commands) {
    process.stdout.write(`RUN   ${displayCommand(item.command)} [${item.sources.join(', ')}]\n`);
    const [command, ...args] = item.command;
    const result = spawnSync(command, args, {
      cwd: repositoryRoot,
      env: environment,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `Verification command failed with exit ${result.status}: ${displayCommand(item.command)}`,
      );
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.configPath)) {
    throw new Error(
      `Missing verification routing config: ${options.configPath}. Run /bootstrap or use scripts/verify.sh.`,
    );
  }
  const config = validateVerificationConfig(
    JSON.parse(fs.readFileSync(options.configPath, 'utf8')),
  );
  const discovered =
    options.files.length > 0
      ? { base: options.base ?? null, files: options.files }
      : discoverChangedFiles(options.base);
  const plan = selectVerificationPlan(config, discovered.files);

  if (options.planOnly) {
    process.stdout.write(`${JSON.stringify({ base: discovered.base, ...plan }, null, 2)}\n`);
    return;
  }
  if (plan.files.length === 0) {
    process.stdout.write('No changed files; no affected verification command selected.\n');
    return;
  }
  process.stdout.write(
    `Affected verification: ${plan.files.length} changed file(s), ${plan.routes.length} route(s), ${plan.commands.length} command(s).\n`,
  );
  if (plan.unmatchedFiles.length) {
    process.stdout.write(`Conservative fallback for: ${plan.unmatchedFiles.join(', ')}\n`);
  }
  runPlan(plan, discovered.base);
  process.stdout.write('Affected verification passed.\n');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === path.resolve(import.meta.filename)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
