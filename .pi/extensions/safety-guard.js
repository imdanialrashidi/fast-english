import os from "node:os";
import path from "node:path";

const workflowEditEnabled = process.env.PI_WORKFLOW_EDIT === "1";

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

const generatedSegments = [
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  "target",
  ".next",
  ".turbo",
  ".vite",
  ".artifacts",
  "playwright-report",
  "test-results",
];

const workflowPaths = [
  "AGENTS.md",
  "p",
  ".pi",
  ".mcp.json",
  ".github/workflows",
  "docs/HARNESS.md",
  "docs/exec-plans/README.md",
  "scripts/verify.sh",
  "scripts/verify-fast.sh",
  "scripts/verify-feature.sh",
  "scripts/verify-full.sh",
  "scripts/pi-doctor.sh",
];

function expandHome(value) {
  if (typeof value !== "string") return "";
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function normalizePath(value, cwd) {
  const expanded = expandHome(value);
  return path.resolve(cwd, expanded);
}

function slash(value) {
  return value.replaceAll(path.sep, "/");
}

function relativeToCwd(absolutePath, cwd) {
  return slash(path.relative(cwd, absolutePath));
}

function isInside(absolutePath, root) {
  const relative = path.relative(root, absolutePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isAllowedExampleEnv(relativePath) {
  const base = path.posix.basename(relativePath);
  return base === ".env.example" || base.endsWith(".env.example") || base.endsWith(".example");
}

function sensitivePathReason(absolutePath, cwd) {
  const normalized = slash(absolutePath);
  const relative = relativeToCwd(absolutePath, cwd);
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

function protectedWriteReason(absolutePath, cwd) {
  if (!isInside(absolutePath, cwd)) {
    return `Writes outside the repository are blocked: ${slash(absolutePath)}`;
  }

  const relative = relativeToCwd(absolutePath, cwd);
  if (generatedSegments.some((segment) =>
    relative === segment || relative.startsWith(`${segment}/`) || relative.includes(`/${segment}/`)
  )) {
    return `Direct writes to generated/dependency output are blocked: ${relative}`;
  }

  if (!workflowEditEnabled && workflowPaths.some((entry) =>
    relative === entry || relative.startsWith(`${entry}/`)
  )) {
    return `Workflow policy files are protected. Restart with PI_WORKFLOW_EDIT=1 only for an explicit workflow-maintenance task: ${relative}`;
  }

  return null;
}

function pathInputs(toolName, input) {
  if (!input || typeof input !== "object") return [];

  const candidates = [];
  for (const key of ["path", "filePath", "directory", "cwd"]) {
    if (typeof input[key] === "string" && input[key].trim()) {
      candidates.push(input[key]);
    }
  }

  if (toolName === "grep" || toolName === "find" || toolName === "ls") {
    if (typeof input.root === "string" && input.root.trim()) candidates.push(input.root);
  }

  return [...new Set(candidates)];
}

function commandContainsSensitivePath(command) {
  const scrubbed = command
    .replaceAll(".env.example", "")
    .replaceAll("docs/private/.gitkeep", "");

  const checks = [
    /(^|[\s"'=])\.env(?:[\s"'./]|$)/i,
    /(^|[\s"'=])(?:~\/)?\.ssh(?:\/|[\s"']|$)/i,
    /(^|[\s"'=])(?:~\/)?\.gnupg(?:\/|[\s"']|$)/i,
    /(^|[\s"'=])(?:~\/)?\.aws(?:\/|[\s"']|$)/i,
    /(^|[\s"'=])(?:~\/)?\.kube(?:\/|[\s"']|$)/i,
    /playwright\/\.auth/i,
    /storageState.*\.json/i,
    /server\/pb_data/i,
    /\.(?:pem|key|p12|pfx|jks|keystore)(?:[\s"'|;&]|$)/i,
  ];

  return checks.some((pattern) => pattern.test(scrubbed));
}

function commandMutatesProtectedWorkflow(command) {
  if (workflowEditEnabled) return false;

  const referencesProtected = [
    /(^|[\s"'=])AGENTS\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])\.pi\//,
    /(^|[\s"'=])\.mcp\.json(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])\.github\/workflows\//,
    /(^|[\s"'=])docs\/HARNESS\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])docs\/exec-plans\/README\.md(?:[\s"'|;&]|$)/,
    /(^|[\s"'=])scripts\/(?:verify(?:-(?:fast|feature|full))?|pi-doctor)\.sh/,
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

function mcpCallReason(input) {
  if (!input || typeof input !== "object") return null;

  const tool = String(input.tool ?? "");
  const blockedTools = new Set([
    "browser_evaluate",
    "browser_file_upload",
    "browser_drop",
    "browser_run_code",
    "browser_run_code_unsafe",
  ]);

  if (blockedTools.has(tool) || [...blockedTools].some((name) => tool.endsWith(`_${name}`))) {
    return `Unsafe MCP browser tool is blocked: ${tool}`;
  }

  if (tool === "browser_navigate" || tool.endsWith("_browser_navigate")) {
    const args = parseMcpArgs(input);
    if (typeof args.url !== "string") return null;

    try {
      const url = new URL(args.url);
      const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
      if (!["http:", "https:"].includes(url.protocol) || !localHosts.has(url.hostname)) {
        return `Playwright MCP navigation is restricted to local development origins: ${url.origin}`;
      }
    } catch {
      return "Playwright MCP navigation requires a valid local HTTP(S) URL.";
    }
  }

  return null;
}

function blockedCommandReason(command) {
  const value = String(command ?? "").replace(/\\\n/g, " ").trim();
  if (!value) return null;

  if (commandContainsSensitivePath(value)) {
    return "Shell access to secrets, credential stores, private keys, auth state, or private database data is blocked.";
  }

  if (commandMutatesProtectedWorkflow(value)) {
    return "Shell mutation of workflow policy files is blocked. Restart with PI_WORKFLOW_EDIT=1 only for an explicit workflow-maintenance task.";
  }

  const rules = [
    [/(^|[;&|]\s*)(sudo|su|doas|pkexec)\b/i, "Privilege escalation is blocked."],
    [/(^|[;&|]\s*)(systemctl|service|crontab)\b/i, "Host service/scheduler mutation is blocked."],
    [/\brm\s+-(?:[^ \n]*r[^ \n]*f|[^ \n]*f[^ \n]*r)\b/i, "Recursive forced deletion is blocked."],
    [/\brm\s+-r\b/i, "Recursive deletion is blocked."],
    [/\bfind\b[^\n;&|]*\s-delete\b/i, "Recursive find deletion is blocked."],
    [/\b(?:shred|dd|mkfs(?:\.\w+)?|mount|umount|chown)\b/i, "Destructive host/filesystem mutation is blocked."],
    [/\bchmod\s+-R\s+777\b/i, "Recursive world-writable permissions are blocked."],
    [/\bgit\s+(?:commit|push|pull|reset|clean|checkout|switch|restore|stash|rebase|merge|cherry-pick|tag)\b/i, "Git history or remote mutation requires explicit user control."],
    [/\bgit\s+branch\s+-D\b/i, "Forced branch deletion is blocked."],
    [/\bgit\s+worktree\s+remove\b/i, "Worktree deletion is blocked."],
    [/\bgit\s+remote\s+(?:set-url|remove)\b/i, "Git remote mutation is blocked."],
    [/\b(?:npm|pnpm)\s+(?:install|add|i)\s+(?:-g|--global)\b/i, "Global package installation is blocked."],
    [/\byarn\s+global\b/i, "Global package installation is blocked."],
    [/\b(?:npm|pnpm|bun|cargo)\s+(?:publish|version)\b/i, "Package publication/version mutation is blocked."],
    [/\btwine\s+upload\b/i, "Package publication is blocked."],
    [/\b(?:curl|wget)\b[^|]*\|\s*(?:sh|bash)\b/i, "Remote script execution is blocked."],
    [/(^|[;&|]\s*)(ssh|scp|sftp)\b/i, "Remote shell/file transfer is blocked."],
    [/\brsync\b[^\n;&|]*:[^\n;&|]*/i, "Remote rsync is blocked."],
    [/\bdocker\s+(?:push|system\s+prune|volume\s+prune)\b/i, "Container publication/destructive pruning is blocked."],
    [/\b(?:kubectl|helm)\b/i, "Cluster mutation is blocked."],
    [/\bterraform\s+(?:apply|destroy|import|state\s+rm)\b/i, "Infrastructure mutation is blocked."],
    [/\bansible-playbook\b/i, "Infrastructure mutation is blocked."],
    [/\b(?:vercel|netlify|wrangler|fly|firebase)\s+deploy\b/i, "External deployment is blocked."],
    [/\bsupabase\s+db\s+push\b/i, "Remote database mutation is blocked."],
    [/\bgh\s+(?:release\s+create|pr\s+(?:create|merge)|issue\s+create|repo\s+delete)\b/i, "External GitHub mutation is blocked."],
  ];

  for (const [pattern, reason] of rules) {
    if (pattern.test(value)) return reason;
  }

  return null;
}

export default function safetyGuard(pi) {
  pi.on("tool_call", async (event, ctx) => {
    const cwd = path.resolve(ctx.cwd);

    if (event.toolName === "bash") {
      const reason = blockedCommandReason(event.input?.command);
      if (reason) return { block: true, reason };
      return;
    }

    if (event.toolName === "mcp") {
      const reason = mcpCallReason(event.input);
      if (reason) return { block: true, reason };
      return;
    }

    const paths = pathInputs(event.toolName, event.input);
    const isWrite = event.toolName === "write" || event.toolName === "edit";

    for (const inputPath of paths) {
      const absolutePath = normalizePath(inputPath, cwd);

      const sensitiveReason = sensitivePathReason(absolutePath, cwd);
      if (sensitiveReason) return { block: true, reason: sensitiveReason };

      if (isWrite) {
        const writeReason = protectedWriteReason(absolutePath, cwd);
        if (writeReason) return { block: true, reason: writeReason };
      }
    }
  });
}
