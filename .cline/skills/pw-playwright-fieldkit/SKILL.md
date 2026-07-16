---
name: pw-playwright-fieldkit
description: Explore, debug, audit, compare, record, and test live websites with deterministic Playwright scripts and QE workflows. Use for requests to map a site, find broken pages or links, reproduce browser bugs, discover hidden or role-gated features, audit accessibility/performance, compare crawls, design or review test cases from feature specifications, record a user-demonstrated journey, execute an approved test-case document as a witnessed journey, run existing permanent automated Playwright tests with trace evidence, create test charters, find automation coverage gaps, plan test data or execution matrices, generate negative-path tests, triage flaky tests, save authenticated state, or generate verified Python/Node integration tests.
---

# PW Playwright FieldKit

Drive the bundled scripts and reason over their reports. Do not improvise raw
Playwright code for operations already supported here.

## Package paths

Use this project-skill root:

```text
.cline/skills/pw-playwright-fieldkit
```

Run tools from the workspace root, for example:

```bash
node .cline/skills/pw-playwright-fieldkit/scripts/crawl.mjs <URL> --out report/explore
```

Install once if needed:

```bash
cd .cline/skills/pw-playwright-fieldkit/scripts
npm ci
npx playwright install chromium
cd ../../../..
```

## Route the request

Read and follow exactly one primary workflow. Read another only when the task
genuinely crosses intents.

- Explore, map, health-check, or understand a site: [pw-explore-site](references/workflows/pw-explore-site.md)
- Reproduce a bug or diagnose wrong navigation: [pw-debug-site](references/workflows/pw-debug-site.md)
- Find undocumented, authenticated, or role-gated functionality: [pw-discover-features](references/workflows/pw-discover-features.md)
- Derive traceable draft test cases from a feature specification:
  [pw-design-test-cases](references/workflows/pw-design-test-cases.md)
- Review and explicitly approve specification-derived test cases:
  [pw-review-test-cases](references/workflows/pw-review-test-cases.md)
- Turn a confirmed journey into a permanent traced test: [pw-generate-tests](references/workflows/pw-generate-tests.md)
- Record a journey demonstrated interactively by the user: [pw-record-flow](references/workflows/pw-record-flow.md)
- Execute an approved test-case document as a journey, capture a trace, and
  request confirmation: [pw-execute-test-case](references/workflows/pw-execute-test-case.md)
- Run existing permanent automated tests without changing them and report all
  traces: [pw-run-automated-tests](references/workflows/pw-run-automated-tests.md)
- Capture intent, risk, data, outcomes, and cleanup: [pw-create-test-charter](references/workflows/pw-create-test-charter.md)
- Find crawl routes/forms without test evidence: [pw-analyze-test-coverage](references/workflows/pw-analyze-test-coverage.md)
- Plan isolated setup and idempotent cleanup: [pw-plan-test-data](references/workflows/pw-plan-test-data.md)
- Run meaningful role/browser/device variants: [pw-run-test-matrix](references/workflows/pw-run-test-matrix.md)
- Add deterministic API failure and boundary paths: [pw-generate-negative-tests](references/workflows/pw-generate-negative-tests.md)
- Audit accessibility after interactive state changes: [pw-audit-journey](references/workflows/pw-audit-journey.md)
- Reproduce and classify intermittent failures: [pw-triage-flaky-test](references/workflows/pw-triage-flaky-test.md)
- Audit reliability, accessibility, performance, UX, or testability: [pw-recommend-improvements](references/workflows/pw-recommend-improvements.md)
- Compare before/after, anonymous/authenticated, or role-based crawls: [pw-compare-runs](references/workflows/pw-compare-runs.md)

Natural-language intent is sufficient; do not require the user to type a slash
command. The legacy `.clinerules/workflows/` files are shortcuts into these same
canonical references.

## Tools

- `crawl.mjs`: map reachable same-origin pages, record errors/forms/features,
  audit quality, optionally check links, and checkpoint/resume.
- `inspect.mjs`: deeply capture one page and optional post-click states.
- `flow.mjs`: execute a JSON journey, optionally capture a Playwright trace, and
  generate a `.py` or `.ts`/`.js` test only after it passes. Inspect the
  consuming repository's existing tests before choosing the language; ask if
  its convention is absent or ambiguous.
- `record.mjs`: open headed Playwright Codegen so the user can demonstrate a
  journey; save a language-matched draft for review and verification.
- `charter.mjs`: validate QE intent/risk/data/cleanup and render `journey.md`.
- `test-cases.mjs`: validate requirement traceability, test-case structure, and
  approval status, then render `test-cases.md`.
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
  `.cline/skills/pw-playwright-fieldkit/templates/`.
- The localhost regression suite is under the bundled `scripts/test/` directory.
