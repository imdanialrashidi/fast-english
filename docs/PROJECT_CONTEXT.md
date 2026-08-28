# Project context readiness

The repository ships durable contract templates so OMP can begin safely without
inventing product facts. Before a real product implementation, run:

```bash
node scripts/validate-project-context.mjs --static
```

The template is expected to report `NOT READY`. Run `/wf-bootstrap`, replace the
empty prompts in `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, and
`docs/QUALITY.md` with confirmed decisions or explicit `UNKNOWN` values, then
turn the check into a gate:

```bash
node scripts/validate-project-context.mjs --require-ready
```

An explicit unknown is honest context and is accepted; an empty field, empty
table row, missing file, or generic template instruction is not. The validator
does not judge whether a decision is good, and it does not replace product,
design, architecture, or quality review. Keep the gate informational until the
project has actually been bootstrapped.

## Domain skill routing

Four optional project skills add focused evidence contracts without duplicating
OMP's native tools or bundled agents:

- `accessibility-audit` — WCAG keyboard, semantics, focus, contrast, reflow,
  target-size, motion and error-state evidence;
- `web-performance` — repeatable lab measurements, Core Web Vitals and
  before/after performance evidence;
- `technical-seo` — public-route rendering, metadata, crawl directives,
  canonical, sitemap and structured-data checks;
- `rtl-i18n` — direction, bidi, formatting and long-string behavior.

OMP should load these only when their descriptions match the accepted scope.
Use `evals/skill-cases.json` and `node scripts/validate-skill-evals.mjs` as the
positive/negative routing contract. The manifest proves coverage of routing
fixtures, not that a model has achieved a quality lift; run matched OMP model
trials before making that claim.
