import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { isolatedGitEnvironment } from './eval-isolation.mjs';

export function validSessionStats(value) {
  const finite = (number) => typeof number === 'number' && Number.isFinite(number) && number >= 0;
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    finite(value.cost) &&
    finite(value.toolCalls) &&
    ['input', 'output', 'total'].every((key) => finite(value.tokens?.[key]))
  );
}

// Protocol contract: OMP v18.0.6 docs/rpc.md. An acknowledgement and a
// nonterminal agent_end are not completion. Any protocol failure is sticky.
export function createRpcTracker(send) {
  let statsRequested = false;
  let failure;
  let stats;
  let finished = false;
  let pendingModelError = false;
  return {
    get state() {
      return {
        statsRequested,
        stats,
        finished,
        completion: failure ?? (finished ? 'completed' : 'process-exited'),
      };
    },
    fail(reason) {
      failure ??= reason;
      finished = true;
    },
    accept(event) {
      if (['message_end', 'turn_end', 'agent_end'].includes(event.type)) {
        const messages = [...(Array.isArray(event.messages) ? event.messages : []), event.message];
        for (const message of messages) {
          if (message?.role !== 'assistant') continue;
          if (['error', 'aborted'].includes(message.stopReason)) pendingModelError = true;
          else if (['stop', 'length', 'toolUse'].includes(message.stopReason))
            pendingModelError = false;
        }
      }
      if (
        event.type === 'extension_ui_request' &&
        ['select', 'confirm', 'input', 'editor'].includes(event.method)
      ) {
        send({ type: 'extension_ui_response', id: event.id, cancelled: true });
        failure ??= 'intervention-required';
        finished = true;
      }
      if (event.type === 'extension_error') failure ??= 'extension-error';
      if (event.type === 'response' && event.id === 'eval-prompt' && event.success === false) {
        failure ??= 'prompt-failed';
        finished = true;
      }
      if (event.type === 'response' && event.id === 'eval-stats') {
        if (!statsRequested || event.success !== true || !validSessionStats(event.data))
          failure ??= 'stats-failed';
        else stats = event.data;
        finished = true;
      }
      const terminal = event.type === 'agent_end' && event.isTerminal !== false;
      if (terminal && pendingModelError) failure ??= 'model-error';
      const local =
        (event.type === 'response' &&
          event.id === 'eval-prompt' &&
          event.success === true &&
          event.data?.agentInvoked === false) ||
        (event.type === 'prompt_result' &&
          event.id === 'eval-prompt' &&
          event.agentInvoked === false);
      if ((terminal || local) && !statsRequested && !finished) {
        statsRequested = true;
        send({ id: 'eval-stats', type: 'get_session_stats' });
      }
    },
  };
}

export function buildRpcInvocation({ cwd, model, thinking }) {
  const append =
    readFileSync(path.join(cwd, '.omp/APPEND_SYSTEM.md'), 'utf8') +
    '\nThis is an isolated, local-only workflow evaluation. Never commit, push, open/update PRs, or invoke scripts/ai-pr.mjs. Treat missing browser evidence as UNPROVEN.\n';
  const args = [
    '--mode',
    'rpc',
    '--no-session',
    '--config',
    path.join(cwd, '.omp/eval.config.yml'),
    '--no-extensions',
    '--extension',
    path.join(cwd, '.omp/extensions/safety-guard.js'),
    '--append-system-prompt',
    append,
  ];
  if (model) args.push('--model', model);
  if (thinking) args.push('--thinking', thinking);
  return args;
}

export function runOmpRpc({
  cwd,
  prompt,
  model,
  thinking,
  timeoutMs,
  spawnProcess = spawn,
  maxOutputBytes = 32 * 1024 * 1024,
}) {
  return new Promise((resolve) => {
    const args = buildRpcInvocation({ cwd, model, thinking });
    const startedAt = Date.now();
    const child = spawnProcess('omp', args, {
      cwd,
      env: {
        ...isolatedGitEnvironment(cwd),
        OMP_GUARD_MODE: 'autonomous',
        OMP_GUARD_FILE_SCOPE: 'repository',
        OMP_GIT_MUTATION: 'deny',
        AI_PR_DELIVERY: 'off',
        OMP_EVAL_RUN: '1',
        OMP_GUARD_EXTERNAL_MUTATION: 'deny',
        OMP_PROJECT_ROOT: cwd,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const events = [];
    let stderr = '';
    let buffer = '';
    let bytes = 0;
    const decoder = new StringDecoder('utf8');
    let forcedTimer;
    const tracker = createRpcTracker((event) => child.stdin.write(`${JSON.stringify(event)}\n`));
    function terminate(signal = 'SIGTERM') {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        /* The owned subprocess already exited. */
      }
    }
    function stop() {
      child.stdin.end();
      if (!forcedTimer)
        forcedTimer = setTimeout(() => {
          terminate();
          forcedTimer = setTimeout(() => terminate('SIGKILL'), 1000);
        }, 1000);
    }
    const timeout = setTimeout(() => {
      tracker.fail('timeout');
      stop();
    }, timeoutMs);
    function line(value) {
      if (!value.trim()) return;
      events.push(value);
      try {
        tracker.accept(JSON.parse(value));
      } catch {
        tracker.fail('invalid-jsonl');
      }
      if (tracker.state.finished) stop();
    }
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) {
        tracker.fail('output-limit');
        stop();
        return;
      }
      buffer += decoder.write(chunk);
      let index = buffer.indexOf('\n');
      while (index >= 0) {
        line(buffer.slice(0, index).replace(/\r$/, ''));
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf('\n');
      }
    });
    child.stderr.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) {
        tracker.fail('output-limit');
        stop();
        return;
      }
      stderr += chunk.toString('utf8');
    });
    child.stdin.on('error', (error) => {
      if (!tracker.state.finished) tracker.fail('stdin-error');
      stderr += `stdin: ${error.code ?? 'error'}\n`;
    });
    child.on('error', (error) => tracker.fail(`spawn-error: ${error.code ?? error.message}`));
    child.on('close', (exitCode, signal) => {
      line((buffer + decoder.end()).replace(/\r$/, ''));
      clearTimeout(timeout);
      clearTimeout(forcedTimer);
      if (exitCode !== 0 && exitCode !== null) tracker.fail('process-failed');
      resolve({
        ...tracker.state,
        durationMs: Date.now() - startedAt,
        exitCode,
        signal,
        stderr,
        events,
      });
    });
    // Keep /wf-* at byte zero: prefixing an instruction prevents native expansion.
    child.stdin.write(
      `${JSON.stringify({ id: 'eval-prompt', type: 'prompt', message: prompt })}\n`,
    );
  });
}
