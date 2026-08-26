# Research Basis and Optimization Record

Reviewed: **2026-08-23**. Test-quality amendment reviewed: **2026-08-24**. This record connects current primary evidence to concrete workflow controls. It does not claim that a prompt- or tool-level change improves every model or repository; deterministic tests protect invariants, and repeated matched-model evals remain the promotion standard.

## Result in one page

The optimized workflow keeps a small model-neutral core and loads specialization only when the task needs it:

1. **No provider/model/thinking pin.** Pi uses the operator's active selection. Rules route by capability and provide fallbacks when image input, subagents, extended thinking, or a large context window is absent.
2. **Less always-loaded policy.** `AGENTS.md` is the repository map; detailed procedure stays in on-demand docs, prompts, and skills.
3. **Adaptive tool surface.** The launcher starts with eight schemas instead of 19: seven core repository tools plus `harness_tools`. Planning, delegation, browser, LSP, docs, and web groups remain installed and activate additively only when required.
4. **Conditional orchestration.** One primary writer handles normal work. Scout/reviewer/security roles are used only for a named ambiguity or risk; a separate self-review is the universal fallback.
5. **Schema prevention before repair.** On the exact reviewed Pi pin, capability-gated strict-prefer JSON-schema sampling is enabled for supported built-ins, while Pi's existing pre-validation argument preparation and the MCP proxy's object/JSON-string handling remain authoritative. The workflow does not guess-repair schema-invalid calls after validation.
6. **Implementation autonomy, scoped PR delivery.** Owner-adopted policy on 2026-08-26 adds verified commit/push/PR handoff through a fixed `ai-changes` helper. Main integration and other external actions remain owner-controlled. This is a user authority choice, not a claim of improved model quality.
7. **Cheap smoke, rigorous promotion.** Eval defaults to one trial for routine regression feedback; promotion still requires repeated, isolated baseline/candidate trials with identical settings and qualitative review.
8. **Bounded context and recovery.** Implicit large-file reads are focused, a third identical call is stopped after two errors, and only compact mechanical continuity state—not raw tool input/output—is recovered after resume or compaction.

## Primary evidence and resulting decisions

| Primary source | Evidence used | Decision here | Limitation |
|---|---|---|---|
| Pi, [settings](https://pi.dev/docs/latest/settings) | Provider/model/thinking, compaction, retry, and timeout settings are optional; Pi supplies documented defaults. | Remove repository model/thinking pins and unmeasured timeout/compaction overrides. Keep only reproducibility/security controls plus the exact-pin schema-sampling and bounded runtime toggles, all operator-overridable. | A real project may later justify a measured override; it should be evaluated before becoming global policy. |
| Pi, [usage and context files](https://pi.dev/docs/latest/usage) and [compaction](https://pi.dev/docs/latest/compaction) | Project context is loaded into every task; built-in compaction already summarizes goals, state, decisions, next steps, critical context, and files. | Keep `AGENTS.md` plus the system append concise. Recover only complementary mechanical state (recognized checks, hashed open failures, active capabilities), once, instead of replacing the built-in summary. | Exact attention effects vary by model and task; a compact capsule can still be redundant on some turns. |
| Pi, [extensions and dynamic tool loading](https://pi.dev/docs/latest/extensions) | Extensions can inspect the configured tool catalog, change active tools, mutate already-valid calls, patch results, persist custom entries outside LLM context, and inject context. Pi documents a loader pattern that works across models. | Start with eight schemas and use `harness_tools` to activate six named capability groups. Use the read-call/result hooks for deterministic focusing and custom entries for bounded continuity. | Specialist tasks pay one loader call; dynamic selection must be compared against the 19-tool baseline on representative tasks. |
| Pi, [skills](https://pi.dev/docs/latest/skills) | Pi initially exposes skill name/description, loads the full skill only when selected, and registers `/skill:name` commands by default. | Retain focused skills because they do not all consume every turn; add an explicit `/skill:quick-fix` route for tiny changes and keep test, verification, browser, design, and risk contracts distinct. | Poor descriptions can still cause incorrect selection, so trigger and escalation tests remain necessary. |
| Agent Skills, [specification](https://agentskills.io/specification) and [best practices](https://agentskills.io/skill-creation/best-practices) | Progressive disclosure and concise metadata are part of the interoperable skill model. | Use model-neutral, task-specific descriptions and keep procedural depth in skill bodies/references. | Support and selection behavior differ between hosts. |
| Pi, [custom models](https://pi.dev/docs/latest/models) | Pi supports multiple providers/models and project selection can be overridden at launch. | Treat models as replaceable capabilities; never embed a vendor-specific route in workflow policy. | Model-specific quirks can still require a local, measured adapter. |
| Pi, [0.84.2 release notes](https://pi.dev/news) | The reviewed release adds capability-aware strict JSON-schema constrained sampling for built-in `read`, `bash`, `edit`, and `write` under `PI_EXPERIMENTAL=1`, with strict-prefer fallback behavior. | Enable it by default only because the Pi version is exact-pinned; retain `PI_EXPERIMENTAL=0` for matched diagnostics and re-review the flag before upgrading. | The feature is explicitly experimental and provider/model support varies; structural correctness is not evidence of outcome improvement. |
| Google, [function calling](https://ai.google.dev/gemini-api/docs/function-calling) | Google recommends keeping the active tool set small—roughly 10–20 relevant functions—and using clear schemas. | Start below that bound at eight unique schemas; add only task-relevant groups rather than sending all 19 on every request. | The useful count depends on task/tool similarity; this is a design bound, not proof of quality, and loader overhead can outweigh savings. |
| OpenAI, [function calling](https://developers.openai.com/api/docs/guides/function-calling) | Clear purpose, constrained parameters, and minimized model-side argument work improve tool use. | Use an enum-constrained capability loader with strict-prefer sampling, direct core tools, argv-array checks, explicit scope, and one lazy MCP proxy. | Guidance does not replace repository-specific tool-use evals. |
| Google, [prompt design](https://ai.google.dev/gemini-api/docs/prompting-strategies) | Direct instructions, clear structure, and relevant context are more reliable than diffuse prose. | Put only critical invariants in the always-on core; make acceptance and evidence explicit; remove duplicate narrative. | Prompt behavior remains stochastic and model-dependent. |
| OpenAI Codex, [customization](https://developers.openai.com/codex/customization/overview) | Repository guidance should stay scoped and concise, with deeper instructions near the relevant work. | Use `AGENTS.md` as a map and docs/skills as progressive disclosure. | This source describes Codex, so it is supporting cross-agent evidence rather than a Pi contract. |
| Anthropic, [context windows](https://docs.anthropic.com/en/docs/build-with-claude/context-windows) and Stanford/UC Berkeley, [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/) | More context is not automatically better; long inputs can reduce retrieval of relevant evidence. | Enforce byte/line budgets and remove repeated policy. | Neither source is a controlled ablation of this exact Pi repository. |
| Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | Start with the simplest composable workflow and add agentic complexity only where it pays. | One writer by default; conditional specialists; at most two evidence-driven evaluator/repair rounds. | Long-horizon or unusually risky work may benefit from more orchestration. |
| OpenAI, [subagents](https://developers.openai.com/codex/subagents) | Subagents add independent context and parallelism but also model/tool/token work. | Preserve the capability but do not invoke it automatically for localized work; use self-review when unavailable or unjustified. | This is cross-agent guidance; Pi package behavior must be tested separately. |
| OpenAI, [Harness engineering](https://openai.com/index/harness-engineering/) | Agent-legible repository maps, mechanical invariants, and executable feedback matter alongside model capability. | Convert recurring rules into guard/tests/doctor checks instead of adding prompt prose. | Experience report, not an isolated causal study of each control. |
| UIUC, [Agentless](https://arxiv.org/abs/2407.01489) | A simple localization → repair → validation pipeline can be competitive and cost-effective. | Make that the default coding path; plans and reviewers must earn their cost. | SWE-bench results do not cover every greenfield/UI/high-risk task. |
| Princeton, [SWE-agent](https://arxiv.org/abs/2405.15793) | Purpose-built navigation/edit/execution interfaces materially affect repository performance. | Keep semantic lookup, exact search/edit, and executable verification, while removing only overlapping schemas. | Results reflect the paper's benchmark/model snapshot. |
| Microsoft Research, [CodePlan](https://arxiv.org/abs/2309.12499) | Cross-file work benefits from dependency-aware planning that adapts as evidence changes. | Use affected-file routing and durable plans only for genuinely cross-module/multi-session work. | Static/manual dependency maps can miss runtime wiring. |
| Meta, [TestGen-LLM](https://arxiv.org/abs/2402.09171) and UMass, [CoverUp](https://arxiv.org/abs/2403.16218) | Generated tests need execution, usefulness, and iterative error/coverage signals; passing alone is insufficient. | Keep separate `test-design` and verification-routing skills; require green plus pre-fix red/mutation/equivalent sensitivity when practical. | Coverage is not equivalent to defect detection or maintainability. |
| Google, [test behavior](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html), [prefer public APIs](https://testing.googleblog.com/2015/01/testing-on-toilet-prefer-testing-public.html), and [avoid overusing mocks](https://testing.googleblog.com/2013/05/testing-on-toilet-dont-overuse-mocks.html) | Stable behavior boundaries resist refactors better than private calls; mock-heavy tests can validate their own setup instead of the product. | Require public/authoritative boundaries and reserve mocks for owned expensive, nondeterministic, or unsafe seams. | Some internal invariants are legitimate contracts; the rule is not a ban on unit tests or mocks. |
| Microsoft, [Playwright best practices](https://playwright.dev/docs/best-practices) | Browser tests should verify user-visible behavior, use resilient user-facing locators, and remain isolated. | Use roles/labels and real interaction for browser-only risk; keep journeys narrow and independent. | Browser evidence is costlier and should not replace lower-layer business-rule tests. |
| MuTAP, [mutation-guided test generation](https://arxiv.org/abs/2308.16557), and Meta, [industrial mutation-guided LLM testing](https://arxiv.org/html/2501.12862v1) | Plausible mutations provide concrete feedback about whether generated tests distinguish faulty behavior. | Use a safe focused mutation or isolated pre-fix revision when ordinary red-before-green evidence is unavailable. | Mutation score is a proxy; equivalent/unrealistic mutants and mutation cost require judgment. |
| Siddiq et al., [design choices in LLM-based test generators](https://arxiv.org/abs/2412.14137) | Oracles inferred from current program behavior can produce passing tests that preserve a bug. | Require an independently derived oracle, a named evidence gap, and a distinct failure model before retaining a test. | Independent contracts may be unavailable for legacy behavior; report that limitation instead of inventing certainty. |
| OpenAI, [evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | Use representative task distributions, automated scoring, logs, and predeclared thresholds rather than vibe checks. | Preserve raw traces/artifacts, deterministic graders, matched baseline comparison, and explicit qualitative review. | A useful task distribution must be maintained with real failures. |
| Pi, [RPC mode](https://pi.dev/docs/latest/rpc) | RPC emits structured tool events and session statistics. | Measure tool/error/duplicate/verification/repair/retry/compaction behavior from events, and deterministically reject Git mutation attempts. | Event schemas are version-sensitive. |
| Pi, [security](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md) | Project trust is not sandboxing; real containment is an OS/container/VM concern. | Give trusted implementation broad workspace access, keep secret/destructive/external guards, and use strict container scope for untrusted work. | Regex guards are defense in depth, not a security boundary. |

## Keep / simplify / remove audit

| Surface | Decision | Reason |
|---|---|---|
| `AGENTS.md` + system append | **Simplify** | Always loaded; duplicated routing had ongoing token/attention cost. Critical invariants remain mechanical and concise. |
| Model/provider/thinking defaults | **Remove** | They made the template vendor-specific and could silently override the operator's better/current choice. |
| Compaction/timeout overrides | **Remove** | They duplicated official defaults without repository evidence of a failure mode. The continuity capsule complements compaction rather than changing it. |
| Blind identical-call retry | **Add bounded guard** | Two identical errors are evidence to change the hypothesis. The runtime stores only a short signature/count and clears it after a different successful evidence/action step. |
| `docs/PI_WORKFLOW.md` | **Remove** | Duplicated README/HARNESS and created drift; unique Git authority moved to `docs/GIT_POLICY.md`. |
| 16 slash-command prompts | **Keep on demand** | They cover distinct deliverables and are not all loaded per turn; merging would make selection less precise. |
| 6 specialist skills | **Keep on demand** | Each has a distinct trigger/evidence contract; Pi progressive disclosure avoids constant context cost. `quick-fix` replaces ceremony for genuinely Localized work rather than adding another review stage. |
| Subagent package | **Keep, conditional** | Independent context helps ambiguity/risk, but default invocation adds cost and can dilute ownership. |
| Todo package | **Keep, conditional** | One compact tool helps genuinely multi-step state; localized tasks explicitly avoid it. |
| LSP/docs/web | **Keep deferred** | Semantic/local/current evidence improves correctness when needed, but twelve specialist schemas do not need to accompany every localized task. |
| Playwright MCP | **Keep deferred + lazy** | The single `mcp` schema activates only for browser work. With valid cached metadata the server starts lazily; missing/stale metadata may require a startup catalog connection. |
| Smart Read | **Add bounded focus** | Pi already truncates at 2,000 lines/50 KiB; the extension adds an earlier 400-line bound only for large implicit reads and preserves explicit ranges. |
| Continuity capsule | **Add bounded state** | Exact recent check status and hashed open failures can be lost across resume/compaction. Custom entries persist that state outside normal LLM context and inject it once. |
| Vision-routing security section | **Remove** | The delegated vision tooling had already been removed, so the section was stale and misleading. |
| Git delivery automation | **Scoped, owner-adopted** | A reviewed helper delivers only to persistent `ai-changes` and a matching PR; raw Git/main/merge remain protected and evals force delivery off. |
| Three default eval trials | **Reduce to one smoke trial** | Cuts routine model calls by 66.7%; repeated trials remain explicitly required for promotion-quality comparisons. |

## Dependency review

Exact versions and registry integrity values are recorded in `.pi/package-integrity.json`.

| Package | Reviewed pin | Decision |
|---|---:|---|
| `@earendil-works/pi-coding-agent` | `0.84.2` | Upgrade from `0.84.1`; current reviewed Pi release. |
| `pi-sub-agent` | `0.1.5` | Keep; already current in the audit. |
| `pi-mcp-adapter` | `2.26.1` | Upgrade from `2.20.1`; reviewed fixes include approval correctness, hang/catalog fixes, and lower startup catalog work. |
| `@juicesharp/rpiv-todo` | `2.6.2` | Upgrade from `2.1.0`; keep conditional use. |
| `pi-lsp-adapter` | `0.1.3` | Keep. |
| `@dreki-gg/pi-doc-search` | `0.3.2` | Keep. |
| `@bytetrue/pi-web-search` | `0.2.1` | Upgrade from `0.1.3`; retain one explicit search provider and safe public fetch behavior. |
| `@playwright/mcp` | `0.0.79` | Keep exact lazy pin and restricted browser tool set. |

## Mechanical changes measured in this audit

| Signal | Original | Previous optimized | V3 | Net change |
|---|---:|---:|---:|---:|
| Always-loaded `AGENTS.md` + append | 11,747 bytes / 179 lines | 8,170 bytes / 95 lines | 8,170 bytes / 95 lines | −3,577 bytes (−30.5%), −84 lines |
| Initial launcher tool schemas | 22 | 19 | 8 | −14 (−63.6%) original; −11 (−57.9%) previous |
| On-demand specialist groups | 0 | 0 | 6 groups / 12 schemas | Installed capabilities retained without initial exposure |
| Default eval trials per case | 3 | 1 | 1 | −66.7% routine model calls; promotion trials remain opt-in |
| Project model/thinking pins | 2 | 0 | 0 | Operator/model neutral |
| Duplicate workflow documents | 2 | 1 canonical playbook | 1 canonical playbook | `PI_WORKFLOW.md` removed; `HARNESS.md` retained |
| Runtime behavior tests | 0 | 0 | 7 | Loader, Smart Read, retry, continuity, session reset, redaction, and opt-out invariants |

These are structural efficiency and resilience gains, not an empirical claim that output quality improved for every model. A paid/provider-backed 19-tool-versus-dynamic before/after evaluation was not executed during this audit; deterministic tests, dry-run validation, package integrity checks, runtime startup compatibility, and measured context/tool reductions are the available evidence. Run repeated matched baseline/candidate trials before claiming model-output superiority.

## Optimized universal loop

1. Classify the task; avoid ceremony for a localized change.
2. For non-trivial work, state 3–7 observable acceptance criteria and expected proof.
3. Search/localize on the eight-tool core; activate every required specialist capability together only when core evidence is insufficient.
4. Expose the gap with reproduction, test, or explicit `UNPROVEN` status.
5. Implement one coherent slice with one primary writer.
6. Run the cheapest faithful targeted proof first, then affected routes.
7. Use a specialist/evaluator only for a named ambiguity or material risk; otherwise self-review independently.
8. Run the final/full gate once when scope/risk requires it.
9. Inspect the diff and report criterion → evidence/status.
10. Complete the scoped fixed-branch PR handoff for implementation; keep main integration and other external actions owner-controlled. Never publish from read-only/local-only work or evals.

## Promotion protocol

For an actual workflow comparison:

- use the same case set, suite fingerprint, model, thinking level, timeout, credentials, and starting files;
- run repeated isolated trials (three is a practical minimum, more when variance is high);
- require 100% deterministic pass rate and zero workflow-safety violations;
- reject new Git/GitHub mutation attempts or protected workflow-file edits;
- reject per-case median regression above the declared thresholds for duration, tool calls, tokens, duplicate calls, repair rounds, or repeated full gates;
- compare localized cases and specialist-required cases separately so loader-call overhead and schema savings are both visible;
- keep qualitative product/design/architecture rubrics `UNSCORED` until a blinded evidence review;
- never weaken thresholds after seeing the candidate result.

Passing deterministic gates yields `QUALITATIVE_REVIEW_REQUIRED`, not automatic promotion.

## Project-specific work that remains

`/bootstrap` should replace template examples with evidence from the real repository:

- canonical commands and actual dependency/workspace boundaries;
- recent production bugs, rejected patches, and realistic fixtures;
- current runtime, flake, cost, and task-variance distributions;
- product-specific security, accessibility, performance, data, and recovery gates;
- affected-file routes with conservative full fallback for unmatched paths.

Optimization must not rely on silent omission. If route/capability evidence is uncertain, widen the check or mark the criterion `UNPROVEN`.
