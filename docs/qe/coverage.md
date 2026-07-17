# Coverage and Variants

For workflow selection, return to the [User Guide](../user-guide.md).

Use this guide to identify likely browser-automation gaps and select meaningful
roles, browsers, devices, locales, or timezones. These workflows plan and
execute breadth; they do not create permanent tests by themselves.

## Find possible coverage gaps

Use `/pw-analyze-test-coverage` after crawling the relevant environment as the
same role represented by the existing suite. It compares discovered routes and
forms with literal navigation evidence in Python or Node tests.

Treat the output as leads, not a coverage percentage. Helpers, dynamic routes,
and parameterized URLs can make tested behavior appear uncovered. Verify each
candidate before recommending automation.

Prioritize:

- primary and high-impact user journeys;
- role and permission boundaries;
- recently changed or defect-prone behavior;
- forms that create, modify, or delete data;
- requirements with no approved test case.

When a specification-derived case set exists, add
`--test-cases report/test-cases/test-cases-source.json` so the report also maps
each requirement to its designed cases and the permanent tests that literally
mention a requirement or case ID. Keep those IDs in permanent test titles so
the mapping stays visible.

Do not create one shallow test per page merely to increase a count. Route a
feature specification gap to the
[Test Design guide](test-design.md), or a confirmed journey to the
[Automation guide](automation.md).

## Select a risk-based variant matrix

Use `/pw-run-test-matrix` for combinations justified by support commitments or
known risk, for example:

- customer and admin when permissions differ;
- Chromium plus another supported engine with real compatibility risk;
- desktop and mobile when navigation behavior changes;
- multiple locales or timezones for affected journeys.

Do not run every test against every possible combination. Keep a fast primary
configuration and expand only where the variant can reveal a meaningful
difference.

Before running variants:

- isolate accounts and data used in parallel;
- prevent artifact and trace paths from colliding;
- use the repository runner's native projects or parameters when available;
- retain a trace for every permanent-test variant run, the same contract as
  `/pw-run-automated-tests`;
- distinguish unsupported combinations from product failures.

## Coverage review checklist

- Was the crawl performed with the same environment and role as the suite?
- Were apparent gaps checked for helper or parameterized coverage?
- Are recommendations ranked by risk rather than route count?
- Does every matrix variant represent a supported or risky difference?
- Are data and artifacts isolated across variants?
- Are remaining manual-only risks recorded?
