# /pw-analyze-test-coverage — find unautomated routes and forms

Create a representative crawl for the same role/environment as the test suite,
then locate the existing Python or Node E2E roots. Run:

```bash
node ~/.agents/skills/pw-playwright-fieldkit/scripts/coverage.mjs report/explore tests/e2e --out report/coverage
```

When a specification-derived case set exists, add
`--test-cases report/test-cases/test-cases-source.json` to also map each
requirement to its designed cases and the permanent tests that mention them,
so requirement-level gaps surface alongside route/form gaps. Reference case or
requirement IDs (for example in the test title) when generating permanent tests
so this mapping stays literal.

Read `coverage-gaps.md` and verify high-risk gaps against journey charters and
the product. The report is a literal-navigation heuristic, not runtime code
coverage: dynamic routes, helper abstractions, and parameterized URLs can appear
uncovered. Inspect those before recommending tests.

Prioritize by business risk, primary journeys, recent defects, role boundaries,
and forms that mutate data. Do not recommend one test per route merely to raise a
count. Create/update charters for the gaps worth automating.
