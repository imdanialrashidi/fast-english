import os from "node:os";
import path from "node:path";

const sensitiveNames = [
  /^\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx|jks|keystore)$/i,
  /^storageState.*\.json$/i,
];

const sensitiveSegments = [
  ".git",
  "playwright/.auth",
  "server/pb_data",
  ".ssh",
  ".gnupg",
  ".aws",
  ".kube",
  ".config/gcloud",
];

const workflowPaths = [
  "AGENTS.md",
  "p",
  ".pi",
  ".mcp.json",
  ".github/workflows",
  "docs/HARNESS.md",
  "docs/GIT_POLICY.md",
  "docs/exec-plans/README.md",
  "scripts/verify.sh",
  "scripts/verify-fast.sh",
  "scripts/verify-feature.sh",
  "scripts/verify-full.sh",
  "scripts/pi-doctor.sh",
  "scripts/run-workflow-evals.mjs",
  "scripts/lib/workflow-evals.mjs",
  "scripts/ai-pr.mjs",
];

const readOnlyGitSubcommands = new Set([
  "archive",
  "blame",
  "cat-file",
  "check-attr",
  "check-ignore",
  "count-objects",
  "describe",
  "diff",
  "diff-tree",
  "for-each-ref",
  "grep",
  "help",
  "log",
  "ls-files",
  "ls-remote",
  "ls-tree",
  "merge-base",
  "name-rev",
  "rev-list",
  "rev-parse",
  "shortlog",
  "show",
  "show-ref",
  "status",
  "version",
  "whatchanged",
]);

const githubMutationVerb =
  /(?:^|[_.:/-])(?:add|archive|close|convert|create|delete|disable|dismiss|enable|label|lock|mark|merge|publish|push|remove|reopen|reply|request|rerun|resolve|restore|submit|sync|transfer|unlock|unpublish|unresolve|update)(?:[_.:/-]|$)/i;

function guardConfig(cwd) {
  const mode = String(process.env.PI_GUARD_MODE ?? "autonomous").toLowerCase();
  const fileScope = String(process.env.PI_GUARD_FILE_SCOPE ?? "full").toLowerCase();
  const gitMutation = String(process.env.PI_GIT_MUTATION ?? "deny").toLowerCase();
  const externalMutation = String(process.env.PI_GUARD_EXTERNAL_MUTATION ?? "deny").toLowerCase();
  const projectRoot = path.resolve(process.env.PI_PROJECT_ROOT ?? cwd);

  if (!["autonomous", "strict"].includes(mode)) {
    return { error: "PI_GUARD_MODE must be autonomous or strict." };
  }
  if (!["full", "repository"].includes(fileScope)) {
    return { error: "PI_GUARD_FILE_SCOPE must be full or repository." };
  }
  if (!["deny", "allow"].includes(gitMutation)) {
    return { error: "PI_GIT_MUTATION must be deny or allow." };
  }
  if (!["deny", "allow"].includes(externalMutation)) {
    return { error: "PI_GUARD_EXTERNAL_MUTATION must be deny or allow." };
  }
  return {
    strict: mode === "strict",
    fileScope,
    gitMutation,
    externalMutation,
    projectRoot,
  };
}

function expandHome(value) {
  if (typeof value !== "string") return "";
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function normalizePath(value, cwd) {
  return path.resolve(cwd, expandHome(value));
}

function slash(value) {
  return value.replaceAll(path.sep, "/");
}

function isInside(absolutePath, root) {
  const relative = path.relative(root, absolutePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativeTo(absolutePath, root) {
  return slash(path.relative(root, absolutePath));
}

function isAllowedExampleEnv(relativePath) {
  const base = path.posix.basename(relativePath);
  return base === ".env.example" || base.endsWith(".env.example") ||
    base.endsWith(".env.sample") || base.endsWith(".env.template");
}

function sensitivePathReason(absolutePath, projectRoot) {
  const normalized = slash(absolutePath);
  const relative = relativeTo(absolutePath, projectRoot);
  const base = path.posix.basename(normalized);

  if (sensitiveNames.some((pattern) => pattern.test(base)) && !isAllowedExampleEnv(relative)) {
    return `Sensitive file access is blocked: ${relative || normalized}`;
  }
  if (sensitiveSegments.some((segment) =>
    normalized === segment ||
    normalized.endsWith(`/${segment}`) ||
    normalized.includes(`/${segment}/`)
  )) {
    return `Sensitive directory access is blocked: ${relative || normalized}`;
  }
  return null;
}

function protectedWriteReason(absolutePath, config) {
  const outsideProject = !isInside(absolutePath, config.projectRoot);
  const inTemp = isInside(absolutePath, os.tmpdir());
  if ((config.strict || config.fileScope === "repository") && outsideProject && !inTemp) {
    return `Writes outside the repository and OS temporary directory are blocked: ${slash(absolutePath)}`;
  }

  const relative = relativeTo(absolutePath, config.projectRoot);
  if (config.strict && !outsideProject && workflowPaths.some((entry) =>
    relative === entry || relative.startsWith(`${entry}/`)
  )) {
    return `Workflow policy files are locked in strict guard mode: ${relative}`;
  }
  return null;
}

function pathInputs(toolName, input) {
  if (!input || typeof input !== "object") return [];
  const candidates = [];
  for (const key of ["path", "filePath", "directory", "cwd", "root"]) {
    if (typeof input[key] === "string" && input[key].trim()) candidates.push(input[key]);
  }
  return [...new Set(candidates)];
}

function commandContainsSensitivePath(command) {
  const scrubbed = command
    .replaceAll(".env.example", "")
    .replaceAll(".env.sample", "")
    .replaceAll(".env.template", "");
  return [
    /(^|[\s"'=])\.env(?:[\s"'./]|$)/i,
    /(^|[\s"'=])(?:~\/)?\.(?:ssh|gnupg|aws|kube)(?:\/|[\s"']|$)/i,
    /playwright\/\.auth/i,
    /storageState.*\.json/i,
    /server\/pb_data/i,
    /\.(?:pem|key|p12|pfx|jks|keystore)(?:[\s"'|;&]|$)/i,
  ].some((pattern) => pattern.test(scrubbed));
}

function commandMutatesProtectedWorkflow(command, config) {
  if (!config.strict) return false;
  const referencesProtected = [
    /(^|[\s"'=])AGENTS\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])\.pi\//,
    /(^|[\s"'=])\.mcp\.json(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])\.github\/workflows\//,
    /(^|[\s"'=])docs\/(?:HARNESS|GIT_POLICY)\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])docs\/exec-plans\/README\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])scripts\/(?:verify(?:-(?:fast|feature|full))?|pi-doctor|run-workflow-evals|ai-pr)\.(?:sh|mjs)/,
    /(^|[\s"'=])p(?:[\s"'|;&]|$)/,
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
  return segment.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/g)?.map((word) => {
    if ((word.startsWith('"') && word.endsWith('"')) ||
        (word.startsWith("'") && word.endsWith("'"))) {
      return word.slice(1, -1);
    }
    return word;
  }) ?? [];
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
    "-C", "-c", "--config-env", "--exec-path", "--git-dir",
    "--namespace", "--super-prefix", "--work-tree",
  ]);
  while (index < words.length) {
    const word = words[index];
    if (["--help", "--version"].includes(word)) return { subcommand: word.slice(2), args: [] };
    if (optionsWithValue.has(word)) {
      index += 2;
      continue;
    }
    if (/^--(?:config-env|exec-path|git-dir|namespace|super-prefix|work-tree)=/.test(word)) {
      index += 1;
      continue;
    }
    if (word.startsWith("-")) {
      index += 1;
      continue;
    }
    return { subcommand: word.toLowerCase(), args: words.slice(index + 1) };
  }
  return null;
}

function isReadOnlyGitInvocation(subcommand, args) {
  if (readOnlyGitSubcommands.has(subcommand)) return true;
  const joined = args.join(" ").trim();
  if (subcommand === "branch") {
    if (!joined) return true;
    if (/(?:^|\s)(?:-[dDmMcC]|--delete|--move|--copy|--edit-description|--set-upstream-to|--unset-upstream)(?:\s|$|=)/.test(joined)) return false;
    return /(?:^|\s)(?:--show-current|--list|-a|--all|-r|--remotes|-v|-vv|--verbose|--contains|--no-contains|--merged|--no-merged|--points-at|--format|--sort)(?:\s|$|=)/.test(joined);
  }
  if (subcommand === "config") {
    return /(?:^|\s)(?:--get|--get-all|--get-regexp|--get-urlmatch|--list|-l|--show-origin|--show-scope)(?:\s|$|=)/.test(joined);
  }
  if (subcommand === "remote") {
    return !joined || /^(?:-v|--verbose|show(?:\s|$)|get-url(?:\s|$))/.test(joined);
  }
  if (subcommand === "tag") {
    return !joined || /(?:^|\s)(?:--list|-l|--contains|--no-contains|--merged|--no-merged|--points-at|--format|--sort|--verify|-v)(?:\s|$|=)/.test(joined);
  }
  if (subcommand === "stash") return /^(?:list|show)(?:\s|$)/.test(joined);
  if (subcommand === "worktree") return /^list(?:\s|$)/.test(joined);
  if (subcommand === "submodule") return /^(?:status|summary)(?:\s|$)/.test(joined);
  if (subcommand === "lfs") return /^(?:ls-files|status|logs)(?:\s|$)/.test(joined);
  return false;
}

function ghInvocation(words, ghIndex) {
  let index = ghIndex + 1;
  const optionsWithValue = new Set(["-R", "--repo", "--hostname"]);
  while (index < words.length) {
    const word = words[index];
    if (["--help", "--version"].includes(word)) return { command: word.slice(2), args: [] };
    if (optionsWithValue.has(word)) {
      index += 2;
      continue;
    }
    if (/^--(?:repo|hostname)=/.test(word)) {
      index += 1;
      continue;
    }
    if (word.startsWith("-")) {
      index += 1;
      continue;
    }
    return { command: word.toLowerCase(), args: words.slice(index + 1) };
  }
  return null;
}

function isReadOnlyGhInvocation(command, args) {
  if (["browse", "completion", "help", "search", "status", "version"].includes(command)) return true;
  const [subcommand = ""] = args;
  const readOnlySubcommands = {
    alias: new Set(["list"]),
    auth: new Set(["status"]),
    cache: new Set(["list"]),
    codespace: new Set(["list", "logs"]),
    config: new Set(["get", "list"]),
    extension: new Set(["list"]),
    "gpg-key": new Set(["list"]),
    issue: new Set(["list", "status", "view"]),
    label: new Set(["list"]),
    pr: new Set(["checks", "diff", "list", "status", "view"]),
    project: new Set(["field-list", "item-list", "list", "view"]),
    release: new Set(["download", "list", "view"]),
    repo: new Set(["list", "view"]),
    run: new Set(["list", "view", "watch"]),
    secret: new Set(["list"]),
    "ssh-key": new Set(["list"]),
    variable: new Set(["get", "list"]),
    workflow: new Set(["list", "view"]),
  };
  if (readOnlySubcommands[command]?.has(subcommand.toLowerCase())) return true;
  if (command !== "api") return false;
  const joined = args.join(" ");
  const method = joined.match(/(?:^|\s)(?:-X(?:=|\s*)|--method(?:=|\s+))(GET|HEAD|POST|PUT|PATCH|DELETE)(?:\s|$)/i)?.[1]?.toUpperCase();
  if (method && !["GET", "HEAD"].includes(method)) return false;
  const sendsFields = /(?:^|\s)(?:(?:-f|-F)\S*|(?:--field|--raw-field|--input)(?:=|\s|$))/.test(joined);
  return Boolean(method) || !sendsFields;
}

function hasGitMutation(text, depth = 0) {
  const source = String(text ?? "");
  if (depth > 3) return true;
  for (const match of source.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
    if (hasGitMutation(match[1] ?? match[2], depth + 1)) return true;
  }
  for (const segment of source.split(/[;&|\n]+/)) {
    const words = shellWords(segment);
    for (let index = 0; index < words.length; index += 1) {
      if (/(?:^|[\\/])ai-pr\.mjs$/.test(words[index]) && /(?:^|[\\/])node(?:\.exe)?$/.test(words[index - 1] ?? "")) return true;
      if (/(?:^|[\\/])(?:ba|z|k|c|da)?sh(?:\.exe)?$/i.test(words[index])) {
        const commandOption = words.findIndex((word, optionIndex) =>
          optionIndex > index && /^-[^-]*c/.test(word)
        );
        if (commandOption >= 0 && words[commandOption + 1] &&
            hasGitMutation(words[commandOption + 1], depth + 1)) return true;
      }
      if (words[index] === "eval" && words[index + 1] &&
          hasGitMutation(words.slice(index + 1).join(" "), depth + 1)) return true;
      if (isGitBinary(words[index])) {
        const invocation = gitInvocation(words, index);
        if (invocation && !isReadOnlyGitInvocation(invocation.subcommand, invocation.args)) return true;
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
  const name = String(toolName ?? "");
  const repositoryContext = /github|pull[_.:/-]?request|(?:^|[_.:/-])pr(?:[_.:/-]|$)/i.test(name);
  return repositoryContext && githubMutationVerb.test(name);
}

function directGitMetadataWrite(command) {
  return String(command ?? "").split(/[;&|\n]+/).some((segment) =>
    /(?:^|[\s"'=:(\\/])\.git(?:[\\/]|(?=$|[\s'";:)]))/i.test(segment) &&
    /(?:^|\s)(?:(?:rm|mv|cp|install|touch|truncate|tee)\b|(?:sed\s+-i|perl\s+-pi)\b|(?:printf|echo)\b[^\n]*(?:>|>>))/i.test(segment)
  );
}

function parseMcpArgs(value) {
  if (!value || typeof value !== "object") return {};
  if (value.args && typeof value.args === "object") return value.args;
  if (typeof value.args === "string") {
    try {
      const parsed = JSON.parse(value.args);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function ownerGitReason() {
  return "Unscoped Git/GitHub mutation is owner-controlled. Routine verified implementation uses node scripts/ai-pr.mjs on the existing ai-changes branch under docs/GIT_POLICY.md. Other writes require the current user's exact authorization and a bounded PI_GIT_MUTATION=allow session; never use that override for routine PR delivery.";
}

function mcpCallReason(input, config) {
  if (!input || typeof input !== "object") return null;
  const tool = String(input.tool ?? "");
  if (isGitMutationTool(tool) && config.gitMutation !== "allow") return ownerGitReason();

  const blockedTools = new Set([
    "browser_file_upload",
    "browser_drop",
    "browser_run_code",
    "browser_run_code_unsafe",
  ]);
  if (config.strict) blockedTools.add("browser_evaluate");
  if (blockedTools.has(tool) || [...blockedTools].some((name) => tool.endsWith(`_${name}`))) {
    return `Unsafe MCP browser tool is blocked: ${tool}`;
  }

  if (config.externalMutation !== "allow" &&
      /(?:^|[_.:/-])(?:delete|destroy|deploy|publish|release|send|transfer|refund|charge|rotate[_.:/-]?credential)(?:[_.:/-]|$)/i.test(tool)) {
    return "External mutation requires an explicitly authorized PI_GUARD_EXTERNAL_MUTATION=allow run.";
  }

  if (tool === "browser_navigate" || tool.endsWith("_browser_navigate")) {
    const args = parseMcpArgs(input);
    if (typeof args.url !== "string") return null;
    try {
      const url = new URL(args.url);
      if (!["http:", "https:"].includes(url.protocol)) {
        return `Playwright MCP navigation requires HTTP(S), not ${url.protocol}`;
      }
      const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
      if (config.strict && !localHosts.has(url.hostname)) {
        return `Playwright MCP navigation is local-only in strict guard mode: ${url.origin}`;
      }
    } catch {
      return "Playwright MCP navigation requires a valid HTTP(S) URL.";
    }
  }
  return null;
}

function blockedCommandReason(command, config) {
  const value = String(command ?? "").replace(/\\\n/g, " ").trim();
  if (!value) return null;

  const gitWrite = isGitMutationCommand(value);
  const words = shellWords(value);
  const prHelper = words[0] === "node" && ["scripts/ai-pr.mjs", "./scripts/ai-pr.mjs"].includes(words[1]) &&
    ["prepare", "deliver"].includes(words[2]) && !/[;&|<>`$\\\r\n]/.test(value);
  if (prHelper && (config.strict || (process.env.AI_PR_DELIVERY ?? "on") !== "on")) {
    return "Automatic PR delivery is disabled in strict, local-only, or evaluation sessions.";
  }
  if (gitWrite && config.gitMutation !== "allow" && !prHelper) return ownerGitReason();
  if (directGitMetadataWrite(value)) {
    return "Direct writes to .git metadata are blocked; leave history, refs, index, and configuration to the owner.";
  }
  if (commandContainsSensitivePath(value)) {
    return "Shell access to secrets, credential stores, private keys, auth state, or private database data is blocked.";
  }
  if (commandMutatesProtectedWorkflow(value, config)) {
    return "Shell mutation of workflow policy files is locked in strict guard mode.";
  }

  const gitCommand = String.raw`\bgit(?:\s+(?:(?:-C|-c|--git-dir|--work-tree)\s+\S+|--[\w-]+(?:=\S+)?))*\s+`;
  const rules = [
    [/(^|[;&|]\s*)(sudo|su|doas|pkexec)\b/i, "Privilege escalation is blocked."],
    [/(^|[;&|]\s*)(systemctl|service|crontab)\b/i, "Host service/scheduler mutation is blocked."],
    [/\brm\s+(?:--recursive|-[A-Za-z]*[rR][A-Za-z]*)(?=\s|$)/, "Recursive deletion is blocked."],
    [/\bfind\b[^\n;&|]*\s-delete\b/i, "Recursive find deletion is blocked."],
    [/\b(?:shred|dd|mkfs(?:\.\w+)?|mount|umount|chown)\b/i, "Destructive host/filesystem mutation is blocked."],
    [/\bchmod\s+-R\s+777\b/i, "Recursive world-writable permissions are blocked."],
    [new RegExp(`${gitCommand}reset\\b[^\\n;&|]*(?:--(?:hard|merge|keep)|-[^\\s]*h)`, "i"), "Destructive Git reset is blocked."],
    [new RegExp(`${gitCommand}clean\\b[^\\n;&|]*(?:--force|-[^\\s]*f)`, "i"), "Destructive Git clean is blocked."],
    [new RegExp(`${gitCommand}checkout\\b`, "i"), "Git checkout is blocked; use an explicitly authorized switch or targeted edit."],
    [new RegExp(`${gitCommand}restore\\b`, "i"), "Discarding or rewriting index/worktree state with Git restore is blocked."],
    [new RegExp(`${gitCommand}push\\b[^\\n;&|]*(?:--force(?:-with-lease|-if-includes)?|\\s-[A-Za-z]*f[A-Za-z]*(?:\\s|$)|--mirror|--delete)`, "i"), "Forced, mirrored, or deleting Git push is blocked."],
    [new RegExp(`${gitCommand}push\\b[^\\n;&|]*\\s+:[^\\s]+`, "i"), "Deleting a remote ref through Git push is blocked."],
    [new RegExp(`${gitCommand}branch\\s+-D\\b`, "i"), "Forced branch deletion is blocked."],
    [new RegExp(`${gitCommand}worktree\\s+remove\\b`, "i"), "Worktree deletion is blocked."],
    [new RegExp(`${gitCommand}remote\\s+(?:set-url|remove)\\b`, "i"), "Git remote mutation is blocked."],
    [/\b(?:npm|pnpm)\s+(?:install|add|i)\s+(?:-g|--global)\b/i, "Global package installation is blocked."],
    [/\byarn\s+global\b/i, "Global package installation is blocked."],
    [/\b(?:curl|wget)\b[^|]*\|\s*(?:sh|bash)\b/i, "Remote script execution is blocked."],
    [/(^|[;&|]\s*)(ssh|scp|sftp)\b/i, "Remote shell/file transfer is blocked."],
    [/\brsync\b[^\n;&|]*:[^\n;&|]*/i, "Remote rsync is blocked."],
  ];

  if (config.externalMutation !== "allow") {
    rules.push(
      [/\b(?:npm|pnpm|bun|cargo)\s+(?:publish|version)\b/i, "Package publication requires PI_GUARD_EXTERNAL_MUTATION=allow."],
      [/\btwine\s+upload\b/i, "Package publication requires PI_GUARD_EXTERNAL_MUTATION=allow."],
      [/\bdocker\s+(?:push|system\s+prune|volume\s+prune)\b/i, "Container publication/destructive pruning requires explicit external scope."],
      [/\b(?:kubectl|helm)\b/i, "Cluster mutation requires PI_GUARD_EXTERNAL_MUTATION=allow."],
      [/\bterraform\s+(?:apply|destroy|import|state\s+rm)\b/i, "Infrastructure mutation requires PI_GUARD_EXTERNAL_MUTATION=allow."],
      [/\bansible-playbook\b/i, "Infrastructure mutation requires PI_GUARD_EXTERNAL_MUTATION=allow."],
      [/\b(?:vercel|netlify|wrangler|fly|firebase)\s+(?:deploy|--prod)\b/i, "Deployment requires PI_GUARD_EXTERNAL_MUTATION=allow."],
      [/\bsupabase\s+db\s+push\b/i, "Remote database mutation requires PI_GUARD_EXTERNAL_MUTATION=allow."],
      [/\bgh\s+(?:release\s+create|pr\s+(?:merge|close)|repo\s+delete)\b/i, "Irreversible or integration-changing GitHub mutation requires explicit external scope."],
    );
  }

  if (config.strict) {
    if (gitWrite) return "Git mutation is locked in strict guard mode.";
    rules.push([/(^|[;&|]\s*)(?:curl|wget|ssh|scp|rsync|nc|ncat|socat)\b/i, "Direct network commands are locked in strict guard mode."]);
  }
  for (const [pattern, reason] of rules) if (pattern.test(value)) return reason;
  return null;
}

export default function safetyGuard(pi) {
  pi.on("tool_call", async (event, ctx) => {
    const cwd = path.resolve(ctx.cwd);
    const config = guardConfig(cwd);
    if (config.error) return { block: true, reason: config.error };

    if (isGitMutationTool(event.toolName) && config.gitMutation !== "allow") {
      return { block: true, reason: ownerGitReason() };
    }

    if (event.toolName === "bash") {
      const reason = blockedCommandReason(event.input?.command, config);
      if (reason) return { block: true, reason };
      return;
    }

    if (event.toolName === "mcp") {
      const reason = mcpCallReason(event.input, config);
      if (reason) return { block: true, reason };
      return;
    }

    const paths = pathInputs(event.toolName, event.input);
    const isWrite = event.toolName === "write" || event.toolName === "edit";
    for (const inputPath of paths) {
      const absolutePath = normalizePath(inputPath, cwd);
      const sensitiveReason = sensitivePathReason(absolutePath, config.projectRoot);
      if (sensitiveReason) return { block: true, reason: sensitiveReason };
      if (isWrite) {
        const writeReason = protectedWriteReason(absolutePath, config);
        if (writeReason) return { block: true, reason: writeReason };
      }
    }
  });
}
