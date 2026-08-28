import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  buildRpcInvocation,
  createRpcTracker,
  runOmpRpc,
  validSessionStats,
} from '../scripts/lib/omp-rpc.mjs';

const cwd = path.resolve(import.meta.dirname, '..');
const stats = { tokens: { input: 12, output: 8, total: 20 }, cost: 0.001, toolCalls: 1 };

test('acknowledgement and nonterminal agent_end cannot prematurely finish a run', () => {
  const sent = [];
  const tracker = createRpcTracker((event) => sent.push(event));
  tracker.accept({ type: 'response', id: 'eval-prompt', success: true });
  tracker.accept({ type: 'agent_end', isTerminal: false });
  assert.equal(tracker.state.finished, false);
  assert.deepEqual(sent, []);
  tracker.accept({ type: 'agent_end', isTerminal: true });
  assert.deepEqual(sent, [{ id: 'eval-stats', type: 'get_session_stats' }]);
  assert.equal(tracker.state.finished, false);
  tracker.accept({ type: 'response', id: 'eval-stats', success: true, data: stats });
  assert.equal(tracker.state.completion, 'completed');
  assert.deepEqual(tracker.state.stats, stats);
});

test('legacy terminal frames and explicit local-only completion each request statistics once', () => {
  for (const terminal of [
    { type: 'agent_end' },
    { type: 'response', id: 'eval-prompt', success: true, data: { agentInvoked: false } },
    { type: 'prompt_result', id: 'eval-prompt', agentInvoked: false },
  ]) {
    const sent = [];
    const tracker = createRpcTracker((event) => sent.push(event));
    tracker.accept(terminal);
    tracker.accept(terminal);
    assert.equal(sent.length, 1);
    tracker.accept({ type: 'response', id: 'eval-stats', success: true, data: stats });
    assert.equal(tracker.state.completion, 'completed');
  }
});

test('asynchronous prompt failure is sticky even after an earlier acknowledgement', () => {
  const tracker = createRpcTracker(() => {});
  tracker.accept({ type: 'response', id: 'eval-prompt', success: true });
  tracker.accept({ type: 'agent_end' });
  tracker.accept({ type: 'response', id: 'eval-prompt', success: false, error: 'provider failed' });
  tracker.accept({ type: 'response', id: 'eval-stats', success: true, data: stats });
  assert.equal(tracker.state.completion, 'prompt-failed');
});

test('extension errors and missing/unsolicited statistics never become a pass', () => {
  const tracker = createRpcTracker(() => {});
  tracker.accept({ type: 'extension_error', error: 'guard did not load' });
  tracker.accept({ type: 'agent_end' });
  tracker.accept({ type: 'response', id: 'eval-stats', success: true, data: stats });
  assert.equal(tracker.state.completion, 'extension-error');
  for (const event of [{ success: false }, { success: true }, { success: true, data: [] }]) {
    const state = createRpcTracker(() => {});
    state.accept({ type: 'agent_end' });
    state.accept({ type: 'response', id: 'eval-stats', ...event });
    assert.equal(state.state.completion, 'stats-failed');
  }
  const unsolicited = createRpcTracker(() => {});
  unsolicited.accept({ type: 'response', id: 'eval-stats', success: true, data: stats });
  assert.equal(unsolicited.state.completion, 'stats-failed');
});

test('interactive approval is cancelled and reported, not automatically granted', () => {
  const sent = [];
  const tracker = createRpcTracker((event) => sent.push(event));
  tracker.accept({ type: 'extension_ui_request', id: 'q', method: 'confirm' });
  assert.deepEqual(sent, [{ type: 'extension_ui_response', id: 'q', cancelled: true }]);
  assert.equal(tracker.state.completion, 'intervention-required');
});

test('empty or nonfinite metrics and provider error messages cannot become completed evaluations', () => {
  for (const value of [
    {},
    { ...stats, cost: Infinity },
    { ...stats, tokens: { total: null } },
    { ...stats, toolCalls: -1 },
  ]) {
    assert.equal(validSessionStats(value), false);
    const tracker = createRpcTracker(() => {});
    tracker.accept({ type: 'agent_end' });
    tracker.accept({ type: 'response', id: 'eval-stats', success: true, data: value });
    assert.equal(tracker.state.completion, 'stats-failed');
  }
  const tracker = createRpcTracker(() => {});
  tracker.accept({ type: 'message_end', message: { role: 'assistant', stopReason: 'error' } });
  tracker.accept({ type: 'agent_end' });
  tracker.accept({ type: 'response', id: 'eval-stats', success: true, data: stats });
  assert.equal(tracker.state.completion, 'model-error');
});

test('native automatic recovery clears a pending model error but not a protocol failure', () => {
  for (const protocolFailure of [false, true]) {
    const tracker = createRpcTracker(() => {});
    if (protocolFailure) tracker.accept({ type: 'extension_error', error: 'guard failed' });
    tracker.accept({ type: 'message_end', message: { role: 'assistant', stopReason: 'error' } });
    tracker.accept({ type: 'agent_end', isTerminal: false });
    tracker.accept({ type: 'auto_retry_start' });
    tracker.accept({ type: 'message_end', message: { role: 'assistant', stopReason: 'stop' } });
    tracker.accept({ type: 'auto_retry_end', success: true });
    tracker.accept({ type: 'agent_end', isTerminal: true });
    tracker.accept({ type: 'response', id: 'eval-stats', success: true, data: stats });
    assert.equal(tracker.state.completion, protocolFailure ? 'extension-error' : 'completed');
  }
});

function fakeSpawner(onRequest, { ignoreEnd = false } = {}) {
  const receipt = {};
  const spawn = (command, args, options) => {
    Object.assign(receipt, { command, args, options, requests: [] });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    let closed = false;
    const close = (code = 0) => {
      if (!closed) {
        closed = true;
        child.emit('close', code, null);
      }
    };
    child.kill = () => {
      close(null);
      return true;
    };
    const send = (event) => child.stdout.write(`${JSON.stringify(event)}\n`);
    let buffer = '';
    child.stdin.on('data', (chunk) => {
      buffer += chunk.toString();
      let index = buffer.indexOf('\n');
      while (index >= 0) {
        const request = JSON.parse(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
        receipt.requests.push(request);
        // Real pipes are asynchronous: do not emit a response from inside write().
        queueMicrotask(() => onRequest(request, { child, send, close }));
        index = buffer.indexOf('\n');
      }
    });
    if (!ignoreEnd) child.stdin.on('finish', () => queueMicrotask(() => close()));
    return child;
  };
  return { spawn, receipt };
}

test('RPC runner keeps slash expansion at byte zero and local-only scope outside the user message', async () => {
  const fake = fakeSpawner((request, { send }) => {
    if (request.type === 'prompt') {
      send({ type: 'response', id: request.id, success: true });
      send({ type: 'agent_end', isTerminal: false });
      send({ type: 'agent_end', isTerminal: true });
    } else if (request.type === 'get_session_stats')
      send({ type: 'response', id: request.id, success: true, data: stats });
  });
  const result = await runOmpRpc({
    cwd,
    prompt: '/handoff exact scope',
    model: 'provider/model',
    timeoutMs: 2000,
    spawnProcess: fake.spawn,
  });
  assert.equal(result.completion, 'completed');
  assert.equal(fake.receipt.command, 'omp');
  assert.equal(fake.receipt.requests[0].message, '/handoff exact scope');
  assert.equal(fake.receipt.options.env.AI_PR_DELIVERY, 'off');
  assert.equal(fake.receipt.options.env.OMP_EVAL_RUN, '1');
  assert.equal(fake.receipt.options.env.OMP_GIT_MUTATION, 'deny');
  const args = buildRpcInvocation({ cwd, model: 'provider/model', thinking: 'high' });
  assert(args.includes('--no-session') && args.includes('--no-extensions'));
  assert(args.includes(path.join(cwd, '.omp/extensions/safety-guard.js')));
  assert(
    args[args.indexOf('--append-system-prompt') + 1].includes('local-only workflow evaluation'),
  );
});

test('malformed JSONL, bounded output, early process exit and timeout fail explicitly', async () => {
  for (const [expected, handler, options] of [
    ['invalid-jsonl', (_request, { child }) => child.stdout.write('not-json\n'), {}],
    [
      'output-limit',
      (_request, { child }) => child.stdout.write('x'.repeat(2048)),
      { maxOutputBytes: 1024 },
    ],
    ['process-exited', (_request, { close }) => close(), {}],
    ['process-failed', (_request, { close }) => close(2), {}],
    ['timeout', () => {}, { timeoutMs: 20 }],
  ]) {
    const fake = fakeSpawner(handler);
    const result = await runOmpRpc({
      cwd,
      prompt: 'inspect',
      timeoutMs: 1500,
      spawnProcess: fake.spawn,
      ...options,
    });
    assert.equal(result.completion, expected);
  }
});

test('split UTF-8 JSONL frames are decoded without corrupting evidence', async () => {
  const fake = fakeSpawner((request, { child, send }) => {
    if (request.type === 'prompt') {
      const frame = Buffer.from(`${JSON.stringify({ type: 'agent_end', note: 'فارسی' })}\n`);
      const index = frame.indexOf(Buffer.from('ف')) + 1;
      child.stdout.write(frame.subarray(0, index));
      child.stdout.write(frame.subarray(index));
    } else send({ type: 'response', id: request.id, success: true, data: stats });
  });
  const result = await runOmpRpc({
    cwd,
    prompt: 'inspect',
    timeoutMs: 2000,
    spawnProcess: fake.spawn,
  });
  assert.equal(result.completion, 'completed');
  assert.equal(JSON.parse(result.events[0]).note, 'فارسی');
});
