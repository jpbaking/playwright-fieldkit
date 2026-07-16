# Site Exploration and Diagnosis

For workflow selection, return to the [User Guide](../user-guide.md).

Use this guide when the starting point is a running web application rather than
a feature specification, test-case document, or automated test. The agent
drives the browser, gathers deterministic evidence, and reports what it
observed. Exploration can reveal risks and automation candidates, but it does
not prove complete coverage.

## Choose the workflow by question

| Question | Workflow | What the agent produces |
|---|---|---|
| What pages, forms, errors, and hidden surfaces exist? | `/pw-explore-site` | A bounded crawl report and machine-readable evidence |
| Why does this specific page or action fail? | `/pw-debug-site` | Focused page inspection, browser/runtime evidence, and a diagnosis |
| What functionality is present but poorly documented or hard to find? | `/pw-discover-features` | Evidence-backed feature inventory and follow-up candidates |
| What changed between two comparable observations? | `/pw-compare-runs` | A crawl comparison with additions, removals, and regressions |
| Which observed improvements should the team consider first? | `/pw-recommend-improvements` | Prioritized recommendations tied to captured evidence |

Natural-language requests work too. Include the authorized URL, environment,
role, and the question you need answered. State any path, page-count, or time
boundary so the agent does not inspect more of the application than necessary.

## Explore safely

Normal crawling navigates and reads without submitting forms. Optional SPA
discovery clicks navigation-like controls and can trigger application handlers,
so use it only on an authorized local or staging environment. Do not explore
production with test accounts or data unless the team has explicitly approved
that scope.

Authenticated exploration should use a saved Playwright storage state rather
than a password placed in a prompt or script. Treat reports, screenshots,
accessibility snapshots, authentication state, and network evidence as
potentially sensitive.

## Interpret evidence correctly

Separate three kinds of result:

- **Observed problem:** the browser captured a console error, failed request,
  bad response, broken assertion, or other reproducible signal.
- **Likely risk:** the evidence suggests a usability, accessibility,
  performance, or testability concern that needs human review.
- **Unknown:** the agent lacks the requirement, product intent, permissions, or
  environment knowledge needed to judge the behavior.

A crawl finding is not automatically a defect. Confirm expected behavior from a
feature specification, approved test case, product owner, or another
authoritative source before filing an issue.

## Continue from exploration

- If a finding points to undocumented requirements, obtain or update the
  feature specification and continue with [Test Design](test-design.md).
- If the intended journey is now understood and witnessed, capture it with
  `/pw-record-flow`, then continue with [Permanent Test Automation](automation.md).
- If an existing suite may already cover the surface, use
  [Coverage and Variants](coverage.md) before adding duplicate tests.
- If behavior is inconsistent across repeated runs, use
  [Flaky-Test Triage](flaky-test.md).

## Exploration checklist

- Is the URL and environment authorized?
- Did the request identify the role and authentication state?
- Is the crawl or inspection bounded to the useful surface?
- Are findings separated from risks and unknowns?
- Does every recommendation cite captured evidence?
- Were sensitive artifacts reviewed before sharing?
- Is the next workflow based on the artifact now available?
