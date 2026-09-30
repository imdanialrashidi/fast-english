import assert from 'node:assert/strict';
import test from 'node:test';
import runMetrics from '../.pi/extensions/run-metrics.js';

function setup(hasUI = true) {
  const handlers = new Map();
  const statuses = new Map([['other-extension', 'keep me']]);
  const timers = new Map();
  let time = 0;
  let nextTimer = 0;
  let idle = true;
  const ctx = {
    hasUI,
    isIdle: () => idle,
    ui: {
      setStatus: (key, value) =>
        value === undefined ? statuses.delete(key) : statuses.set(key, value),
    },
  };
  runMetrics(
    { on: (name, handler) => handlers.set(name, handler) },
    {
      now: () => time,
      every: (fn) => {
        timers.set(++nextTimer, fn);
        return nextTimer;
      },
      cancel: (id) => timers.delete(id),
    },
  );
  return {
    emit: (name, event = {}) => handlers.get(name)?.(event, ctx),
    advance: (ms) => {
      time += ms;
      for (const fn of timers.values()) fn();
    },
    idle: (value) => {
      idle = value;
    },
    text: () => statuses.get('run-metrics'),
    statuses,
    timers,
  };
}

const response = (output, stopReason = 'stop') => ({
  message: { role: 'assistant', usage: { output }, stopReason },
});

test('elapsed includes tools; throughput weights finalized output by model time only', () => {
  const r = setup();
  r.emit('agent_start');
  r.emit('turn_start');
  r.advance(2000);
  r.emit('message_end', response(100, 'toolUse'));
  assert.equal(r.text(), 'Run 2.0s (running) | 50.0 tok/s | Tools 0.0s | Retry 0 | cost n/a');
  r.emit('tool_execution_start', { toolCallId: 'build' });
  r.advance(10000); // Tool work must not dilute the model rate.
  r.emit('tool_execution_end', { toolCallId: 'build' });
  r.emit('message_end', { message: { role: 'toolResult', usage: { output: 999 } } });
  assert.equal(r.text(), 'Run 12.0s (running) | 50.0 tok/s | Tools 10.0s | Retry 0 | cost n/a');
  r.emit('turn_start');
  r.advance(3000);
  r.emit('message_end', response(300));
  r.emit('agent_settled');
  assert.equal(r.text(), 'Run 15.0s (finished) | 80.0 tok/s | Tools 10.0s | Retry 0 | cost n/a');
  assert.equal(r.timers.size, 0);
  r.advance(60000);
  assert.equal(r.text(), 'Run 15.0s (finished) | 80.0 tok/s | Tools 10.0s | Retry 0 | cost n/a');
  assert.equal(r.statuses.get('other-extension'), 'keep me');
});

test('automatic continuation retains total duration until settled; next prompt resets', () => {
  const r = setup();
  r.emit('agent_start');
  r.emit('turn_start');
  r.advance(2000);
  r.emit('message_end', response(100, 'error'));
  r.emit('agent_end'); // Pi may still retry or compact after this event.
  r.advance(60000);
  r.emit('agent_start');
  r.emit('turn_start');
  r.advance(2000);
  r.emit('message_end', response(100));
  r.emit('agent_settled');
  assert.equal(r.text(), 'Run 1m 4s (finished) | 50.0 tok/s | Tools 0.0s | Retry 1 | cost n/a');
  r.emit('agent_start');
  assert.equal(r.text(), 'Run 0.0s (running) | n/a tok/s | Tools 0.0s | Retry 0 | cost n/a');
  assert.equal(r.timers.size, 1);
  r.emit('session_shutdown');
});

test('missing, zero, invalid, or untimed usage never produces a made-up speed', () => {
  for (const output of [undefined, 0, -1, NaN, Infinity, '100']) {
    const r = setup();
    r.emit('agent_start');
    r.emit('turn_start');
    r.advance(1000);
    r.emit('message_end', response(output));
    // A later good response must not conceal an incomplete run measurement.
    r.emit('turn_start');
    r.advance(1000);
    r.emit('message_end', response(100));
    r.emit('agent_settled');
    assert.equal(r.text(), 'Run 2.0s (finished) | n/a tok/s | Tools 0.0s | Retry 0 | cost n/a');
  }
  for (const start of [false, true]) {
    const r = setup();
    r.emit('agent_start');
    if (start) r.emit('turn_start');
    r.emit('message_end', response(100));
    r.emit('agent_settled');
    assert.match(r.text(), /n\/a tok\/s \|/);
  }
});

test('failure and cancellation are labeled; a subsequent run does not inherit them', () => {
  const r = setup();
  for (const reason of ['error', 'aborted', 'stop']) {
    r.emit('agent_start');
    r.emit('turn_start');
    r.advance(1000);
    r.emit('message_end', response(30, reason));
    r.emit('agent_settled');
    assert.equal(
      r.text(),
      `Run 1.0s (${reason === 'stop' ? 'finished' : reason}) | 30.0 tok/s | Tools 0.0s | Retry 0 | cost n/a`,
    );
    assert.equal(r.timers.size, 0);
  }
});

test("navigation and shutdown clear timers and only this extension's status", () => {
  for (const name of ['session_start', 'session_tree', 'session_shutdown']) {
    const r = setup();
    r.emit('agent_start');
    r.advance(1000);
    r.emit(name);
    r.emit('message_end', response(100));
    r.emit('agent_settled');
    assert.equal(r.text(), undefined);
    assert.equal(r.timers.size, 0);
    assert.equal(r.statuses.get('other-extension'), 'keep me');
  }
});

test('print mode starts no timer or status; settled does not interrupt another run', () => {
  const silent = setup(false);
  silent.emit('agent_start');
  silent.emit('turn_start');
  silent.advance(1000);
  silent.emit('message_end', response(100));
  silent.emit('agent_settled');
  assert.equal(silent.text(), undefined);
  assert.equal(silent.timers.size, 0);
  const r = setup();
  r.emit('agent_start');
  r.idle(false);
  r.emit('agent_settled');
  r.advance(1000);
  assert.match(r.text(), /Run 1.0s \(running\)/);
  assert.equal(r.timers.size, 1);
  r.idle(true);
  r.emit('agent_settled');
  assert.equal(r.timers.size, 0);
});

test('tool time counts overlapping execution once, ignores duplicate events and freezes at settle', () => {
  const r = setup();
  r.emit('agent_start');
  r.emit('tool_execution_start', { toolCallId: 'a' });
  r.advance(2000);
  r.emit('tool_execution_start', { toolCallId: 'b' });
  r.emit('tool_execution_start', { toolCallId: 'a' });
  r.advance(3000);
  r.emit('tool_execution_end', { toolCallId: 'a', isError: true });
  r.emit('tool_execution_end', { toolCallId: 'unknown' });
  r.advance(2000);
  r.emit('tool_execution_end', { toolCallId: 'b' });
  r.emit('tool_execution_end', { toolCallId: 'b' });
  r.advance(1000);
  r.emit('tool_execution_start', { toolCallId: 'cancelled' });
  r.advance(1000);
  r.emit('agent_settled'); // No end event for an interrupted tool.
  assert.match(r.text(), /Run 9.0s \(finished\).*Tools 8.0s \| Retry 0/);
  r.advance(5000);
  assert.match(r.text(), /Tools 8.0s/);
  r.emit('tool_execution_end', { toolCallId: 'cancelled' });
  r.emit('agent_start');
  assert.match(r.text(), /Tools 0.0s \| Retry 0/);
  r.emit('session_shutdown');
});

const pricedResponse = () => ({
  message: {
    role: 'assistant',
    stopReason: 'stop',
    usage: {
      input: 1000,
      output: 2000,
      cacheRead: 500,
      cacheWrite: 100,
      cost: { input: 0.01, output: 0.04, cacheRead: 0.002, cacheWrite: 0.008, total: 0.06 },
    },
  },
});

test('run cost sums native input/output/cache estimates and resets for the next prompt', () => {
  const r = setup();
  r.emit('agent_start');
  for (let i = 0; i < 2; i++) {
    r.emit('turn_start');
    r.advance(1000);
    r.emit('message_end', pricedResponse());
  }
  r.emit('message_end', { message: { role: 'toolResult', usage: { cost: { total: 99 } } } });
  r.emit('agent_settled');
  assert.match(r.text(), /Retry 0 \| ~\$0.1200$/);
  r.emit('agent_start');
  assert.match(r.text(), /cost n\/a$/);
  r.emit('turn_start');
  r.advance(1000);
  const tiny = pricedResponse();
  tiny.message.usage.cost = {
    input: 0,
    output: 0.000001,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0.000001,
  };
  r.emit('message_end', tiny);
  r.emit('agent_settled');
  assert.match(r.text(), /~<\$0.0001$/); // Must not round a positive estimate to free.
});

test('unknown or inconsistent pricing leaves the whole-run cost unavailable, even after recovery', () => {
  for (const corrupt of [
    (usage) => {
      delete usage.cost;
    },
    (usage) => {
      for (const key of Object.keys(usage.cost)) usage.cost[key] = 0;
    },
    (usage) => {
      usage.cost.input = -0.01;
    },
    (usage) => {
      usage.cost.total = NaN;
    },
    (usage) => {
      usage.cost.total = 0.5;
    },
    (usage) => {
      delete usage.cacheRead;
    },
  ]) {
    const r = setup();
    r.emit('agent_start');
    r.emit('turn_start');
    r.advance(1000);
    const missing = pricedResponse();
    corrupt(missing.message.usage);
    missing.message.stopReason = 'error';
    r.emit('message_end', missing);
    assert.match(r.text(), /Retry 0/); // A failed response alone is not a retry.
    r.emit('agent_start');
    r.emit('turn_start');
    r.advance(1000);
    r.emit('message_end', pricedResponse());
    r.emit('agent_settled');
    assert.match(r.text(), /Retry 1 \| cost n\/a$/);
  }
});
