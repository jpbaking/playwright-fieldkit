# Permanent Test Automation

For workflow selection, return to the [User Guide](../user-guide.md).

Use this guide to generate or run maintainable repository-native automation.
Permanent automated tests live in the project's normal Python, TypeScript, or
JavaScript test directory.

## Choose the workflow by artifact

| What you have | What you want | Workflow |
|---|---|---|
| A demonstration | Capture and automate it | `/pw-record-flow` |
| Application source code and a running instance, but no specification | Derive candidate journeys and reconcile them against a crawl | `/pw-derive-tests-from-code` |
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

### Derive candidates from the application source

Use `/pw-derive-tests-from-code` when there is no specification to design from
and a crawl alone leaves the surface under-covered — parameterized routes,
role-gated pages, and server-side validation are invisible to black-box
exploration until a test trips them.

It reads the routing and handler code for candidate journeys, then reconciles
every candidate against a crawl of a matching revision, so code that cannot be
reached never becomes a test. Its deliverable is confirmed intent, which it
hands to `/pw-generate-tests`.

Its expected results come from the implementation, so it labels each one:
specified, derived, or contested. Because source code cannot tell intended
behavior from a bug, the workflow first asks which goal the run serves:

- **verify** — the tests must encode intended behavior. Structural expectations
  (a route exists, an anonymous user is redirected, a required field is
  rejected) may be asserted from code, but a business value — a total, a price,
  a state transition — never is. The agent asks you for the intended value
  without showing you the code's answer, asserts the observable shape instead,
  or records it unasserted.
- **lock** — the tests are a regression harness captured before a refactor, so
  current behavior is the specification on purpose. Derived business values
  *are* asserted, tagged with the revision they were captured from and flagged
  as verifying nothing about correctness.

Pick **lock** only when something is about to change underneath the app, and
retire the suite when it does. Once a specification exists,
`/pw-design-test-cases` is the better source of intent than any code reading.

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
node ~/.agents/skills/pw-playwright-fieldkit/scripts/flow.mjs confirmed-flow.json \
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

The scaffold `playwright.config.ts` keeps `trace: 'on-first-retry'` so routine
development and CI runs stay lean; evidence runs force `--trace on` (or
`--tracing=on`) on the command line, which overrides the config for every
selected test.

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
