# Playwright FieldKit — CLI Reference

This is the command-line and flow-format reference. Agent-guided users should
start with the [User Guide](../user-guide.md). For a minimal setup, see the
[Quick start](../../README.md#quick-start).

- [Concepts](#concepts)
- [Installation](#installation)
- [The tools](#the-tools)
  - [crawl.mjs — walk the whole site](#crawlmjs--walk-the-whole-site)
  - [inspect.mjs — deep-dive one page](#inspectmjs--deep-dive-one-page)
  - [flow.mjs — run a user journey](#flowmjs--run-a-user-journey)
  - [record.mjs — learn from a demonstrated journey](#recordmjs--learn-from-a-demonstrated-journey)
  - [compare.mjs — diff two crawls](#comparemjs--diff-two-crawls)
  - [save-auth.mjs — log in once](#save-authmjs--log-in-once)
  - [charter.mjs — validate journey intent](#chartermjs--validate-journey-intent)
  - [test-cases.mjs — validate specification-derived cases](#test-casesmjs--validate-specification-derived-cases)
  - [coverage.mjs — find route and form gaps](#coveragemjs--find-route-and-form-gaps)
  - [matrix.mjs — execute selected variants](#matrixmjs--execute-selected-variants)
  - [triage.mjs — reproduce intermittency](#triagemjs--reproduce-intermittency)
- [The flow file format](#the-flow-file-format)
- [Authentication](#authentication)
- [Understanding the output](#understanding-the-output)
- [Working with Cline](#working-with-cline)
- [Recipes](#recipes)
- [Safety & etiquette](#safety--etiquette)

---

## Concepts

**The core idea:** instead of asking a language model to *write* Playwright code
(which it often gets wrong, especially smaller models), you give it a set of
tested scripts that drive the browser and emit **structured reports**. The model
runs a script, reads the report, and reasons about the findings. This is more
reliable, works without any web-access tools, and produces the same artifacts
every time.

**Eleven tools:**

- **Crawl** — breadth-first walk of a whole site to map it and find problems.
- **Inspect** — everything about a single page (for bugs and deep dives).
- **Flow** — a scripted user journey you can verify and turn into a test.
- **Record** — let a user demonstrate a journey in a visible browser and turn
  the recording into a reviewed test or flow.
- **Compare** — diff two crawls to catch regressions and find gated features.
- **Save-auth** — capture a logged-in session so the others can go behind the
  login wall.
- **Charter** — validate and render the intent, risk, outcomes, and cleanup for
  a journey.
- **Test-cases** — validate requirement traceability, case structure, and QE
  approval status.
- **Coverage** — compare crawled routes/forms with literal navigation in tests.
- **Matrix** — run a deliberately selected role/browser/device command matrix.
- **Triage** — repeat a suspect test and classify its failure evidence.

The reporting commands write Markdown plus JSON. `crawl.mjs` and
`inspect.mjs` capture screenshots by default; `flow.mjs` captures only explicit
`screenshot` steps and failures, plus an optional trace with `--trace`;
`compare.mjs` captures no screenshots.
`save-auth.mjs` writes only the requested authentication-state file.

## Installation

You need **Node.js 18+**. Then, once:

```bash
cd .agents/skills/pw-playwright-fieldkit/scripts
npm install                     # installs the playwright library
npx playwright install chromium # downloads the browser engine
npm test                         # runs the bundled localhost regression suite
```

To use Firefox or WebKit too: `npx playwright install firefox webkit`.
On Linux CI you may also need `npx playwright install-deps`. See
[Installation](../setup/installation.md) for CI and Docker.

You do not need a test runner to explore. Generated tests use the runner already
established by the consuming project: commonly `pytest-playwright` for Python or
`@playwright/test` for TypeScript/JavaScript.

---

## The tools

Run everything with
`node .agents/skills/pw-playwright-fieldkit/scripts/<name>.mjs`. The tools accept
`--help` except `save-auth.mjs`, which currently requires a login URL or
`--flow`.

### crawl.mjs — walk the reachable site

Follows same-origin links breadth-first, and on each page records navigation
status, console errors, uncaught exceptions, failed/slow requests, dialogs,
forms, buttons, interactive widgets, and hidden links.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs <startUrl> [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--depth <n>` | `2` | How many discovered-link hops from the start URL to follow. Sitemap seeds are independent of this depth. |
| `--max-pages <n>` | `40` | Hard cap on pages visited (safety valve). |
| `--out <dir>` | `playwright-report-explore` | Output directory. |
| `--browser <name>` | `chromium` | `chromium`, `firefox`, or `webkit`. |
| `--headed` | off | Show the browser window (watch it work). |
| `--storage-state <file>` | — | Load a saved login session (see [Authentication](#authentication)). |
| `--include <regex>` | — | Only visit URLs whose **path** matches this regex. |
| `--exclude <regex>` | — | Never visit URLs whose **path** matches this regex. |
| `--same-path` | off | Stay under the start URL's derived directory prefix. Use a trailing slash for route sections, e.g. `/docs/`; `/docs` currently derives `/`. |
| `--device <name>` | — | Emulate a device, e.g. `"iPhone 13"`, `"Pixel 7"` (Playwright presets). |
| `--spa` | off | Also click navigation-role elements to find client-rendered routes (see [SPA route discovery](#spa-route-discovery)). |
| `--no-sitemap` | off | Skip `robots.txt`/`sitemap.xml` discovery for seeding. `robots.txt` is still fetched when `--respect-robots` is also used. |
| `--respect-robots` | off | Skip paths matching `robots.txt` `Disallow` rules. |
| `--delay <ms>` | `0` | Pause between page navigations to reduce request rate. |
| `--no-aria` | off | Skip the per-page accessibility snapshot (used by `compare.mjs`). |
| `--no-screenshots` | off | Disable per-page screenshots (faster). |
| `--wait <ms>` | `0` | Extra settle time after each page load. |
| `--timeout <ms>` | `30000` | Per-navigation timeout. |
| `--user-agent <value>` | — | Override the browser user agent. |
| `--ignore-https-errors` | off | Ignore HTTPS certificate errors (useful on authorized staging sites). |
| `--audit-page-ms <ms>` | `5000` | Page-load threshold used by the deterministic audit. |
| `--audit-request-ms <ms>` | `3000` | Slow-request threshold used by the deterministic audit report. |
| `--check-links` | off | Check discovered HTTP(S) links and assets after crawling. |
| `--link-concurrency <n>` | `4` | Maximum concurrent link-check workers. |
| `--link-delay <ms>` | `100` | Minimum per-host delay between link checks. |
| `--link-timeout <ms>` | `15000` | Timeout for each link-check request. |
| `--checkpoint-every <n>` | `5` | Persist resumable state after every N completed pages. |
| `--resume` | off | Continue a compatible interrupted crawl from `<out>/.crawl-state.json`. |
| `--scope-config <file>` | auto | Use an explicit authorization allowlist instead of auto-discovery. |
| `--i-am-authorized` | off | Override an active allowlist and record the override in output metadata. |

**Sitemap & robots seeding.** Before link-crawling, the crawler fetches
`/robots.txt` and `/sitemap.xml` (same-origin, honoring your `--storage-state`
session). Sitemap URLs are added as seeds — this finds **unlinked pages** no
link-crawl would reach — and the `robots.txt` `Disallow` list is reported under
section 4 as candidate gated/internal areas. Nested sitemap indexes are followed;
gzipped sitemaps (`.xml.gz`) are skipped. Disable with `--no-sitemap`.

**Robots filtering and rate limiting.** Add `--respect-robots` to exclude paths
that match the selected rules, including sitemap seeds. The parser selects the
most specific matching `User-agent` group (falling back to `*`) and supports
`Allow`, `Disallow`, longest-match precedence, `*`, and the `$` end anchor.
Skipped URLs and their matched rule are retained in `crawl.json`. Add
`--delay <ms>` to pause between navigations:

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://site.com --respect-robots --delay 500
```

<a name="spa-route-discovery"></a>
**SPA route discovery (`--spa`).** Single-page apps often navigate by JavaScript
(`history.pushState`) with no real `<a href>`, so a plain crawl sees one page.
With `--spa`, after reading a page the crawler also clicks *navigation-role*
elements (`role=link/tab/menuitem`, `data-href/-to/-route`, `javascript:` anchors)
and enqueues any route that changes the URL. It excludes elements inside forms,
but a navigation-like element can still have an application-specific, mutating
click handler. Use `--spa` only on an authorized target where those clicks are
safe. It is also slower because it reloads the page between clicks. Use it when a
normal crawl of a JS-heavy app finds too few pages.

**Device emulation (`--device`).** Applies a Playwright device preset (viewport,
user-agent, touch, scale factor). Great for mobile screenshots and responsive
audits. Mobile presets work best on `chromium`/`webkit`; on `firefox` the mobile
flag is dropped automatically (viewport/UA still apply).

**Scoping tips.** Depth grows fast — a homepage with 50 links at `--depth 2` can
reach thousands of URLs, so `--max-pages` is what really bounds a run. Use
`--include`/`--same-path` to stay focused:

```bash
# Only the docs section, logged out
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://site.com/docs/ --same-path --max-pages 60

# Whole app but skip logout/API/downloads
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://app.site.com --exclude "/logout|/api/|\.pdf$"
```

Assets (images, CSS, JS, PDFs, fonts, …) are automatically skipped as navigation
targets. Only same-origin pages are crawled — external links are recorded but not
followed.

**Deterministic quality audit.** Every crawl evaluates the extracted page
structure for missing `lang`, missing/multiple `h1`, missing `main`, unlabeled
controls, and unnamed visible buttons/links. It also reports pages and captured
slow requests exceeding `--audit-page-ms` and `--audit-request-ms`. These are
explainable heuristics, not a full WCAG or laboratory performance audit.

It additionally reports `insecure-redirect`: an HTTPS navigation that reaches its
destination through a plaintext `http://` hop. Such a chain usually still ends in
a healthy `200`, so the status alone hides it, and the request is exposed in
cleartext even though it lands back on HTTPS. Redirect chains are captured on
every navigation; `--check-links` extends the same check to linked URLs.

**Link checking (`--check-links`).** After the crawl, discovered visible/hidden
HTTP(S) links and page assets are de-duplicated and checked with `HEAD`, falling
back to `GET` when `HEAD` is unsupported. The report includes failures, 4xx/5xx
responses, redirect chains, final URLs, and source pages. Checks are bounded by
the `--link-*` options. With an authorization allowlist active, targets and
redirects outside it are recorded as skipped rather than contacted.

**Checkpoint and resume.** Crawl state is periodically written to
`<out>/.crawl-state.json` and also saved on `SIGINT`. Re-run the same URL and
compatible options with the same `--out` plus `--resume`. A successful report
removes the checkpoint; incompatible options are rejected.

**Authorization scope.** If `fieldkit.config.json` or `.agents/skills/pw-playwright-fieldkit/scripts/targets.txt`
exists, live-browser commands enforce it. JSON uses an `allowedOrigins` array;
the text format uses one origin/host pattern per line. Exact origins, hosts,
ports, and `*` wildcards are supported:

```json
{ "allowedOrigins": ["http://localhost:*", "*.staging.example.com"] }
```

Use `--scope-config <file>` to select another file. `--i-am-authorized` bypasses
an active allowlist, but the override is recorded in JSON output and alongside
saved auth state. Agents should not add that flag without explicit authorization.

### inspect.mjs — deep-dive one page

Everything about a single URL: full console log, all JS errors with stacks,
failed/slow requests, the accessibility ("screen-reader") tree, a full-page
screenshot, and the rendered HTML. Optionally clicks things and re-captures.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/inspect.mjs <url> [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--out <dir>` | `playwright-report-inspect` | Output directory. |
| `--browser <name>` | `chromium` | Engine. |
| `--headed` | off | Show the browser. |
| `--storage-state <file>` | — | Inspect a logged-in page. |
| `--device <name>` | — | Emulate a device, e.g. `"iPhone 13"`. |
| `--click <selector>` | — | Click after load, then re-capture. **Repeatable** — chain several. |
| `--wait <ms>` | `1500` | Settle time after load and after each click. |
| `--no-full-page` | off | Use a viewport-only screenshot instead of the default full page. |
| `--no-a11y` | off | Skip the accessibility tree, which is captured by default. |
| `--no-html` | off | Skip rendered HTML, which is saved by default. |

```bash
# Reproduce a bug that only appears after interacting
node .agents/skills/pw-playwright-fieldkit/scripts/inspect.mjs https://app.site.com/editor \
     --click "text=New" --click "#save" --wait 2000
```

Each successful `--click` produces a new "State" section in `inspect.md` with its
actual URL, screenshot, and visible link targets captured *after* that click, so
redirects and interaction effects are explicit. Errors and request signals from
all states are summarized near the top and retained per state in `inspect.json`.
Every listed link includes
its visible text, resolved and declared destination, `target`, and a selector
when one can be generated. Selectors can be CSS (`#save`), text (`text=Save`),
or any Playwright selector.

For a link that appears to navigate incorrectly, inspect the source page first,
copy the selector from its **Link targets** list, then inspect again with
`--click`. Compare the initial declared target with the post-click state's URL;
this catches semantic misrouting and redirects even when every response is
successful.

### flow.mjs — run a user journey

Runs a sequence of steps from a JSON file, captures what happened at each step,
tells you exactly where it failed, and can emit a Playwright test.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/flow.mjs <flow.json> [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--out <dir>` | `playwright-report-flow` | Output directory. |
| `--browser <name>` | `chromium` | Engine. |
| `--headed` | off | Show the browser. |
| `--storage-state <file>` | — | Run the flow logged in. |
| `--device <name>` | — | Emulate a Playwright device preset. |
| `--trace[=file.zip]` | off | Capture a Playwright trace. Bare `--trace` writes `<out>/trace.zip`; an explicit file must end in `.zip` (a relative path resolves under `--out`). A bare value (`--trace foo`) is rejected to avoid swallowing the flow argument. |
| `--gen-test <file>` | — | Write a Python test for `.py`, or an `@playwright/test` test for `.ts`/`.js`. Unknown extensions fail. Emission occurs only after the flow **passed**. |
| `--wait <ms>` | `500` | Settle time after each step. |

The CLI does not guess the repository's language: the output filename makes the
choice explicit. The `/pw-generate-tests` workflow first inspects existing test
code and dependencies, and asks when the convention is missing or ambiguous.
Python output currently targets pytest with Playwright's synchronous `page`
fixture. The exit code is `0` if the flow passed and `1` if any step failed.
Results are written to `<out>/flow.md` and `<out>/flow.json`; the runner refuses
to start when the input flow *is* `<out>/flow.json`, since the results file
would overwrite it — name a co-located input `case-flow.json` or similar.
When `--trace` is set, the trace path is included in `flow.md`, `flow.json`, and
the command's JSON summary even for a failed flow. Open it with:

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/node_modules/playwright/cli.js \
  show-trace playwright-report-flow/trace.zip
```

See [the flow file format](#the-flow-file-format) below.

### record.mjs — learn from a demonstrated journey

Launches Playwright Codegen in a visible browser and Inspector. The user performs
the journey; after the recorder closes, the agent reviews the generated draft,
adds missing intent/outcome assertions, removes secrets, fits it to the existing
suite, and verifies it.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/record.mjs https://app.example.com \
  --output report/recording/test_checkout.py
```

The output extension selects the default Codegen target: `.py` uses
`python-pytest`, while `.ts`/`.js` uses `playwright-test`. Use
`--target python-async` when the inspected Python suite is async. Useful options
include `--load-storage`, `--save-storage`, `--browser`, `--device`, and
`--test-id-attribute`. Use `--dry-run` to inspect the resolved invocation without
opening a browser.

The start URL is checked by the authorization scope guard, but after the user
takes control Codegen cannot enforce the allowlist. Stay on authorized targets.
Interactions are real, and filled secrets can appear in generated source; prefer
saved authentication state and review the draft before retaining it. A graphical
desktop, display forwarding, or VNC is required.

### compare.mjs — diff two crawls

Compares two `crawl.json` runs and reports what changed. Two main uses:
regression detection (before/after a deploy), gated-feature discovery
(logged-out vs logged-in, or role vs role).

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/compare.mjs <baseline> <current> [--out dir]
```

You can pass either a run's directory or its `crawl.json` for each argument. Page
matching uses exact absolute URLs, so both crawls must use the same origin;
staging-versus-production comparison is not currently rebased by path. Use the
**same crawl options** for both runs so the diff is apples-to-apples, and do not
pass `--no-aria` if you want the structural diff. The report
(`compare.md`) covers:

- **New / removed pages** — routes that appeared or disappeared.
- **Status changes** — with 2xx/3xx → 4xx/5xx/FAIL flagged as regressions.
- **Error-count regressions on shared pages** — pages whose aggregate
  JS/console/network error-signal count increased. Error identity is not diffed,
  so a replacement error with the same count is not detected.
- **Form changes** — added/removed forms (a new form = a candidate new feature).
- **Structural changes** — a per-page accessibility-tree node delta (`+added /
  −removed`), ranked, so you see which pages changed shape.

```bash
# Regression check around a deploy
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://staging.app --out report/before
# ...deploy...
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://staging.app --out report/after
node .agents/skills/pw-playwright-fieldkit/scripts/compare.mjs report/before report/after

# Find what a login unlocks
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://app --out report/anon
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://app --storage-state auth.json --out report/auth
node .agents/skills/pw-playwright-fieldkit/scripts/compare.mjs report/anon report/auth
```

The stdout summary (`{newPages, removedPages, statusChanges, errorRegressions}`)
makes it easy to gate CI on regressions.

### save-auth.mjs — log in once

Captures cookies + localStorage into an `auth.json` you pass to the other tools.

```bash
# Interactive: a browser opens, you log in, press Enter to save
node .agents/skills/pw-playwright-fieldkit/scripts/save-auth.mjs https://app.site.com/login --headed --out auth.json

# Scripted: log in from a flow that ends logged-in
node .agents/skills/pw-playwright-fieldkit/scripts/save-auth.mjs --flow login.json --out auth.json
```

See [Authentication](#authentication).

### charter.mjs — validate journey intent

Validates a QE journey definition and renders reviewable Markdown plus
normalized JSON. Required fields are `title`, `intent`, and `outcomes`; a
destructive journey must also declare cleanup.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/charter.mjs journey.json --out report/journey
```

Start from [`journey.example.json`](../../.agents/skills/pw-playwright-fieldkit/templates/journey.example.json).
Warnings call out weak preconditions or data isolation without preventing an
otherwise valid charter from being saved.

### test-cases.mjs — validate specification-derived cases

Validates test cases derived from a feature specification and renders a
requirement traceability matrix plus readable case details. It checks IDs,
requirement links, actions, expected results, destructive cleanup, and review
status.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/test-cases.mjs \
  test-cases-source.json --out report/test-cases
```

| Option | Meaning |
|---|---|
| `--case <TC-ID>` | Render only the selected case(s); repeatable. An unknown ID is an error. |
| `--flow-skeletons` | Write an untranslated flow skeleton per rendered automation-candidate case to `<out>/flows/<TC-ID>.json`. Each skeleton step carries the source action and expected result; `flow.mjs` refuses to run it until every step is translated into one supported action. |
| `--require-approved` | Fail unless `review.status` is `approved`. Use before executing a FieldKit-generated case set. |

Approval is bound to content: the validator reports a `contentHash` (SHA-256
over everything except the `review` block), and an `approved` document must
carry a matching `review.approvedHash`. Editing an approved document therefore
invalidates the approval until it is re-reviewed. The validator also rejects
approvals that omit a reviewer or retain open questions.

On validation errors the command still writes `test-cases.md`/`test-cases.json`
with a **Validation errors** section for context, then exits `1`.
Start from
[`test-cases.example.json`](../../.agents/skills/pw-playwright-fieldkit/templates/test-cases.example.json).

### coverage.mjs — find route and form gaps

Compares a crawl with one or more Python/JavaScript/TypeScript test files or
directories. It writes `coverage-gaps.md` and `coverage-gaps.json`.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/coverage.mjs \
  report/explore tests/e2e --out report/coverage
```

With `--test-cases <test-cases.json>` (a FieldKit test-case source or rendered
output), the report adds a requirement-traceability table mapping each
requirement to its designed cases, automation candidates, and the permanent
test files that literally mention the requirement or a linked case ID —
closing the loop from specification to permanent automation.

This is deliberately heuristic: it recognizes literal URLs in common
navigation and URL-wait/assertion calls, and literal ID mentions for
requirement traceability. Dynamic routes, fixtures, and helper
abstractions may look uncovered and require human review. It is a gap-finding
aid, not runtime code coverage or a percentage score.

### matrix.mjs — execute selected variants

Runs the explicit command array for every variant in a JSON matrix, sequentially
and without shell interpolation. It preserves a log per variant and writes
`matrix.md`/`matrix.json`; the process fails when any variant fails.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/matrix.mjs matrix.json --dry-run
node .agents/skills/pw-playwright-fieldkit/scripts/matrix.mjs matrix.json --out report/matrix
```

Start from [`matrix.example.json`](../../.agents/skills/pw-playwright-fieldkit/templates/matrix.example.json).
Prefer the consuming test runner's native projects or parameters when they
already provide the required matrix.

### triage.mjs — reproduce intermittency

Repeats one narrow test command, saves every run's output, and groups observed
failures into readiness/locator, timing, network/backend, shared-data,
browser/infrastructure, product/assertion, or unknown evidence.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/triage.mjs \
  --runs 8 --artifacts test-results --out report/triage -- \
  pytest tests/e2e/test_checkout.py::test_submit --tracing=on
```

Mixed pass/fail runs are reported as `flaky`. The command intentionally retains
a failing exit when any run fails, making accidental CI success unlikely.

---

## The flow file format

A flow is a JSON object with a `steps` array. Each step is **one object with
exactly one supported action key** plus any options that action needs, such as
`value`, `selector`, `status`, or `body`. Option order does not matter. Start from
[`.agents/skills/pw-playwright-fieldkit/templates/flow.example.json`](../../.agents/skills/pw-playwright-fieldkit/templates/flow.example.json).

```json
{
  "name": "user can log in and search",
  "baseUrl": "https://app.example.com",
  "storageState": null,
  "steps": [
    { "goto": "/login" },
    { "fill": "input[name=email]", "value": "demo@example.com" },
    { "fill": "input[name=password]", "value": "s3cret" },
    { "click": "button[type=submit]" },
    { "waitForUrl": "dashboard" },
    { "expectText": "Welcome back" },
    { "fill": "input[type=search]", "value": "reports" },
    { "press": "Enter", "selector": "input[type=search]" },
    { "expectText": "results" },
    { "screenshot": "search-done" }
  ]
}
```

**Actions:**

| Action | Shape | Does |
|---|---|---|
| `goto` | `{ "goto": "/path" }` | Navigate. Absolute HTTP(S) URLs are used directly; other values are concatenated with `baseUrl`. Prefer a `baseUrl` without a trailing slash and a path beginning with `/`. |
| `click` | `{ "click": "selector" }` | Click the first match. |
| `fill` | `{ "fill": "sel", "value": "x" }` | Clear + type into a field. |
| `type` | `{ "type": "sel", "value": "x" }` | Type char-by-char (for inputs that need real keystrokes). |
| `select` | `{ "select": "sel", "value": "x" }` | Choose a `<select>` option. |
| `check` / `uncheck` | `{ "check": "sel" }` | Toggle a checkbox/radio. |
| `press` | `{ "press": "Enter", "selector": "sel" }` | Press a key (selector optional). |
| `hover` | `{ "hover": "sel" }` | Move the pointer over the first match. |
| `scrollTo` | `{ "scrollTo": "sel" }` | Scroll the first match into view. |
| `waitFor` | `{ "waitFor": "sel" }` | Wait until an element is visible. |
| `waitForUrl` | `{ "waitForUrl": "substr" }` | Wait until the URL contains substr. |
| `wait` | `{ "wait": 1000 }` | Sleep N ms (use sparingly). |
| `expectText` | `{ "expectText": "text" }` | **Assert** visible text exists. |
| `expectUrl` | `{ "expectUrl": "substr" }` | **Assert** URL contains substr. |
| `expectVisible` | `{ "expectVisible": "sel" }` | **Assert** an element is visible. |
| `expectNotVisible` | `{ "expectNotVisible": "sel" }` | **Assert** an element is absent or hidden. |
| `expectValue` | `{ "expectValue": "sel", "value": "x" }` | **Assert** an input has the exact value. |
| `expectCount` | `{ "expectCount": "sel", "value": 3 }` | **Assert** a selector has exactly N matches. |
| `mockResponse` | `{ "mockResponse": "**/api/items", "status": 503, "body": {"error":"unavailable"} }` | Fulfill matching requests with a deterministic response. Define before the request-triggering step. |
| `mockAbort` | `{ "mockAbort": "**/api/items", "errorCode": "failed" }` | Abort matching requests to exercise network-failure handling. |
| `auditA11y` | `{ "auditA11y": "open dialog", "allow": [] }` | Assert the current interactive state has no deterministic accessibility findings except explicitly allowed finding codes. |
| `screenshot` | `{ "screenshot": "label" }` | Save a screenshot. |

The `expect*` actions are what make a flow a *test*: if the condition isn't met,
the flow fails at that step and tells you why. Generating a test with
`--gen-test` converts these into the selected language's Playwright assertions.
Mock routes and state audits are also emitted into generated tests. See
[`negative-flow.example.json`](../../.agents/skills/pw-playwright-fieldkit/templates/negative-flow.example.json)
for a failure-path example. `auditA11y` is a focused smoke audit, not proof of
WCAG conformance. Its finding codes are `missing-lang`, `missing-main`,
`h1-count`, `unlabeled-control`, `unnamed-button`, `unnamed-link`, and
`unnamed-dialog`.

**Selector advice.** Prefer, in order: `data-testid` (`[data-testid=save]`),
`name`/`id` (`input[name=email]`), roles/text (`text=Save`), then CSS. The crawl
report gives you a `selectorHint` for most elements — use those.

---

## Authentication

To explore pages behind a login, capture a session once and reuse it.

**Interactive (simplest, works with SSO / 2FA / captchas):**

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/save-auth.mjs https://app.example.com/login --headed --out auth.json
# A real browser opens. Log in however you normally would.
# Switch back to the terminal and press Enter. auth.json is written.
```

**Scripted (repeatable, for simple username/password):** write a `login.json`
flow that ends logged-in, then:

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/save-auth.mjs --flow login.json --out auth.json
```

Scripted authentication supports the same step vocabulary as `flow.mjs`,
including `expect*` steps — end the flow with one (e.g. `expectText` on a
logged-in element) to prove the login worked. A step that fails or is not
recognized aborts the run instead of being skipped, so a broken login flow
cannot silently save an unauthenticated state.

**Then reuse it everywhere:**

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs   https://app.example.com --storage-state auth.json
node .agents/skills/pw-playwright-fieldkit/scripts/inspect.mjs https://app.example.com/settings --storage-state auth.json
node .agents/skills/pw-playwright-fieldkit/scripts/flow.mjs    checkout.json --storage-state auth.json
```

> ⚠️ **`auth.json` contains live session cookies. Treat it like a password.**
> It's already in `.gitignore`. Never commit it, print it, or paste it into a
> report. Sessions expire — re-run `save-auth.mjs` when crawls start hitting the
> login page. For role-based discovery, save one file per role
> (`admin.auth.json`, `user.auth.json`) and compare crawls.

---

## Understanding the output

For example, the default crawl output is:

```
playwright-report-explore/
├── report.md            ← read this first (ranked, human/model-readable)
├── crawl.json           ← structured dataset (every visited page, captured signals)
└── screenshots/         ← one PNG per page
```

**`report.md` (crawl)** has eight sections:

1. **Problems found** — pages with errors, ranked, each with the exact cause.
2. **Site map** — every page visited with status and element counts.
3. **Interactive features & forms** — forms (with fields), login walls, widgets.
4. **Possibly undocumented / gated features** — beta markers, hidden links, and
   `robots.txt` Disallow paths.
5. **Performance** — average load time, slowest pages, and slow requests (>3s
   documents and XHR/fetch calls).
6. **Link check** — results when `--check-links` was requested.
7. **Deterministic quality audit** — accessibility, performance, and security
   findings with severity, evidence, and remediation.
8. **Suggested next steps.**

**`inspect.md`** leads with status/errors/requests, then a "State" section per
capture (initial load + each click) with its actual URL, counts, forms, visible
link targets, and screenshot path.
It also writes a `*.a11y.yaml` — the accessibility tree, which is the closest
thing to "what a screen-reader user experiences."

**`flow.md`** is a pass/fail checklist of every step, with the error and a
`FAILED-step-N.png` screenshot at the point of failure.

**The JSON files** contain everything the Markdown summarizes plus raw extracted
detail such as all discovered links, full field lists, and captured failed,
error-status, or slow requests. Successful requests below the slow threshold are
not retained. Reach for JSON when the Markdown omits a detail you need.

---

## Working with Cline

The canonical Cline package is the project skill at
`.agents/skills/pw-playwright-fieldkit/`:

- **`SKILL.md`** describes when to activate the toolkit, routes requests to the
  right playbook, and carries the safety constraints.
- **`references/workflows/*.md`** contain the detailed procedures.
- **`scripts/` and `templates/`** travel with the skill instead of cluttering the
  consuming project's root.

The installers add compatibility adapters in the consuming project: a short
always-on activation rule (installed to `.agents/rules/`, `.claude/rules/`, and
`.clinerules/`) for models that miss skills, and generated `/pw-*` shortcut
workflows under `.clinerules/workflows/` for Cline. They include exploration,
debugging, recording, document-driven test-case execution, generation and
comparison, plus charter, coverage, data, negative path, accessibility-state,
matrix, and flake-triage workflows. Each shortcut delegates to the canonical
skill workflow, so detailed instructions have a single source of truth. The
[User Guide](../user-guide.md) routes readers to a focused guide for each
workflow set.

Other agents (or plain shell use) work too—the runtime is ordinary Node. The
[Agent Harness Guide](../setup/agent-harness.md) shows how to point repository
instructions, native skills, and explicit shortcuts at the canonical package
without duplicating its procedures.

---

## Recipes

**"Is my local dev site healthy?"**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs http://localhost:3000 --depth 2 --max-pages 50
```

**"Reproduce the bug on the checkout page."**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/inspect.mjs https://app.site.com/checkout \
     --storage-state auth.json --click "#place-order" --wait 3000
```

**"Build a login regression test for an existing Python suite."**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/flow.mjs login.json \
  --trace --gen-test tests/e2e/test_login.py
pytest tests/e2e/test_login.py --tracing=on   # in your app project
```

**"Let me demonstrate the checkout flow."**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/record.mjs https://app.site.com/checkout \
  --output report/recording/test_checkout.py --load-storage auth.json
```

**"What can an admin do that a normal user can't?"**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/save-auth.mjs --flow admin-login.json --out admin.auth.json
node .agents/skills/pw-playwright-fieldkit/scripts/save-auth.mjs --flow user-login.json  --out user.auth.json
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://app.site.com --storage-state admin.auth.json --out report/admin
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://app.site.com --storage-state user.auth.json  --out report/user
# Diff the two site maps: admin-only routes are the privileged features.
```

**"Screenshot every page for a design review."**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://site.com --depth 3 --max-pages 100
# Browse playwright-report-explore/screenshots/
```

**"Did my deploy break anything?"**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://staging.site.com --out report/before
# ...deploy...
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://staging.site.com --out report/after
node .agents/skills/pw-playwright-fieldkit/scripts/compare.mjs report/before report/after --out report/diff
# Read report/diff/compare.md
```

**"Explore a React SPA that looks like one page."**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://app.site.com --spa --depth 2 --max-pages 40
```

**"Audit the mobile experience."**
```bash
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://site.com --device "iPhone 13" --depth 2
```

---

## Safety & etiquette

- **Only explore sites you own or are authorized to test.** This tool drives a
  real browser and makes real requests.
- **Normal crawling is passive** — it navigates and reads, auto-dismisses dialogs,
  and does not submit forms. `--spa` additionally clicks navigation-like elements;
  those handlers are not guaranteed to be side-effect free. **`flow.mjs` can
  mutate data** because it clicks and submits what you tell it to, so avoid
  destructive steps against production; use a staging environment.
- **Don't overload servers.** Keep `--max-pages` sensible; use `--delay` to
  reduce the request rate and `--respect-robots` when appropriate for the target.
- **Redaction is best-effort, not comprehensive.** It covers selected sensitive
  URL query parameters, bearer tokens, and unusually long email-like strings.
  Ordinary email addresses and arbitrary secrets embedded in HTML or console text
  may remain. Review every artifact before sharing, and never commit `auth.json`.
- **Respect robots/terms** of sites you don't control.

See also [Installation](../setup/installation.md) and
[Troubleshooting](../setup/troubleshooting.md).
