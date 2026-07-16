# Playwright FieldKit User Guide

This is the single starting point for Playwright FieldKit. It is written for
quality engineers (QEs), including fresh graduates and manual testers moving
into automation, but no command-line or automation experience is assumed.
Describe the outcome to your coding agent; the agent selects and runs the
matching workflow while you provide product judgment and review its evidence.

## Get started

1. Open your coding agent in the project workspace.
2. If FieldKit is not ready, ask the agent to follow
   [Installation](setup/installation.md) once for the project. Confirm any
   system-level permission it cannot safely handle on its own.
3. State what you have and what you want—for example, “Design test cases from
   this feature specification” or “Run this permanent test and show me every
   trace.”
4. Let the agent follow the workflow, then review the requested decisions and
   evidence. Browser workflows never require you to assemble CLI commands.

Cline has first-class workflow shortcuts. Other terminal-capable coding agents
can use the same package through the [Agent Harness Guide](setup/agent-harness.md).
The [CLI Reference](reference/cli.md) is supporting detail for agents and
maintainers who need command flags, JSON formats, or output contracts; it is not
a separate product workflow.

## How agentic work is divided

The agent handles repeatable mechanics: selecting the playbook, running the
browser or repository test runner, collecting artifacts, and summarizing the
evidence. You remain responsible for product meaning and consequential
decisions: confirming requirements, approving test cases, judging whether an
observed journey is faithful, and deciding whether a finding is a defect.

When the agent needs a decision, it should show the evidence and ask a specific
question. A command exit code cannot approve test cases or confirm that a
browser journey represented the intended behavior.

## What quality engineering means

Quality engineering builds confidence in a product through clear requirements,
risk-based test design, repeatable execution, useful automation, and evidence.
The goal is not to “click everything” or prove that no bugs exist. A result only
shows what happened under the conditions that were tested.

A useful test statement is:

> **Given** a starting condition, **when** a user performs an action,
> **then** an observable result should occur.

Prioritize with two questions:

1. How likely is this behavior to fail?
2. How serious would the impact be if it failed?

Money, permissions, personal data, common journeys, recent changes, and actions
that cannot easily be undone usually deserve more attention.

## Choose the focused guide

| Your starting point or problem | Focused guide | Main workflows |
|---|---|---|
| A running site needs to be mapped, inspected, debugged, compared, or assessed | [Site Exploration and Diagnosis](qe/exploration.md) | `/pw-explore-site`, `/pw-debug-site`, `/pw-discover-features`, `/pw-compare-runs`, `/pw-recommend-improvements` |
| A feature specification needs test cases | [Feature Specification to Test Cases](qe/test-design.md) | `/pw-design-test-cases`, `/pw-review-test-cases`, `/pw-create-test-charter` |
| An approved test-case document needs a witnessed journey | [Test Case Execution and Evidence](qe/execution.md) | `/pw-execute-test-case` |
| Existing permanent test code needs to be run and reported | [Permanent Test Automation](qe/automation.md) | `/pw-run-automated-tests` |
| A confirmed journey needs permanent automation | [Permanent Test Automation](qe/automation.md) | `/pw-record-flow`, `/pw-generate-tests`, `/pw-plan-test-data`, `/pw-generate-negative-tests`, `/pw-audit-journey` |
| The team needs to find gaps or choose variants | [Coverage and Variants](qe/coverage.md) | `/pw-analyze-test-coverage`, `/pw-run-test-matrix` |
| A test passes and fails inconsistently | [Flaky-Test Triage](qe/flaky-test.md) | `/pw-triage-flaky-test` |

Natural-language requests work too. Slash commands make the intended workflow
boundary explicit.

## Understand the main artifacts

| Artifact | Meaning |
|---|---|
| Feature specification | The source requirements and business rules |
| Test-case set | Reviewed preconditions, data, actions, and expected results traced to requirements |
| Journey or flow | A reviewable `flow.json` that can drive a browser; it is not permanent test code |
| Permanent test | Python, TypeScript, or JavaScript in the repository's normal test directory |
| Trace | A Playwright archive of actions, assertions, page snapshots, and network evidence |

Use these names consistently:

- **Design or approve test cases** when working with requirement documents.
- **Execute a test case** when translating that document into a witnessed
  journey.
- **Run automated tests** when executing permanent repository test code.

Avoid saying “run the test cases” when permanent code is intended; use “run the
automated tests” and, when possible, include the test path or suite.

The normal lifecycle is:

```text
Feature specification
  → test-case design
  → QE review and approval
  → journey execution + trace
  → QE confirmation
  → permanent test generation
  → permanent test execution + trace
```

The approval and confirmation gates are deliberately different:

- **Approval** says the test cases faithfully represent the feature
  specification and are ready to execute.
- **Confirmation** says the observed browser execution matched an approved test
  case.

Neither means that the whole feature is defect-free.

## Work safely

Use authorized local or staging environments. Browser actions are real. Do not
place real orders, send real messages, or delete production data. Use test
identities and saved authentication state instead of real passwords or personal
data.

Traces, screenshots, recordings, and reports can contain page content and test
data. Review them before sharing. Permanent test runs must retain a trace; attach
the relevant permanent-run trace when reporting a defect to developers.

## Quick glossary

| Term | Beginner-friendly meaning |
|---|---|
| Assertion | A check comparing the observed result with the expected result |
| Boundary test | A test at or near a limit, such as zero or the maximum value |
| Fixture | Reusable setup or data supplied to a test |
| Flaky test | A test that inconsistently passes and fails without a relevant change |
| Happy path | The expected successful route through a feature |
| Idempotent cleanup | Cleanup that is safe to run repeatedly |
| Invariant | A condition that must remain true even when another action fails |
| Mock | A controlled replacement for a real dependency or response |
| Negative test | A test of invalid input, denied behavior, or failure handling |
| Precondition | Something that must already be true before a test starts |
| Regression | Behavior that worked previously but was broken by a later change |
| Traceability | A visible link from a requirement to the cases that test it |

## Supporting guides

- [Installation](setup/installation.md) — install the runtime and browser,
  configure CI, or use Docker.
- [Troubleshooting](setup/troubleshooting.md) — diagnose setup, browser,
  execution, report, and generated-test problems.
- [Agent Harness Guide](setup/agent-harness.md) — connect FieldKit to coding
  agents other than Cline.
- [CLI Reference](reference/cli.md) — use the tools directly or look up every
  command, option, output, and flow action.
- [Future Work](reference/future-work.md) — review unimplemented ideas; these
  are not release promises.
