# /pw-analyze-test-coverage — find unautomated routes and forms

Create a representative crawl for the same role/environment as the test suite,
then locate the existing Python or Node E2E roots. Run:

```bash
node .cline/skills/pw-playwright-fieldkit/scripts/coverage.mjs report/explore tests/e2e --out report/coverage
```

Read `coverage-gaps.md` and verify high-risk gaps against journey charters and
the product. The report is a literal-navigation heuristic, not runtime code
coverage: dynamic routes, helper abstractions, and parameterized URLs can appear
uncovered. Inspect those before recommending tests.

Prioritize by business risk, primary journeys, recent defects, role boundaries,
and forms that mutate data. Do not recommend one test per route merely to raise a
count. Create/update charters for the gaps worth automating.
