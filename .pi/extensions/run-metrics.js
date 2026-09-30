// UI-only: no tools, prompt injection, stored transcripts, or provider calls.
// Pi 0.84.2: agent_end can precede automatic recovery; agent_settled is final.
export default function runMetrics(pi, clock = {
  now: () => performance.now(),
  every: (fn) => setInterval(fn, 1000),
  cancel: (timer) => clearInterval(timer),
}) {
  let run;
  let timer;
  const key = "run-metrics";

  function duration(ms) {
    const seconds = Math.max(0, ms / 1000);
    return seconds < 60 ? `${seconds.toFixed(1)}s`
      : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  }

  function stopTimer() {
    if (timer !== undefined) clock.cancel(timer);
    timer = undefined;
  }

  function render(ctx) {
    if (!ctx.hasUI || !run) return;
    const now = run.end ?? clock.now();
    const elapsed = duration(now - run.start);
    // Union of execution intervals: overlapping tools must not inflate wall time.
    const toolMs = run.toolMs + (run.toolStart === undefined ? 0 : now - run.toolStart);
    const rate = run.completeUsage && run.tokens > 0 && run.modelMs > 0
      ? `${(run.tokens * 1000 / run.modelMs).toFixed(1)} tok/s`
      : "n/a tok/s";
    const state = run.end === undefined ? "running" : run.reason === "aborted"
      ? "aborted" : run.reason === "error" ? "error" : "finished";
    // Rate uses finalized responses only; it remains stable during tool work.
    const cost = run.completeCost && run.cost > 0
      ? run.cost < 0.0001 ? "~<$0.0001" : `~$${run.cost.toFixed(4)}`
      : "cost n/a";
    ctx.ui.setStatus(key, `Run ${elapsed} (${state}) | ${rate} | Tools ${duration(toolMs)} | Retry ${run.retries} | ${cost}`);
  }

  function reset(_event, ctx) {
    stopTimer();
    run = undefined;
    if (ctx.hasUI) ctx.ui.setStatus(key, undefined);
  }

  pi.on("session_start", reset);
  pi.on("session_tree", reset);
  pi.on("session_shutdown", reset);

  pi.on("agent_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    if (!run || run.end !== undefined) {
      stopTimer();
      run = {
        start: clock.now(), tokens: 0, modelMs: 0, completeUsage: true,
        tools: new Set(), toolMs: 0, retries: 0, retryPending: false,
        cost: 0, completeCost: true,
      };
      timer = clock.every(() => render(ctx));
      timer?.unref?.();
    }
    render(ctx);
  });

  // message_start timing differs across providers. turn_start consistently
  // precedes request setup/first-token wait; tools from the prior turn are done.
  pi.on("turn_start", () => {
    if (!run || run.end !== undefined) return;
    // Public extension events expose a new turn after an assistant error, not
    // provider-internal HTTP retries. Normal tool turns are not retries.
    if (run.retryPending) run.retries++;
    run.retryPending = false;
    run.turnStart = clock.now();
  });

  pi.on("tool_execution_start", (event, ctx) => {
    if (!run || run.end !== undefined || run.tools.has(event.toolCallId)) return;
    if (run.tools.size === 0) run.toolStart = clock.now();
    run.tools.add(event.toolCallId);
    render(ctx);
  });

  pi.on("tool_execution_end", (event, ctx) => {
    if (!run || run.end !== undefined || !run.tools.delete(event.toolCallId)) return;
    if (run.tools.size === 0) {
      run.toolMs += clock.now() - run.toolStart;
      run.toolStart = undefined;
    }
    render(ctx);
  });

  pi.on("message_end", (event, ctx) => {
    if (!run || run.end !== undefined || event.message.role !== "assistant") return;
    const elapsed = clock.now() - run.turnStart;
    const output = event.message.usage?.output;
    if (Number.isFinite(output) && output > 0 && Number.isFinite(elapsed) && elapsed > 0) {
      run.tokens += output;
      run.modelMs += elapsed;
    } else {
      // Zero/missing usage is common on failed or unsupported providers.
      // Never estimate tokens from characters or display misleading infinity.
      run.completeUsage = false;
    }
    run.turnStart = undefined;
    run.reason = event.message.stopReason;
    run.retryPending = run.reason === "error";
    // Pi calculates USD estimates from configured model rates, not invoices.
    // All-zero defaults on custom/subscription providers do not prove free use.
    const usage = event.message.usage;
    const parts = ["input", "output", "cacheRead", "cacheWrite"];
    const total = usage?.cost?.total;
    const knownCost = parts.every((part) => Number.isFinite(usage?.[part]) && usage[part] >= 0
      && Number.isFinite(usage?.cost?.[part]) && usage.cost[part] >= 0)
      && Number.isFinite(total) && total > 0
      && parts.some((part) => usage[part] > 0)
      && Math.abs(parts.reduce((sum, part) => sum + usage.cost[part], 0) - total) <= Math.max(1e-12, total * 1e-9);
    if (knownCost) run.cost += total;
    else run.completeCost = false;
    render(ctx);
  });

  pi.on("agent_settled", (_event, ctx) => {
    // Another extension may have started work in an earlier settled handler.
    if (!run || run.end !== undefined || !ctx.isIdle()) return;
    run.end = clock.now();
    stopTimer();
    render(ctx);
  });
}
