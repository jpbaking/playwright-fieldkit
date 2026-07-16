---
name: playwright-fieldkit
description: Explore, debug, audit, compare, record, and test live websites with deterministic Playwright scripts and QE workflows. Use for requests to map a site, find broken pages or links, reproduce browser bugs, discover hidden or role-gated features, audit accessibility/performance, compare crawls, record a user-demonstrated journey, create test charters, find automation coverage gaps, plan test data or execution matrices, generate negative-path tests, triage flaky tests, save authenticated state, or generate verified Python/Node integration tests.
---

# Playwright FieldKit

Drive the bundled scripts and reason over their reports. Do not improvise raw
Playwright code for operations already supported here.

## Package paths

Use this project-skill root:

```text
.cline/skills/playwright-fieldkit
```

Run tools from the workspace root, for example:

```bash
node .cline/skills/playwright-fieldkit/scripts/crawl.mjs <URL> --out report/explore
```

Install once if needed:

```bash
cd .cline/skills/playwright-fieldkit/scripts
npm ci
npx playwright install chromium
cd ../../../..
```

## Route the request

Read and follow exactly one primary workflow. Read another only when the task
genuinely crosses intents.

- Explore, map, health-check, or understand a site: [explore-site](references/workflows/explore-site.md)
- Reproduce a bug or diagnose wrong navigation: [debug-site](references/workflows/debug-site.md)
- Find undocumented, authenticated, or role-gated functionality: [discover-features](references/workflows/discover-features.md)
- Turn a confirmed journey into a verified test: [generate-tests](references/workflows/generate-tests.md)
- Record a journey demonstrated interactively by the user: [record-flow](references/workflows/record-flow.md)
- Capture intent, risk, data, outcomes, and cleanup: [create-test-charter](references/workflows/create-test-charter.md)
- Find crawl routes/forms without test evidence: [analyze-test-coverage](references/workflows/analyze-test-coverage.md)
- Plan isolated setup and idempotent cleanup: [plan-test-data](references/workflows/plan-test-data.md)
- Run meaningful role/browser/device variants: [run-test-matrix](references/workflows/run-test-matrix.md)
- Add deterministic API failure and boundary paths: [generate-negative-tests](references/workflows/generate-negative-tests.md)
- Audit accessibility after interactive state changes: [audit-journey](references/workflows/audit-journey.md)
- Reproduce and classify intermittent failures: [triage-flaky-test](references/workflows/triage-flaky-test.md)
- Audit reliability, accessibility, performance, UX, or testability: [recommend-improvements](references/workflows/recommend-improvements.md)
- Compare before/after, anonymous/authenticated, or role-based crawls: [compare-runs](references/workflows/compare-runs.md)

Natural-language intent is sufficient; do not require the user to type a slash
command. The legacy `.clinerules/workflows/` files are shortcuts into these same
canonical references.

## Tools

- `crawl.mjs`: map reachable same-origin pages, record errors/forms/features,
  audit quality, optionally check links, and checkpoint/resume.
- `inspect.mjs`: deeply capture one page and optional post-click states.
- `flow.mjs`: execute a JSON journey and generate a `.py` or `.ts`/`.js` test
  only after it passes. Inspect the consuming repository's existing tests before
  choosing the language; ask if its convention is absent or ambiguous.
- `record.mjs`: open headed Playwright Codegen so the user can demonstrate a
  journey; save a language-matched draft for review and verification.
- `charter.mjs`: validate QE intent/risk/data/cleanup and render `journey.md`.
- `coverage.mjs`: compare crawl routes/forms with literal test navigation evidence.
- `matrix.mjs`: run an explicit role/browser/device command matrix without a shell.
- `triage.mjs`: repeat one test command and classify mixed failure signals.
- `compare.mjs`: compare same-origin crawl datasets.
- `save-auth.mjs`: save browser storage state for authenticated runs.

Read Markdown output first. Use JSON only for details omitted from the report.
Keep generated reports in the workspace, not inside the skill package.

## Safety

- Test only sites the user owns or is authorized to assess.
- If `fieldkit.config.json` or the skill's `scripts/targets.txt` exists, respect
  its allowlist. Never add `--i-am-authorized` without explicit user confirmation.
- Normal crawling is passive; `--spa` clicks navigation-like elements and may
  trigger application handlers. `flow.mjs` can mutate data.
- Keep page caps and delays polite. Use `--check-links` only when the extra
  requests are in scope.
- Treat auth state as a live secret. Redaction is best-effort; review artifacts
  before sharing.

## Bundled resources

- Human documentation remains in workspace `docs/`.
- Test scaffolds and flow examples are in
  `.cline/skills/playwright-fieldkit/templates/`.
- The localhost regression suite is under the bundled `scripts/test/` directory.
