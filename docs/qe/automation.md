# Permanent Test Automation

For workflow selection, return to the [User Guide](../user-guide.md).

Use this guide to generate or run maintainable repository-native automation.
Permanent automated tests live in the project's normal Python, TypeScript, or
JavaScript test directory.

## Choose the workflow by artifact

| What you have | What you want | Workflow |
|---|---|---|
| A demonstration | Capture and automate it | `/pw-record-flow` |
| A confirmed journey or `flow.json` | Create permanent test code | `/pw-generate-tests` |
| Existing permanent Python/TypeScript/JavaScript tests | Run them unchanged and report traces | `/pw-run-automated-tests` |

### Run existing permanent automated tests

Use `/pw-run-automated-tests` when test code already exists and the request is
only to execute it. This workflow does not generate or edit tests. It selects
the repository's normal runner, offers headed or headless execution, forces a
trace for every selected test, preserves the real exit code, and reports all
results and trace paths.

Example:

> Run `tests/e2e/test_checkout.py` as permanent automation. Do not change the
> tests. Run headless and report every result with its trace.

### Demonstrate a journey

Use `/pw-record-flow` when a person knows how the feature should behave but does
not have a test case or flow to supply. A browser and Playwright Inspector open;
the user demonstrates the journey, then explains the intent and expected
outcomes.

The recording is only a draft. It may contain accidental actions, sensitive
values, fragile locators, or no meaningful assertions. The agent reviews it,
adds outcomes, fits repository conventions, and then creates the permanent test.

### Generate from a confirmed journey

Use `/pw-generate-tests` when a journey has already passed trace review and QE
confirmation. This is the workflow whose primary deliverable is permanent test
code.

It detects the existing runner and conventions, refactors the journey to use
existing fixtures and helpers, and preserves its outcome assertions.

## Make test data repeatable

Use `/pw-plan-test-data` before automating journeys that create or modify data.
Document:

- whether data belongs to a test, worker, run, or shared read-only fixture;
- unique identifiers and account ownership;
- API/factory setup versus UI behavior actually under test;
- cleanup after success, failure, or interruption;
- whether cleanup is safe to repeat;
- which tests can run concurrently without collision.

Use existing project fixtures, factories, API clients, and secret management.
Do not invent application endpoints. Force a midway failure to verify cleanup.

## Check outcomes, not only actions

Clicking Apply is an action. Confirming the reduced and persisted total is an
assertion. Prefer user-visible meaning and stable test identifiers over CSS
implementation details or timing assumptions.

Keep each test focused. A huge journey spanning unrelated features is difficult
to diagnose and maintain.

## Add justified failure paths

Use `/pw-generate-negative-tests` for risks such as:

- invalid or missing input;
- denied roles;
- duplicate submission or conflicts;
- unavailable dependencies;
- loading, empty, and recoverable error states.

Check the visible error and the invariant that must remain true—for example, no
charge occurred or the original total did not change. Use controlled mocks only
when real staging behavior is unsafe or non-deterministic; do not mock away the
integration the test is meant to cover.

## Check interactive accessibility

Use `/pw-audit-journey` after opening menus and dialogs or producing validation,
loading, empty, error, and confirmation states. The built-in audit is a smoke
check for language, heading structure, labels, landmarks, and accessible names.

It does not prove WCAG conformance. Retain manual keyboard and screen-reader
assessment and use the project's axe fixtures when available.

## Generate and verify new permanent test code

The confirmed flow is executed with a journey trace while generating code:

```bash
node .cline/skills/pw-playwright-fieldkit/scripts/flow.mjs confirmed-flow.json \
  --out report/tests/login --trace \
  --gen-test tests/e2e/test_login.py
```

After generation, `/pw-generate-tests` hands the new path to
`/pw-run-automated-tests`. That workflow runs the permanent test with tracing
forced on, using commands equivalent to:

```bash
# pytest-playwright
pytest tests/e2e/test_login.py --tracing=on \
  --output=report/tests/permanent-python

# @playwright/test
npx playwright test tests/login.spec.ts --trace on \
  --output report/tests/permanent-node
```

Verify that the test result and at least one non-empty trace archive exist.
Retain traces for successful and failed permanent verification runs. Attach the
permanent-run trace when filing a resulting developer issue.

## Automation checklist

- Is the source journey approved or confirmed?
- Does the permanent test assert business outcomes?
- Does it use the repository's runner, fixtures, style, and test directory?
- Are credentials and personal data absent?
- Is test data isolated and cleanup safe to repeat?
- Can parallel tests collide?
- Are negative and accessibility states justified by risk?
- Was the permanent test executed with tracing enabled?
- Is the reported trace non-empty and safe to share?

For broader selection after the primary automation is stable, continue to the
[Coverage and Variants guide](coverage.md).
