# /generate-tests — turn real user journeys into integration tests

Goal: add Playwright tests that match the repository's existing language and
conventions, and that are known to pass because the journey ran first.

If a journey charter exists, treat its outcomes, data lifecycle, cleanup,
negative cases, and intended matrix as requirements. If it does not exist and
the request carries material business risk, create one first.

## Step 1 — Detect the existing test convention

Inspect the repository before choosing an output filename:

- Python signals: `pyproject.toml`, `requirements*.txt`, or lockfiles containing
  `playwright`/`pytest-playwright`; imports from `playwright.sync_api` or
  `playwright.async_api`; `test_*.py` files using Playwright fixtures.
- Node signals: `package.json` containing `@playwright/test`;
  `playwright.config.*`; `.spec.ts`, `.spec.js`, or `.test.*` files importing
  `@playwright/test`.
- Read two or three nearby E2E tests to match sync/async style, fixtures,
  directories, naming, configuration, authentication, and helper usage.

If one convention is clear, use it. If both exist, follow the convention in the
target test directory or the suite covering the same app. If the choice remains
ambiguous—or no Playwright suite exists—ask the user whether to generate Python
or TypeScript/JavaScript. Do not silently default to either language.

The Python generator currently emits pytest tests using
`playwright.sync_api` and the synchronous `page` fixture. If the detected suite
uses `playwright.async_api`, explain that mismatch and ask before generating;
the output will need adaptation to the suite's async fixture conventions.

## Step 2 — Decide what to test

If you already crawled, use `report.md`: every **form** and every **primary user
journey** is a test candidate. Otherwise crawl first:

```bash
node .cline/skills/playwright-fieldkit/scripts/crawl.mjs <START_URL> --depth 2 --max-pages 30 --out report/tests
```

Prioritize login, signup, search, the main create/edit/save flow, checkout, and
other core journeys.

## Step 3 — Write each journey as a flow

Use one JSON file per journey. Follow
`.cline/skills/playwright-fieldkit/templates/flow.example.json` and prefer stable
locators such as `data-testid`, `name`, visible text, or roles. The crawl
report's `selectorHint` fields provide candidates.

```json
{ "name": "user can log in", "baseUrl": "https://app.example.com",
  "steps": [
    { "goto": "/login" },
    { "fill": "input[name=username]", "value": "demo" },
    { "fill": "input[name=password]", "value": "demo-pass" },
    { "click": "button[type=submit]" },
    { "expectUrl": "/dashboard" },
    { "expectText": "Welcome" }
] }
```

## Step 4 — Run the flow and generate the test

The output extension selects the generator; there is no language default:

```bash
# Existing Python Playwright/pytest suite
node .cline/skills/playwright-fieldkit/scripts/flow.mjs login-flow.json --out report/tests \
     --gen-test tests/e2e/test_login.py

# Existing @playwright/test suite
node .cline/skills/playwright-fieldkit/scripts/flow.mjs login-flow.json --out report/tests \
     --gen-test tests/login.spec.ts
```

Use `.py` for Python or `.ts`/`.js` for `@playwright/test`. An unrecognized
extension is rejected. Generate only after `flow.md` says **PASSED**; if it
failed, repair the flow and rerun it.

## Step 5 — Fit and verify the generated test

Refactor the generated file to use the suite's existing fixtures, page objects,
authentication, markers, and configuration without weakening its outcome
assertions. Keep credentials and test data out of committed tests.

Run it through the repository's own test command. Typical examples are:

```bash
pytest tests/e2e/test_login.py
npx playwright test tests/login.spec.ts
```

Report the files added, the verification command and result, and meaningful
coverage still missing. Never run destructive purchase/delete/send journeys
against production.
