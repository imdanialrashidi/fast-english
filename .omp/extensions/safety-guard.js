import { existsSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sensitiveNames = [
  /^\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx|jks|keystore)$/i,
  /^storageState.*\.json$/i,
  /^(?:agent\.db(?:-wal|-shm)?|\.npmrc|\.netrc|\.pypirc|credentials\.json)$/i,
  /^config\.local\.ya?ml$/i,
];

const sensitiveSegments = [
  '.git',
  'playwright/.auth',
  'server/pb_data',
  '.ssh',
  '.gnupg',
  '.aws',
  '.kube',
  '.config/gcloud',
  'docs/private',
  '.omp/sessions',
  '.omp/mcp-oauth',
];

const workflowPaths = [
  'AGENTS.md',
  '.omp',
  '.github/workflows',
  'docs/HARNESS.md',
  'docs/GIT_POLICY.md',
  'docs/exec-plans/README.md',
  'scripts/verify.sh',
  'scripts/verify-fast.sh',
  'scripts/verify-feature.sh',
  'scripts/verify-full.sh',
  'scripts/omp-doctor.sh',
  'scripts/run-workflow-evals.mjs',
  'scripts/lib/workflow-evals.mjs',
  'scripts/ai-pr.mjs',
];

const readOnlyGitSubcommands = new Set([
  'archive',
  'blame',
  'cat-file',
  'check-attr',
  'check-ignore',
  'count-objects',
  'describe',
  'diff',
  'diff-tree',
  'for-each-ref',
  'grep',
  'help',
  'log',
  'ls-files',
  'ls-remote',
  'ls-tree',
  'merge-base',
  'name-rev',
  'rev-list',
  'rev-parse',
  'shortlog',
  'show',
  'show-ref',
  'status',
  'version',
  'whatchanged',
]);

const githubMutationVerb =
  /(?:^|[_.:/-])(?:add|archive|close|convert|create|delete|disable|dismiss|enable|label|lock|mark|merge|publish|push|remove|reopen|reply|request|rerun|resolve|restore|submit|sync|transfer|unlock|unpublish|unresolve|update)(?:[_.:/-]|$)/i;

function guardConfig(cwd) {
  const mode = String(process.env.OMP_GUARD_MODE ?? 'autonomous').toLowerCase();
  const fileScope = String(process.env.OMP_GUARD_FILE_SCOPE ?? 'repository').toLowerCase();
  const gitMutation = String(process.env.OMP_GIT_MUTATION ?? 'deny').toLowerCase();
  const externalMutation = String(process.env.OMP_GUARD_EXTERNAL_MUTATION ?? 'deny').toLowerCase();
  const projectRoot = normalizePath(process.env.OMP_PROJECT_ROOT ?? cwd, cwd);

  if (!['autonomous', 'strict'].includes(mode)) {
    return { error: 'OMP_GUARD_MODE must be autonomous or strict.' };
  }
  if (!['full', 'repository'].includes(fileScope)) {
    return { error: 'OMP_GUARD_FILE_SCOPE must be full or repository.' };
  }
  if (!['deny', 'allow'].includes(gitMutation)) {
    return { error: 'OMP_GIT_MUTATION must be deny or allow.' };
  }
  if (!['deny', 'allow'].includes(externalMutation)) {
    return { error: 'OMP_GUARD_EXTERNAL_MUTATION must be deny or allow.' };
  }
  return {
    strict: mode === 'strict',
    fileScope,
    gitMutation,
    externalMutation,
    projectRoot,
  };
}

function expandHome(value) {
  if (typeof value !== 'string') return '';
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  if (value.startsWith('~')) return path.join(os.homedir(), value.slice(1));
  return value;
}

function normalizePath(value, cwd) {
  const absolute = path.resolve(cwd, expandHome(value));
  // Resolve the nearest existing ancestor as well as an existing file, so a
  // symlinked directory cannot evade the repository write/credential checks.
  let ancestor = absolute;
  const tail = [];
  while (!existsSync(ancestor) && path.dirname(ancestor) !== ancestor) {
    tail.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  try {
    return path.join(realpathSync(ancestor), ...tail);
  } catch {
    return absolute;
  }
}

function slash(value) {
  return value.replaceAll(path.sep, '/');
}

function isInside(absolutePath, root) {
  const relative = path.relative(root, absolutePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function relativeTo(absolutePath, root) {
  return slash(path.relative(root, absolutePath));
}

function isAllowedExampleEnv(relativePath) {
  const base = path.posix.basename(relativePath);
  return (
    base === '.env.example' ||
    base.endsWith('.env.example') ||
    base.endsWith('.env.sample') ||
    base.endsWith('.env.template')
  );
}

function sensitivePathReason(absolutePath, projectRoot) {
  const normalized = slash(absolutePath);
  const relative = relativeTo(absolutePath, projectRoot);
  const base = path.posix.basename(normalized);

  if (sensitiveNames.some((pattern) => pattern.test(base)) && !isAllowedExampleEnv(relative)) {
    return `Sensitive file access is blocked: ${relative || normalized}`;
  }
  if (
    sensitiveSegments.some(
      (segment) =>
        normalized === segment ||
        normalized.endsWith(`/${segment}`) ||
        normalized.includes(`/${segment}/`),
    )
  ) {
    return `Sensitive directory access is blocked: ${relative || normalized}`;
  }
  return null;
}

function protectedWriteReason(absolutePath, config) {
  const outsideProject = !isInside(absolutePath, config.projectRoot);
  const inTemp = isInside(absolutePath, os.tmpdir());
  if ((config.strict || config.fileScope === 'repository') && outsideProject && !inTemp) {
    return `Writes outside the repository and OS temporary directory are blocked: ${slash(absolutePath)}`;
  }

  const relative = relativeTo(absolutePath, config.projectRoot);
  if (
    config.strict &&
    !outsideProject &&
    workflowPaths.some((entry) => relative === entry || relative.startsWith(`${entry}/`))
  ) {
    return `Workflow policy files are locked in strict guard mode: ${relative}`;
  }
  return null;
}

function pathInputs(toolName, input) {
  if (['edit', 'apply_patch'].includes(toolName) && typeof input === 'string')
    return patchPaths(input);
  if (!input || typeof input !== 'object') return [];
  const candidates = [];
  for (const key of ['path', 'filePath', 'file', 'newPath', 'move', 'directory', 'cwd', 'root']) {
    if (typeof input[key] === 'string' && input[key].trim()) candidates.push(input[key]);
  }
  if (toolName === 'lsp' && input.action === 'rename_file' && typeof input.new_name === 'string')
    candidates.push(input.new_name);
  if (Array.isArray(input.paths))
    candidates.push(...input.paths.filter((value) => typeof value === 'string' && value.trim()));
  if (['edit', 'apply_patch'].includes(toolName)) {
    const wire = input.input ?? input.patch;
    if (typeof wire === 'string') candidates.push(...patchPaths(wire));
    if (!candidates.length)
      throw new Error(
        'Unrecognized native edit contract; use a canonical patch or an explicit path.',
      );
  }
  return [...new Set(candidates)];
}

// Inspect paths only; OMP still owns parsing, anchors, validation and application.
// Accept canonical native hashline/apply_patch, not the runtime's fuzzy recovery.
export function patchPaths(input) {
  const paths = [];
  const hashline = /^\s*\[[^\r\n]+#[A-F0-9]{4}\]\s*$/m.test(input);
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === '*** Begin Patch' || line === '*** End Patch') continue;
    if (hashline) {
      const header = /^\[([^#\r\n]+)#[A-F0-9]{4}\]$/.exec(line);
      if (header) {
        paths.push(header[1]);
        continue;
      }
      if (line.startsWith('MV ')) {
        let destination = line.slice(3).trim();
        if (destination.startsWith('"')) destination = JSON.parse(destination);
        else if (destination.startsWith("'")) {
          if (!destination.endsWith("'")) throw new Error('Malformed native move path.');
          destination = destination.slice(1, -1);
        }
        if (typeof destination !== 'string' || !destination)
          throw new Error('Missing native move destination.');
        paths.push(destination);
        continue;
      }
      if (/^(?:PUT |CUT |REM$|\+)/.test(line)) continue;
    } else {
      const header = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/.exec(line);
      if (header) {
        paths.push(header[1]);
        continue;
      }
      if (/^(?:@@|\*\*\* End of File$)/.test(line) || /^[ +-]/.test(raw)) continue;
    }
    throw new Error('Noncanonical native patch syntax; policy cannot safely identify all targets.');
  }
  if (!paths.length) throw new Error('Native patch contains no inspectable file targets.');
  return paths;
}

export function localPathForPolicy(value, cwd) {
  let target = value.replace(/^:(?=[/\\~]|\.\.?[/\\])/, '');
  if (/^@(?:\/|~\/|file:\/\/)/.test(target)) target = target.slice(1);
  if (/^file:\/\//i.test(target)) target = fileURLToPath(target);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) return null;
  if (/[\r\n;]/.test(target))
    throw new Error('Use one exact local path, not native delimited-path recovery.');
  // Literal filenames win, just as in the native reader. Otherwise strip the
  // documented line/raw/conflict selectors and SQLite table/query suffixes.
  if (!existsSync(path.resolve(cwd, expandHome(target)))) {
    const range = 'L?\\d+(?:(?:-|\\.\\.|\\+)L?\\d*)?';
    const selector = new RegExp(`:(?:raw|conflicts|${range}(?:,${range})*)$`, 'i');
    for (let index = 0; index < 2; index++) target = target.replace(selector, '');
    target = target.replace(/(\.(?:sqlite3?|db3?))[:?].*$/i, '$1');
  }
  return normalizePath(target, cwd);
}

function commandContainsSensitivePath(command) {
  const scrubbed = command
    .replaceAll('.env.example', '')
    .replaceAll('.env.sample', '')
    .replaceAll('.env.template', '');
  return [
    /(^|[\s"'=])\.env(?:[\s"'./]|$)/i,
    /(^|[\s"'=])(?:~\/)?\.(?:ssh|gnupg|aws|kube)(?:\/|[\s"']|$)/i,
    /playwright\/\.auth/i,
    /storageState.*\.json/i,
    /server\/pb_data/i,
    /(?:agent\.db(?:-wal|-shm)?|\.npmrc|\.netrc|\.pypirc|credentials\.json|config\.local\.ya?ml)(?:[\s"'|;&/]|$)/i,
    /\.(?:pem|key|p12|pfx|jks|keystore)(?:[\s"'|;&]|$)/i,
  ].some((pattern) => pattern.test(scrubbed));
}

function commandMutatesProtectedWorkflow(command, config) {
  if (!config.strict) return false;
  const referencesProtected = [
    /(^|[\s"'=])AGENTS\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])\.omp\//,
    /(^|[\s"'=])\.github\/workflows\//,
    /(^|[\s"'=])docs\/(?:HARNESS|GIT_POLICY)\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])docs\/exec-plans\/README\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])scripts\/(?:verify(?:-(?:fast|feature|full))?|omp-doctor|run-workflow-evals|ai-pr)\.(?:sh|mjs)/,
  ].some((pattern) => pattern.test(command));
  if (!referencesProtected) return false;
  return [
    /\bsed\s+-[^;\n]*i\b/,
    /\bperl\s+-[^;\n]*i\b/,
    /\btee\b/,
    /\btruncate\b/,
    /\btouch\b/,
    /\b(?:cp|mv|rm|install)\b/,
    /(^|[^<])>>?/,
  ].some((pattern) => pattern.test(command));
}

function shellWords(segment) {
  return (
    segment.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/g)?.map((word) => {
      if (
        (word.startsWith('"') && word.endsWith('"')) ||
        (word.startsWith("'") && word.endsWith("'"))
      ) {
        return word.slice(1, -1);
      }
      return word;
    }) ?? []
  );
}

function isGitBinary(word) {
  return /(?:^|[\\/])git(?:\.exe)?$/i.test(word);
}

function isGhBinary(word) {
  return /(?:^|[\\/])gh(?:\.exe)?$/i.test(word);
}

function gitInvocation(words, gitIndex) {
  let index = gitIndex + 1;
  const optionsWithValue = new Set([
    '-C',
    '-c',
    '--config-env',
    '--exec-path',
    '--git-dir',
    '--namespace',
    '--super-prefix',
    '--work-tree',
  ]);
  while (index < words.length) {
    const word = words[index];
    if (['--help', '--version'].includes(word)) return { subcommand: word.slice(2), args: [] };
    if (optionsWithValue.has(word)) {
      index += 2;
      continue;
    }
    if (/^--(?:config-env|exec-path|git-dir|namespace|super-prefix|work-tree)=/.test(word)) {
      index += 1;
      continue;
    }
    if (word.startsWith('-')) {
      index += 1;
      continue;
    }
    return { subcommand: word.toLowerCase(), args: words.slice(index + 1) };
  }
  return null;
}

function isReadOnlyGitInvocation(subcommand, args) {
  if (readOnlyGitSubcommands.has(subcommand)) return true;
  const joined = args.join(' ').trim();
  if (subcommand === 'branch') {
    if (!joined) return true;
    if (
      /(?:^|\s)(?:-[dDmMcC]|--delete|--move|--copy|--edit-description|--set-upstream-to|--unset-upstream)(?:\s|$|=)/.test(
        joined,
      )
    )
      return false;
    return /(?:^|\s)(?:--show-current|--list|-a|--all|-r|--remotes|-v|-vv|--verbose|--contains|--no-contains|--merged|--no-merged|--points-at|--format|--sort)(?:\s|$|=)/.test(
      joined,
    );
  }
  if (subcommand === 'config') {
    return /(?:^|\s)(?:--get|--get-all|--get-regexp|--get-urlmatch|--list|-l|--show-origin|--show-scope)(?:\s|$|=)/.test(
      joined,
    );
  }
  if (subcommand === 'remote') {
    return !joined || /^(?:-v|--verbose|show(?:\s|$)|get-url(?:\s|$))/.test(joined);
  }
  if (subcommand === 'tag') {
    return (
      !joined ||
      /(?:^|\s)(?:--list|-l|--contains|--no-contains|--merged|--no-merged|--points-at|--format|--sort|--verify|-v)(?:\s|$|=)/.test(
        joined,
      )
    );
  }
  if (subcommand === 'stash') return /^(?:list|show)(?:\s|$)/.test(joined);
  if (subcommand === 'worktree') return /^list(?:\s|$)/.test(joined);
  if (subcommand === 'submodule') return /^(?:status|summary)(?:\s|$)/.test(joined);
  if (subcommand === 'lfs') return /^(?:ls-files|status|logs)(?:\s|$)/.test(joined);
  return false;
}

function ghInvocation(words, ghIndex) {
  let index = ghIndex + 1;
  const optionsWithValue = new Set(['-R', '--repo', '--hostname']);
  while (index < words.length) {
    const word = words[index];
    if (['--help', '--version'].includes(word)) return { command: word.slice(2), args: [] };
    if (optionsWithValue.has(word)) {
      index += 2;
      continue;
    }
    if (/^--(?:repo|hostname)=/.test(word)) {
      index += 1;
      continue;
    }
    if (word.startsWith('-')) {
      index += 1;
      continue;
    }
    return { command: word.toLowerCase(), args: words.slice(index + 1) };
  }
  return null;
}

function isReadOnlyGhInvocation(command, args) {
  if (['browse', 'completion', 'help', 'search', 'status', 'version'].includes(command))
    return true;
  const [subcommand = ''] = args;
  const readOnlySubcommands = {
    alias: new Set(['list']),
    auth: new Set(['status']),
    cache: new Set(['list']),
    codespace: new Set(['list', 'logs']),
    config: new Set(['get', 'list']),
    extension: new Set(['list']),
    'gpg-key': new Set(['list']),
    issue: new Set(['list', 'status', 'view']),
    label: new Set(['list']),
    pr: new Set(['checks', 'diff', 'list', 'status', 'view']),
    project: new Set(['field-list', 'item-list', 'list', 'view']),
    release: new Set(['download', 'list', 'view']),
    repo: new Set(['list', 'view']),
    run: new Set(['list', 'view', 'watch']),
    secret: new Set(['list']),
    'ssh-key': new Set(['list']),
    variable: new Set(['get', 'list']),
    workflow: new Set(['list', 'view']),
  };
  if (readOnlySubcommands[command]?.has(subcommand.toLowerCase())) return true;
  if (command !== 'api') return false;
  const joined = args.join(' ');
  const method = joined
    .match(
      /(?:^|\s)(?:-X(?:=|\s*)|--method(?:=|\s+))(GET|HEAD|POST|PUT|PATCH|DELETE)(?:\s|$)/i,
    )?.[1]
    ?.toUpperCase();
  if (method && !['GET', 'HEAD'].includes(method)) return false;
  const sendsFields = /(?:^|\s)(?:(?:-f|-F)\S*|(?:--field|--raw-field|--input)(?:=|\s|$))/.test(
    joined,
  );
  return Boolean(method) || !sendsFields;
}

function hasGitMutation(text, depth = 0) {
  const source = String(text ?? '');
  if (depth > 3) return true;
  for (const match of source.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
    if (hasGitMutation(match[1] ?? match[2], depth + 1)) return true;
  }
  for (const segment of source.split(/[;&|\n]+/)) {
    const words = shellWords(segment);
    for (let index = 0; index < words.length; index += 1) {
      if (
        /(?:^|[\\/])ai-pr\.mjs$/.test(words[index]) &&
        /(?:^|[\\/])node(?:\.exe)?$/.test(words[index - 1] ?? '')
      )
        return true;
      if (/(?:^|[\\/])(?:ba|z|k|c|da)?sh(?:\.exe)?$/i.test(words[index])) {
        const commandOption = words.findIndex(
          (word, optionIndex) => optionIndex > index && /^-[^-]*c/.test(word),
        );
        if (
          commandOption >= 0 &&
          words[commandOption + 1] &&
          hasGitMutation(words[commandOption + 1], depth + 1)
        )
          return true;
      }
      if (
        words[index] === 'eval' &&
        words[index + 1] &&
        hasGitMutation(words.slice(index + 1).join(' '), depth + 1)
      )
        return true;
      if (isGitBinary(words[index])) {
        const invocation = gitInvocation(words, index);
        if (invocation && !isReadOnlyGitInvocation(invocation.subcommand, invocation.args))
          return true;
      }
      if (isGhBinary(words[index])) {
        const invocation = ghInvocation(words, index);
        if (invocation && !isReadOnlyGhInvocation(invocation.command, invocation.args)) return true;
      }
    }
  }
  return false;
}

export function isGitMutationCommand(text) {
  return hasGitMutation(text);
}

export function isGitMutationTool(toolName) {
  const name = String(toolName ?? '');
  const repositoryContext = /github|pull[_.:/-]?request|(?:^|[_.:/-])pr(?:[_.:/-]|$)/i.test(name);
  return repositoryContext && githubMutationVerb.test(name);
}

// xd:// is OMP's native lazy transport, not a filesystem path or a new tool.
// Unwrap it for the same policy and eval accounting as a direct invocation.
export function canonicalToolCall(toolName, input = {}) {
  if (toolName === 'write' && typeof input.path === 'string' && input.path.startsWith('xd://')) {
    const target = input.path.slice(5);
    if (!/^[a-zA-Z0-9_:-]+$/.test(target)) throw new Error('Invalid xd:// tool target.');
    if (/^\s*(?:help|\?|schema)?\s*$/i.test(input.content ?? ''))
      return { toolName: 'read', input: {} };
    const payload = JSON.parse(input.content);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('xd:// input must be a JSON object.');
    if (target === 'write' && typeof payload.path === 'string' && payload.path.startsWith('xd://'))
      throw new Error('Nested lazy dispatch is not an inspectable workflow call.');
    return { toolName: target, input: payload };
  }
  return { toolName, input };
}

export function isNativeGitMutation(toolName, input = {}) {
  const call = canonicalToolCall(toolName, input);
  if (call.toolName === 'github') {
    return ![
      'repo_view',
      'file_read',
      'search_issues',
      'search_prs',
      'search_code',
      'search_commits',
      'search_repos',
      'run_watch',
    ].includes(call.input.op);
  }
  return (
    isGitMutationTool(call.toolName) ||
    (call.toolName === 'bash' && isGitMutationCommand(call.input.command))
  );
}

function directGitMetadataWrite(command) {
  return String(command ?? '')
    .split(/[;&|\n]+/)
    .some(
      (segment) =>
        /(?:^|[\s"'=:(\\/])\.git(?:[\\/]|(?=$|[\s'";:)]))/i.test(segment) &&
        /(?:^|\s)(?:(?:rm|mv|cp|install|touch|truncate|tee)\b|(?:sed\s+-i|perl\s+-pi)\b|(?:printf|echo)\b[^\n]*(?:>|>>))/i.test(
          segment,
        ),
    );
}

function ownerGitReason() {
  return "Unscoped Git/GitHub mutation is owner-controlled. Routine verified implementation uses node scripts/ai-pr.mjs on the existing ai-changes branch under docs/GIT_POLICY.md. Other writes require the current user's exact authorization and a bounded OMP_GIT_MUTATION=allow session; never use that override for routine PR delivery.";
}

function blockedCommandReason(command, config) {
  const value = String(command ?? '')
    .replace(/\\\n/g, ' ')
    .trim();
  if (!value) return null;

  const gitWrite = isGitMutationCommand(value);
  const words = shellWords(value);
  const prHelper =
    words[0] === 'node' &&
    ['scripts/ai-pr.mjs', './scripts/ai-pr.mjs'].includes(words[1]) &&
    ['prepare', 'deliver'].includes(words[2]) &&
    !/[;&|<>`$\\\r\n]/.test(value);
  if (prHelper && (config.strict || (process.env.AI_PR_DELIVERY ?? 'on') !== 'on')) {
    return 'Automatic PR delivery is disabled in strict, local-only, or evaluation sessions.';
  }
  if (gitWrite && config.gitMutation !== 'allow' && !prHelper) return ownerGitReason();
  if (directGitMetadataWrite(value)) {
    return 'Direct writes to .git metadata are blocked; leave history, refs, index, and configuration to the owner.';
  }
  if (commandContainsSensitivePath(value)) {
    return 'Shell access to secrets, credential stores, private keys, auth state, or private database data is blocked.';
  }
  if (commandMutatesProtectedWorkflow(value, config)) {
    return 'Shell mutation of workflow policy files is locked in strict guard mode.';
  }

  const gitCommand = String.raw`\bgit(?:\s+(?:(?:-C|-c|--git-dir|--work-tree)\s+\S+|--[\w-]+(?:=\S+)?))*\s+`;
  const rules = [
    [/(^|[;&|]\s*)(sudo|su|doas|pkexec)\b/i, 'Privilege escalation is blocked.'],
    [/(^|[;&|]\s*)(systemctl|service|crontab)\b/i, 'Host service/scheduler mutation is blocked.'],
    [/\brm\s+(?:--recursive|-[A-Za-z]*[rR][A-Za-z]*)(?=\s|$)/, 'Recursive deletion is blocked.'],
    [/\bfind\b[^\n;&|]*\s-delete\b/i, 'Recursive find deletion is blocked.'],
    [
      /\b(?:shred|dd|mkfs(?:\.\w+)?|mount|umount|chown)\b/i,
      'Destructive host/filesystem mutation is blocked.',
    ],
    [/\bchmod\s+-R\s+777\b/i, 'Recursive world-writable permissions are blocked.'],
    [
      new RegExp(`${gitCommand}reset\\b[^\\n;&|]*(?:--(?:hard|merge|keep)|-[^\\s]*h)`, 'i'),
      'Destructive Git reset is blocked.',
    ],
    [
      new RegExp(`${gitCommand}clean\\b[^\\n;&|]*(?:--force|-[^\\s]*f)`, 'i'),
      'Destructive Git clean is blocked.',
    ],
    [
      new RegExp(`${gitCommand}checkout\\b`, 'i'),
      'Git checkout is blocked; use an explicitly authorized switch or targeted edit.',
    ],
    [
      new RegExp(`${gitCommand}restore\\b`, 'i'),
      'Discarding or rewriting index/worktree state with Git restore is blocked.',
    ],
    [
      new RegExp(
        `${gitCommand}push\\b[^\\n;&|]*(?:--force(?:-with-lease|-if-includes)?|\\s-[A-Za-z]*f[A-Za-z]*(?:\\s|$)|--mirror|--delete)`,
        'i',
      ),
      'Forced, mirrored, or deleting Git push is blocked.',
    ],
    [
      new RegExp(`${gitCommand}push\\b[^\\n;&|]*\\s+:[^\\s]+`, 'i'),
      'Deleting a remote ref through Git push is blocked.',
    ],
    [new RegExp(`${gitCommand}branch\\s+-D\\b`, 'i'), 'Forced branch deletion is blocked.'],
    [new RegExp(`${gitCommand}worktree\\s+remove\\b`, 'i'), 'Worktree deletion is blocked.'],
    [
      new RegExp(`${gitCommand}remote\\s+(?:set-url|remove)\\b`, 'i'),
      'Git remote mutation is blocked.',
    ],
    [
      /\b(?:npm|pnpm|bun)\s+(?:install|add|i)\s+(?:-g|--global)\b/i,
      'Global package installation is blocked.',
    ],
    [/\byarn\s+global\b/i, 'Global package installation is blocked.'],
    [/\b(?:curl|wget)\b[^|]*\|\s*(?:sh|bash)\b/i, 'Remote script execution is blocked.'],
    [/(^|[;&|]\s*)(ssh|scp|sftp)\b/i, 'Remote shell/file transfer is blocked.'],
    [/\brsync\b[^\n;&|]*:[^\n;&|]*/i, 'Remote rsync is blocked.'],
  ];

  if (config.externalMutation !== 'allow') {
    rules.push(
      [
        /\b(?:npm|pnpm|bun|cargo)\s+(?:publish|version)\b/i,
        'Package publication requires OMP_GUARD_EXTERNAL_MUTATION=allow.',
      ],
      [/\btwine\s+upload\b/i, 'Package publication requires OMP_GUARD_EXTERNAL_MUTATION=allow.'],
      [
        /\bdocker\s+(?:push|system\s+prune|volume\s+prune)\b/i,
        'Container publication/destructive pruning requires explicit external scope.',
      ],
      [/\b(?:kubectl|helm)\b/i, 'Cluster mutation requires OMP_GUARD_EXTERNAL_MUTATION=allow.'],
      [
        /\bterraform\s+(?:apply|destroy|import|state\s+rm)\b/i,
        'Infrastructure mutation requires OMP_GUARD_EXTERNAL_MUTATION=allow.',
      ],
      [
        /\bansible-playbook\b/i,
        'Infrastructure mutation requires OMP_GUARD_EXTERNAL_MUTATION=allow.',
      ],
      [
        /\b(?:vercel|netlify|wrangler|fly|firebase)\s+(?:deploy|--prod)\b/i,
        'Deployment requires OMP_GUARD_EXTERNAL_MUTATION=allow.',
      ],
      [
        /\bsupabase\s+db\s+push\b/i,
        'Remote database mutation requires OMP_GUARD_EXTERNAL_MUTATION=allow.',
      ],
      [
        /\bgh\s+(?:release\s+create|pr\s+(?:merge|close)|repo\s+delete)\b/i,
        'Irreversible or integration-changing GitHub mutation requires explicit external scope.',
      ],
    );
  }

  if (config.strict) {
    if (gitWrite) return 'Git mutation is locked in strict guard mode.';
    rules.push([
      /(^|[;&|]\s*)(?:curl|wget|ssh|scp|rsync|nc|ncat|socat)\b/i,
      'Direct network commands are locked in strict guard mode.',
    ]);
  }
  for (const [pattern, reason] of rules) if (pattern.test(value)) return reason;
  return null;
}

export default function safetyGuard(omp) {
  omp.on('tool_call', async (event, ctx) => {
    const cwd = path.resolve(ctx.cwd);
    const config = guardConfig(cwd);
    if (config.error) return { block: true, reason: config.error };

    try {
      event = { ...event, ...canonicalToolCall(event.toolName, event.input) };
    } catch {
      return {
        block: true,
        reason: 'Malformed native tool dispatch; policy cannot inspect arguments.',
      };
    }

    if (
      event.toolName === 'github' &&
      isNativeGitMutation(event.toolName, event.input) &&
      (config.strict || config.gitMutation !== 'allow' || process.env.AI_PR_DELIVERY === 'off')
    ) {
      return { block: true, reason: ownerGitReason() };
    }
    if (event.toolName === 'github' && (event.input?.force || event.input?.forceWithLease)) {
      return {
        block: true,
        reason: 'Native forced checkout/push cannot bypass the scoped PR helper.',
      };
    }
    if (
      (config.strict || process.env.OMP_EVAL_RUN === '1') &&
      ['eval', 'browser', 'computer', 'security_scan', 'security_publish'].includes(event.toolName)
    ) {
      return {
        block: true,
        reason:
          'Broad execution tools are disabled in strict/evaluation mode. Do not route around this boundary.',
      };
    }
    if (event.toolName === 'task') {
      const tasks = Array.isArray(event.input?.tasks) ? event.input.tasks : [event.input];
      const readOnlyAgents = new Set(['scout', 'reviewer', 'security-reviewer', 'librarian']);
      const writerAgents = new Set(['designer', 'sonic', 'task']);
      const writerTasks = tasks.filter((item) => writerAgents.has(item?.agent));
      if (
        tasks.some(
          (item) =>
            (!readOnlyAgents.has(item?.agent) && !writerAgents.has(item?.agent)) ||
            item?.isolated ||
            item?.apply ||
            item?.merge,
        ) ||
        writerTasks.length > 1
      ) {
        return {
          block: true,
          reason:
            'Use only OMP bundled agents. Keep at most one delegated writer and never auto-apply or merge child work.',
        };
      }
    }
    if (/^mcp[_:]/.test(event.toolName) && config.externalMutation !== 'allow') {
      return {
        block: true,
        reason:
          'New MCP integrations require explicit operator review; no MCP adapter or server is needed for the native workflow.',
      };
    }

    if (isGitMutationTool(event.toolName) && config.gitMutation !== 'allow') {
      return { block: true, reason: ownerGitReason() };
    }

    if (event.toolName === 'bash') {
      const reason = blockedCommandReason(event.input?.command, config);
      if (reason) return { block: true, reason };
      return;
    }

    if (event.toolName === 'browser') {
      if (event.input?.app)
        return {
          block: true,
          reason:
            'Attached browsers, relay profiles and spawned apps are outside the default QA scope.',
        };
      if (event.input?.url) {
        try {
          if (!['http:', 'https:'].includes(new URL(event.input.url).protocol)) throw new Error();
        } catch {
          return { block: true, reason: 'Browser navigation requires a valid HTTP(S) URL.' };
        }
      }
      // browser run is arbitrary host-side code, not just DOM evaluation.
      // Native tools.approval.browser is prompt; this regex is only extra defense.
      if (/uploadFile|setInputFiles/.test(event.input?.code ?? '')) {
        return { block: true, reason: 'Local file upload is outside the default QA scope.' };
      }
    }

    let paths;
    try {
      paths = pathInputs(event.toolName, event.input);
    } catch (error) {
      return { block: true, reason: error.message };
    }
    const lspWrites =
      event.toolName === 'lsp' &&
      ((['rename', 'rename_file'].includes(event.input?.action) && event.input?.apply !== false) ||
        (event.input?.action === 'code_actions' && event.input?.apply === true));
    if (config.strict && (event.toolName === 'ast_edit' || lspWrites)) {
      return {
        block: true,
        reason:
          'Strict mode requires targeted edit/write tools; AST/LSP writes can span files not listed in the input.',
      };
    }
    const isWrite =
      ['write', 'edit', 'apply_patch', 'ast_edit'].includes(event.toolName) || lspWrites;
    for (const inputPath of paths) {
      let absolutePath;
      try {
        absolutePath = localPathForPolicy(inputPath, cwd);
      } catch (error) {
        return { block: true, reason: `Unresolved native local path: ${error.message}` };
      }
      if (absolutePath === null) continue;
      const sensitiveReason = sensitivePathReason(absolutePath, config.projectRoot);
      if (sensitiveReason) return { block: true, reason: sensitiveReason };
      if (event.toolName === 'read' && !existsSync(absolutePath)) {
        return {
          block: true,
          reason:
            'Use an exact existing local path; implicit suffix/path-list recovery can cross credential boundaries.',
        };
      }
      if (isWrite) {
        const writeReason = protectedWriteReason(absolutePath, config);
        if (writeReason) return { block: true, reason: writeReason };
      }
    }
  });
}
