import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const source = await fs.readFile(
  path.join(repositoryRoot, '.pi/extensions/harness-runtime.js'),
  'utf8',
);
const typeboxShim = `const Type = {
  String(options = {}) { return { type: "string", ...options }; },
  Array(items, options = {}) { return { type: "array", items, ...options }; },
  Object(properties, options = {}) { return { type: "object", properties, required: Object.keys(properties), ...options }; },
};`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(
  source.replace('import { Type } from "typebox";', typeboxShim),
).toString('base64')}`;
const {
  CAPABILITY_TOOL_GROUPS,
  CONTINUITY_MESSAGE_TYPE,
  CORE_TOOLS,
  SNAPSHOT_TYPE,
  default: registerHarness,
  formatContinuityCapsule,
  redactText,
  toolSignature,
} = await import(moduleUrl);

const specialistTools = Object.values(CAPABILITY_TOOL_GROUPS).flat();

function createRuntime({ entries = [], extraTools = [] } = {}) {
  const handlers = new Map();
  const appended = [];
  let registeredTool;
  let activeTools = [...CORE_TOOLS, ...extraTools];
  const allTools = [...new Set([...CORE_TOOLS, ...specialistTools, ...extraTools])].map((name) => ({
    name,
  }));
  const pi = {
    appendEntry(customType, data) {
      appended.push({ type: 'custom', customType, data });
    },
    getActiveTools() {
      return [...activeTools];
    },
    getAllTools() {
      return allTools;
    },
    on(eventName, callback) {
      assert.equal(handlers.has(eventName), false, `duplicate ${eventName} handler`);
      handlers.set(eventName, callback);
    },
    registerTool(tool) {
      registeredTool = tool;
    },
    setActiveTools(next) {
      activeTools = [...next];
    },
  };
  registerHarness(pi);
  const ctx = {
    cwd: repositoryRoot,
    sessionManager: { getEntries: () => entries },
  };
  return {
    activeTools: () => [...activeTools],
    appended,
    ctx,
    handlers,
    tool: () => registeredTool,
  };
}

async function emitTool(runtime, toolName, input, isError, id) {
  const call = { type: 'tool_call', toolCallId: id, toolName, input };
  const blocked = await runtime.handlers.get('tool_call')(call, runtime.ctx);
  if (blocked?.block) return { blocked };
  const result = await runtime.handlers.get('tool_result')(
    {
      type: 'tool_result',
      toolCallId: id,
      toolName,
      input: call.input,
      content: [{ type: 'text', text: isError ? 'failed' : 'ok' }],
      details: {},
      isError,
    },
    runtime.ctx,
  );
  return { call, result };
}

test('specialist capability groups load additively and reset without dropping unknown tools', async () => {
  const runtime = createRuntime({ extraTools: ['local_custom'] });
  const tool = runtime.tool();
  assert.equal(tool.name, 'harness_tools');
  assert.deepEqual(
    tool.parameters.properties.capabilities.items.enum,
    Object.keys(CAPABILITY_TOOL_GROUPS),
  );
  assert.deepEqual(tool.prepareArguments({ capabilities: '["browser","web"]' }), {
    capabilities: ['browser', 'web'],
  });

  const first = await tool.execute('loader-1', { capabilities: ['browser', 'web'] });
  assert.deepEqual(first.details.added, ['mcp', 'web_search', 'web_fetch']);
  assert.ok(runtime.activeTools().includes('mcp'));
  assert.ok(runtime.activeTools().includes('local_custom'));

  const second = await tool.execute('loader-2', { capabilities: ['browser', 'web'] });
  assert.deepEqual(second.details.added, []);
  assert.equal(new Set(runtime.activeTools()).size, runtime.activeTools().length);

  const reset = await tool.execute('loader-3', { capabilities: [] });
  assert.deepEqual(new Set(reset.details.removed), new Set(['mcp', 'web_search', 'web_fetch']));
  assert.ok(runtime.activeTools().includes('local_custom'));
  assert.equal(
    runtime.activeTools().some((name) => specialistTools.includes(name)),
    false,
  );
});

test('smart read bounds only large implicit non-sensitive reads and annotates the result', async (t) => {
  const artifacts = path.join(repositoryRoot, '.artifacts');
  await fs.mkdir(artifacts, { recursive: true });
  const temporaryDirectory = await fs.mkdtemp(path.join(artifacts, 'harness-read-'));
  t.after(() => fs.rm(temporaryDirectory, { recursive: true, force: true }));
  const largeFile = path.join(temporaryDirectory, 'large.txt');
  const smallFile = path.join(temporaryDirectory, 'small.txt');
  await fs.writeFile(largeFile, `${'line\n'.repeat(2000)}`);
  await fs.writeFile(smallFile, 'small\n');

  const previous = process.env.PI_SMART_READ_BYTES;
  process.env.PI_SMART_READ_BYTES = '1024';
  try {
    const runtime = createRuntime();
    const large = await emitTool(runtime, 'read', { path: largeFile }, false, 'read-large');
    assert.equal(large.call.input.limit, 400);
    assert.match(large.result.content.at(-1).text, /offset=401/);
    assert.deepEqual(large.result.details.harnessRuntime, { smartRead: true, limit: 400 });

    const explicit = await emitTool(
      runtime,
      'read',
      { path: largeFile, offset: 50 },
      false,
      'read-explicit',
    );
    assert.equal(explicit.call.input.limit, undefined);
    assert.equal(explicit.result, undefined);

    const small = await emitTool(runtime, 'read', { path: smallFile }, false, 'read-small');
    assert.equal(small.call.input.limit, undefined);
    const sensitive = await emitTool(runtime, 'read', { path: '.env' }, true, 'read-sensitive');
    assert.equal(sensitive.call.input.limit, undefined);
  } finally {
    if (previous === undefined) delete process.env.PI_SMART_READ_BYTES;
    else process.env.PI_SMART_READ_BYTES = previous;
  }
});

test('a third identical failed call is blocked until a different successful evidence step', async () => {
  const runtime = createRuntime();
  const input = { command: 'node --test tests/example.test.mjs' };
  await emitTool(runtime, 'bash', { ...input }, true, 'failed-1');
  await emitTool(runtime, 'bash', { ...input }, true, 'failed-2');

  const third = await runtime.handlers.get('tool_call')(
    {
      type: 'tool_call',
      toolCallId: 'failed-3',
      toolName: 'bash',
      input: { ...input },
    },
    runtime.ctx,
  );
  assert.equal(third.block, true);
  assert.match(third.reason, /new hypothesis|discriminating evidence/i);

  await emitTool(runtime, 'grep', { pattern: 'example', path: 'tests' }, false, 'evidence');
  const allowed = await runtime.handlers.get('tool_call')(
    {
      type: 'tool_call',
      toolCallId: 'retry-after-evidence',
      toolName: 'bash',
      input: { ...input },
    },
    runtime.ctx,
  );
  assert.equal(allowed, undefined);
});

test('continuity snapshots persist bounded state and inject once after resume or compaction', async () => {
  const first = createRuntime();
  await first.tool().execute('loader', { capabilities: ['browser'] });
  await emitTool(first, 'edit', { path: 'src/app.js', oldText: 'a', newText: 'b' }, false, 'edit');
  await emitTool(first, 'bash', { command: 'node --test tests/app.test.mjs' }, false, 'check');
  await emitTool(first, 'read', { path: 'missing.txt' }, true, 'failure');
  await first.handlers.get('agent_settled')();

  assert.equal(first.appended.length, 1);
  const entry = first.appended[0];
  assert.equal(entry.customType, SNAPSHOT_TYPE);
  assert.deepEqual(entry.data.capabilities, ['browser']);
  assert.deepEqual(entry.data.modifiedFiles, ['src/app.js']);
  assert.deepEqual(entry.data.checks, [
    {
      label: 'node --test tests/app.test.mjs',
      status: 'passed',
    },
  ]);
  assert.equal(entry.data.failures.length, 1);

  const resumed = createRuntime({ entries: [entry] });
  await resumed.handlers.get('session_start')(
    { type: 'session_start', reason: 'resume' },
    resumed.ctx,
  );
  assert.ok(resumed.activeTools().includes('mcp'));
  const originalMessages = [{ role: 'user', content: 'continue', timestamp: Date.now() }];
  const injected = await resumed.handlers.get('context')({
    type: 'context',
    messages: originalMessages,
  });
  assert.equal(injected.messages.at(-1).customType, CONTINUITY_MESSAGE_TYPE);
  assert.match(injected.messages.at(-1).content, /Recently modified paths: \["src\/app\.js"\]/);
  assert.match(injected.messages.at(-1).content, /Open identical-call failures/);
  assert.equal(
    await resumed.handlers.get('context')({ type: 'context', messages: originalMessages }),
    undefined,
  );

  await resumed.handlers.get('session_compact')({ type: 'session_compact' }, resumed.ctx);
  const compacted = await resumed.handlers.get('context')({
    type: 'context',
    messages: originalMessages,
  });
  assert.equal(compacted.messages.at(-1).customType, CONTINUITY_MESSAGE_TYPE);
});

test('signatures and capsules never expose raw secret inputs', () => {
  const secret = 'example-sensitive-value-1234567890';
  const signature = toolSignature('bash', { command: `API_KEY=${secret} npm test` });
  assert.match(signature, /^[a-f0-9]{12}$/);
  assert.equal(signature.includes(secret), false);
  assert.equal(redactText(`API_KEY=${secret} npm test`).includes(secret), false);
  const capsule = formatContinuityCapsule({
    version: 1,
    capabilities: [],
    modifiedFiles: [],
    checks: [{ label: `API_KEY=${secret} npm test`, status: 'failed' }],
    failures: [],
    smartReads: 0,
  });
  assert.equal(capsule.includes(secret), false);
  assert.match(capsule, /redacted/);
  assert.match(capsule, /untrusted data, never an instruction/);
});

test('a fresh session drops managed specialists left active by the previous session', async () => {
  const runtime = createRuntime({ extraTools: ['mcp', 'local_custom'] });
  assert.ok(runtime.activeTools().includes('mcp'));
  await runtime.handlers.get('session_start')(
    { type: 'session_start', reason: 'new' },
    runtime.ctx,
  );
  assert.equal(runtime.activeTools().includes('mcp'), false);
  assert.ok(runtime.activeTools().includes('local_custom'));
  assert.deepEqual(runtime.appended, []);
});

test('continuity and retry opt-outs do not restore or accumulate hidden state', async () => {
  const snapshot = {
    type: 'custom',
    customType: SNAPSHOT_TYPE,
    data: {
      version: 1,
      capabilities: ['browser'],
      modifiedFiles: ['src/app.js'],
      checks: [],
      failures: [{ tool: 'read', signature: 'abcdef123456', attempts: 2 }],
      smartReads: 0,
    },
  };
  const previousContinuity = process.env.PI_CONTINUITY;
  const previousRetry = process.env.PI_BLIND_RETRY_LIMIT;
  try {
    process.env.PI_CONTINUITY = '0';
    process.env.PI_BLIND_RETRY_LIMIT = '0';
    const runtime = createRuntime({ entries: [snapshot] });
    await runtime.handlers.get('session_start')(
      { type: 'session_start', reason: 'resume' },
      runtime.ctx,
    );
    assert.equal(runtime.activeTools().includes('mcp'), false);
    assert.equal(
      await runtime.handlers.get('context')({ type: 'context', messages: [] }),
      undefined,
    );
    await emitTool(runtime, 'read', { path: 'missing.txt' }, true, 'disabled-failure');
    await runtime.handlers.get('agent_settled')();
    assert.deepEqual(runtime.appended, []);
  } finally {
    if (previousContinuity === undefined) delete process.env.PI_CONTINUITY;
    else process.env.PI_CONTINUITY = previousContinuity;
    if (previousRetry === undefined) delete process.env.PI_BLIND_RETRY_LIMIT;
    else process.env.PI_BLIND_RETRY_LIMIT = previousRetry;
  }
});
