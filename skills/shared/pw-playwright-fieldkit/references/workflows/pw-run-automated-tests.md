# /pw-run-automated-tests — run permanent tests and report traces

Goal: run existing repository-native Playwright tests without generating or
editing them, then report results with a retained trace for every test run.

## Step 1 — Identify the permanent test scope

Inspect the repository's existing runner, configuration, scripts, test
directories, projects, and nearby tests. Use the user's explicit test path,
title, marker, project, or suite selection. If no scope was supplied and running
the whole suite could be slow or destructive, ask for the intended scope.

This workflow accepts permanent Python, TypeScript, or JavaScript test code. It
does not accept a feature specification, test-case document, `flow.json`, or
recording:

- feature specification → `pw-design-test-cases.md`;
- approved test-case document → `pw-execute-test-case.md`;
- confirmed journey requiring test code → `pw-generate-tests.md`.

Do not change assertions, fixtures, retries, timeouts, or product code merely to
make the selected tests pass.

## Step 2 — Confirm environment and execution mode

Identify the target environment, authorization, authentication, test data,
cleanup, and potentially destructive effects from the runner configuration and
selected tests. Do not run destructive permanent tests against production.

Offer headed or headless execution for a local interactive run. Follow the
repository's configured mode in CI unless the user requests an override. The
mode never changes the trace requirement.

## Step 3 — Run with tracing forced on

Create a unique artifact directory for this run so existing traces are not
overwritten. Use the repository's normal command and force tracing on for every
selected test. Typical direct-runner examples are:

```bash
# pytest-playwright
pytest <scope> --tracing=on \
  --output=report/automated-tests/<run-id>/test-results

# @playwright/test
npx playwright test <scope> --trace on \
  --output report/automated-tests/<run-id>/test-results
```

Add `--headed` only when selected. If the repository wraps the runner, use its
equivalent options or configuration while preserving `--tracing=on` or
`--trace on`. Do not substitute `on-first-retry` or `retain-on-failure`: this
workflow requires traces for passing and failing runs.

Preserve the real exit code. Do not automatically retry a failure; a retry is a
separate run with its own artifact directory.

## Step 4 — Verify evidence and report results

Inventory all trace archives after execution and map each trace to its test,
project/browser, and result. A missing or empty expected trace makes the run
evidence-incomplete even if the test runner passed. Correct trace configuration
and rerun before calling the evidence complete.

Report:

- exact command, working directory, environment, and execution mode;
- selected scope, browser/project, and relevant commit/build when known;
- passed, failed, skipped, and flaky counts;
- each failed test's first useful error and artifact directory;
- every non-empty trace path, grouped by test and result;
- cleanup outcome and any evidence limitation.

Always offer the traces for review. On a graphical desktop, open a selected
trace when the user wants to inspect it — launch the viewer detached (in the
background) so the blocking process does not stall or get killed by the agent's
own command timeout — otherwise provide the clickable path and exact local
command:

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/node_modules/playwright/cli.js \
  show-trace <trace.zip> &
```

Treat traces as potentially sensitive. Do not upload them or file external
issues without explicit authorization. When asked to file a developer issue,
attach the relevant permanent-test trace and include the exact test result and
reproduction command.

Stop after reporting. Test modification belongs to a separate fix request;
intermittent behavior belongs to `pw-triage-flaky-test.md`.
