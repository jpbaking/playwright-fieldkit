# QA/QE Guide

This guide is for quality engineers, manual testers moving into automation, and
product specialists who can demonstrate behavior more easily than they can write
Playwright code. For CLI flags and file formats, use the
[Coder Guide](user-guide.md).

## The basic workflow: demonstrate, then explain

You do not need to begin with selectors or test code.

1. Ask the agent: “Let me demonstrate the checkout journey at `<URL>`,” or use
   `/record-flow`.
2. Use the visible website normally while Playwright records your actions.
3. Close the recorder when the journey is complete.
4. Explain the business intent and what should prove success.
5. Let the agent inspect related states, create a charter, add assertions, fit
   the repository's Python or Node conventions, and execute the test.

Example intent supplied after recording:

> I was showing that a returning customer can apply a valid coupon. The
> discounted total must remain after reopening the cart. An invalid coupon must
> not change the total.

The recording says **what you did**. Your explanation says **what matters**.
The agent preserves both as reviewed tests, journey charters, and optional
`flow.json` artifacts; the AI model itself is not retrained.

> Use local or staging environments for demonstrations. Actions are real, and
> typed values can appear in draft source. Prefer saved authentication state to
> typing real passwords.

## A QE automation lifecycle

| QE activity | Shortcut | Result |
|---|---|---|
| Demonstrate behavior | `/record-flow` | Recorded draft plus reviewed test/flow |
| Preserve intent and risk | `/create-test-charter` | `journey.md` and normalized JSON |
| Find missing automation | `/analyze-test-coverage` | Route/form gap report |
| Plan reliable data | `/plan-test-data` | Setup, isolation, ownership, cleanup plan |
| Add failure paths | `/generate-negative-tests` | Verified mocked/real negative tests |
| Check interactive accessibility | `/audit-journey` | State-specific accessibility assertions |
| Exercise meaningful variants | `/run-test-matrix` | Role/browser/device result matrix |
| Diagnose intermittency | `/triage-flaky-test` | Repeated-run evidence and classification |

These workflows also activate from normal language; the slash commands are
shortcuts when you want to be explicit.

## 1. Create a journey charter

A recording without intent tends to become a brittle replay. A charter records
the QE reasoning needed to maintain the automation:

- user/persona and business risk;
- preconditions and test data;
- observable outcomes;
- negative and boundary cases;
- destructive behavior and cleanup;
- meaningful role/browser/device variants;
- links to the recording, flow, and final test.

Ask `/create-test-charter` after describing the intent. The agent uses the
bundled template and validates that outcomes exist and destructive journeys have
cleanup. Warnings identify missing preconditions, data isolation, or similar
review items.

## 2. Find coverage gaps

Ask `/analyze-test-coverage` after crawling the relevant environment and role.
The agent compares discovered routes and forms with literal navigation evidence
in the existing Python or Node tests.

Treat this as a planning aid, not a coverage percentage. Helpers, dynamic routes,
and parameterized URLs can look uncovered. The agent should verify high-risk
gaps, then prioritize primary journeys, role boundaries, defect-prone areas, and
data-changing forms rather than creating one shallow test per page.

## 3. Make test data repeatable

Ask `/plan-test-data` before automating journeys that create or modify data. The
agent inspects existing fixtures and API clients, then documents:

- how each test gets unique or isolated data;
- which account/worker owns it;
- whether setup should use API/factories or the UI under test;
- cleanup after success, failure, or interruption;
- whether cleanup is safe to repeat;
- which tests can run concurrently.

The package includes Python and TypeScript lifecycle scaffolds, but the agent
must adapt them to real project APIs rather than invent endpoints.

## 4. Add meaningful negative paths

Ask `/generate-negative-tests` with the charter's risk. Good candidates include:

- invalid or missing input;
- unauthorized roles;
- conflicts and double-submit behavior;
- dependency failures or disconnections;
- recoverable error, empty, and loading states.

Flows support deterministic `mockResponse` and `mockAbort` steps. The agent
should assert both the visible error handling and protected invariants such as
“no charge occurred,” “input was retained,” or “the original total was not
changed.” Avoid mocking so much that the test no longer exercises useful
integration.

## 5. Audit accessibility after interactions

Page-load audits miss menus, dialogs, validation messages, and error states.
Ask `/audit-journey` to place `auditA11y` checks after meaningful interactions.
The check covers document language, main/h1 structure, form labels, and names for
buttons, links, and dialogs, and is emitted into generated Python/Node tests.

This is a repeatable smoke check, not proof of WCAG conformance. Continue manual
keyboard/screen-reader assessment and use the project's axe setup when present.

## 6. Choose a risk-based matrix

Ask `/run-test-matrix` to select combinations justified by product risk:

- anonymous/customer/admin roles;
- Chromium plus engines with real support risk;
- desktop/mobile layouts with distinct behavior;
- locale/timezone variants for affected journeys.

Do not run every test against every combination. Keep a fast primary path, use
isolated accounts/data for parallel variants, and prefer the repository runner's
native projects/parameters when already configured.

## 7. Triage flaky tests with evidence

Ask `/triage-flaky-test` with the narrowest command that reproduces the suspect
test. The agent repeats it, preserves per-run logs/artifacts, and classifies
signals such as locator/readiness, timing, network/backend, shared data,
browser/infrastructure, and product/assertion failures.

For mixed pass/fail results, compare at least one passing and failing trace. Fix
the readiness, ownership, isolation, environment, or product cause. Do not use
sleeps, larger timeouts, retries, or quarantine as the automatic answer.

## Review checklist before committing automation

- Does the test assert the charter's outcome rather than only replay actions?
- Are credentials and personal data absent from source and reports?
- Is setup focused and cleanup idempotent?
- Can parallel runs collide on accounts or data?
- Are selectors user-facing or intentionally stable?
- Are error and accessibility states checked where risk justifies them?
- Was the final test run with the project's normal command?
- Are remaining manual-only risks recorded?

## When to involve a coder

Ask for engineering help when automation needs a stable test hook, a safe data
factory/API, controllable time, deterministic third-party behavior, or product
changes for accessibility/testability. A good QE artifact should explain the
risk and evidence clearly enough that the change is actionable.
