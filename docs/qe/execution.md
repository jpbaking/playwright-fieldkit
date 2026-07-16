# Test Case Execution and Evidence

For workflow selection, return to the [User Guide](../user-guide.md).

Use this guide when an approved test case or established test guide already
exists and must be executed in a browser for QE review.

This workflow set produces a journey, execution report, trace, and confirmation.
It does not create permanent automation before confirmation.

## Accepted inputs

`/pw-execute-test-case` accepts:

- an approved FieldKit `test-cases.json` plus a selected case ID; or
- an existing organizational test case or guide with preconditions, ordered
  actions, and observable expected results.

If the document only contains feature requirements, stop and use the
[Feature Specification to Test Cases guide](test-design.md). FieldKit
case sets must pass the `--require-approved` gate before execution.

## Map the source before running

The agent creates `report/test-case-run/source-map.md` showing:

- source step or reference;
- interpreted browser action;
- expected result and assertion;
- assumptions;
- eventual observed status.

Review this mapping before execution. The agent may resolve element locators,
but it must not invent missing expected results or redefine them using current
product behavior.

## Choose headed or headless execution

The agent always offers:

- **Headed:** the agent controls a visible browser while the QE watches. The QE
  should not interact with the page during execution.
- **Headless:** the same journey runs without a browser window.

Both modes always capture a Playwright trace.

## Execute the journey

The approved case is translated to `report/test-case-run/flow.json` and run with
trace capture:

```bash
node .cline/skills/pw-playwright-fieldkit/scripts/flow.mjs \
  report/test-case-run/flow.json \
  --out report/test-case-run --trace
```

Headed execution adds `--headed`. Authentication, device, browser, and scope
options may also be added without removing `--trace`.

The output includes:

- `flow.md` and `flow.json` — step results;
- `trace.zip` — actions, assertions, snapshots, and network evidence;
- `FAILED-step-N.png` — failure screenshot when applicable;
- the updated source map.

The agent distinguishes a product mismatch, an automation/setup failure, and an
outcome that cannot be objectively observed.

## Review the trace and confirm

The trace must exist and be non-empty even when a step fails. The agent opens
the viewer when graphical access is available or provides the path and command:

```bash
node .cline/skills/pw-playwright-fieldkit/scripts/node_modules/playwright/cli.js \
  show-trace report/test-case-run/trace.zip
```

After offering the trace, the agent asks:

> Does this execution match the steps and expected results in the source test
> case? Reply **yes**, **no** with the mismatched step, or
> **unable to confirm**.

The runner passing is not user confirmation.

- **Yes:** record the confirmation in `review.md`. Unless the user requested an
  evidence-only run, continue to permanent automation.
- **No:** correct and rerun a bad translation, or report a likely product defect
  when the faithful execution disagrees with the approved case.
- **Unable to confirm:** keep the evidence unconfirmed and identify the missing
  product or domain knowledge.

## Report a likely defect

Include the smallest reproduction, environment/build, browser/device, role,
preconditions, expected and actual results, frequency, affected data, cleanup,
and trace path. The journey trace explains the witnessed translation. Once a
permanent test exists, attach its permanent-run trace to the developer issue.

## Handoff

After a “yes,” continue to the
[Permanent Test Automation guide](automation.md). That workflow creates
repository-native test code and produces a separate mandatory trace from the
permanent test runner.
