# Troubleshooting

For workflow selection and beginner terminology, return to the
[User Guide](../user-guide.md).

Quick fixes for the things that actually go wrong.

## Setup

**`Playwright is not installed`**
Run the one-time setup from the toolkit root:
```bash
cd ~/.agents/skills/pw-playwright-fieldkit/scripts && npm install && npx playwright install chromium
```

**`browserType.launch: Executable doesn't exist …`**
The library is installed but the browser engine isn't. Run
`npx playwright install chromium` from
`~/.agents/skills/pw-playwright-fieldkit/scripts/`. On Linux add
`npx playwright install-deps chromium`.

**`Host system is missing dependencies` / library errors on Linux**
```bash
npx playwright install-deps chromium   # may need sudo
```

## Crawling

**The crawl only visited 1 page.**
- `--depth 0` follows no discovered links, but sitemap seeding can still add
  pages. Add `--no-sitemap` if you need only the start URL, or use `--depth 1` or
  higher to follow page links.
- The page may render its links with JavaScript after load — add `--wait 2000`.
- The links may be cross-origin (only same-origin pages are followed) or filtered
  out by `--include`/`--exclude`/`--same-path`. Loosen those.

**The crawl visited *too many* pages / ran forever.**
Lower `--max-pages` (it's the real bound) and/or `--depth`. Use `--same-path` or
`--include "^/section"` to scope, and `--exclude` to skip noisy areas
(`--exclude "/logout|/api/|/print"`).

**A crawl was interrupted.**
Re-run the same URL and options with the same `--out` directory plus `--resume`.
The crawler validates `.crawl-state.json` before continuing and removes it after
a successful report. If options changed, start a fresh output directory.

**A URL is outside the authorization allowlist.**
Review `fieldkit.config.json`,
`~/.agents/skills/pw-playwright-fieldkit/scripts/targets.txt`, or the file passed
through `--scope-config`. Add the intended origin/host only when you are authorized.
`--i-am-authorized` is an explicit override and is recorded in output metadata.

**Link checking skipped an external target.**
When a scope allowlist is active, `--check-links` never contacts targets or
redirect destinations outside it. Add an authorized host pattern to the scope
configuration, or leave the skip recorded in the report.

**Pages show as `FAIL` but load fine in my browser.**
- The site may be slow — raise `--timeout 60000` and add `--wait 2000`.
- It may block headless/automated browsers. Try `--headed`, or set a real
  `--user-agent "..."`.
- HTTPS/cert issues on staging: add `--ignore-https-errors`.

**Everything redirects to the login page.**
You need a session. See
[Authentication](../reference/cli.md#authentication): run `save-auth.mjs`, then pass
`--storage-state auth.json`.

## Inspect

**`inspect.md` shows no forms/buttons but the page has them.**
The page renders late. Increase `--wait` (try `3000`) and, if content appears
after interaction, add `--click "<selector>"` to reveal it before capture.

**A `--click` step reports "click failed".**
The selector didn't match a visible element. Check the accessibility tree
(`*.a11y.yaml`) or the screenshot for the real label, and prefer `text=…`,
`[data-testid=…]`, or `role=button[name=…]`.

## Flows

**A flow fails at a `fill`/`click` step with a timeout.**
- The selector is wrong or the element isn't visible yet. Add a `waitFor` step
  before it, or fix the selector (see the crawl report's `selectorHint`s).
- The element may be inside an iframe (iframes are noted in the report's counts).
  The current flow format cannot target iframe contents; use a top-level flow or
  handle that case with a project-specific Playwright test.

**A flow fails at an `expectText`/`expectUrl` step.**
That's a real assertion failure — the app didn't do what the flow expected. Look
at `FAILED-step-N.png` and the errors listed for that step; this is often a genuine
bug, not a script problem.

**`expectText` fails but I can see the text.**
The match is case-insensitive substring against *visible* text. If the text is
split across elements, in a `title`/`alt` attribute, or hidden, it won't match —
assert on a more specific visible element with `expectVisible` instead.

**An `auditA11y` step reports an issue that is already accepted.**
Fix the state when practical. For a documented temporary exception, add its
finding code to that step's `allow` array and preserve the reason in the journey
charter. The audit intentionally checks only a lightweight set of visible-state
problems; it is not a replacement for axe, keyboard, or screen-reader testing.

## QE planning and diagnosis

**The coverage-gap report says a tested route is uncovered.**
`coverage.mjs` recognizes literal navigation/URL evidence. Routes hidden behind
helpers, fixtures, variables, or parameterization can look uncovered. Inspect
the reported route in the actual suite before adding a duplicate test; the
report is a planning heuristic, not runtime coverage.

**A matrix command works in my shell but not in `matrix.mjs`.**
Each variant's `command` must be an executable plus arguments as a JSON array.
Shell aliases, pipes, redirects, glob expansion, and command substitution are
not interpreted. Use the real executable and arguments, or prefer the test
runner's native project/parameter matrix.

**`triage.mjs` produced a useful report but exited with code 1.**
That is intentional whenever any repeated run fails. It prevents a flaky or
consistently failing command from appearing successful in CI. Read
`triage.md` and the per-run logs, then rerun after fixing the suspected cause.

## Generated tests

**The recorder says no graphical display was detected.**
Codegen is interactive and cannot run in a purely headless shell. Run it from a
local desktop session or configure display forwarding/VNC. Use
`record.mjs --dry-run` only to validate command construction; it does not record
a journey.

**The recording contains a password or other private value.**
Treat the draft as sensitive, replace the value with the project's secret or
fixture mechanism, and prefer `--load-storage` for future authenticated
recordings. Delete unreviewed drafts and HAR/auth artifacts when no longer needed.

**The generated Python test won't run.**
- Install the repository's Python Playwright runner, commonly
  `python -m pip install pytest pytest-playwright`.
- Configure its base URL or run pytest with `--base-url <URL>` when the flow uses
  relative `goto` paths.
- Python generation currently uses the synchronous `page` fixture. If the
  existing suite uses `playwright.async_api`, adapt the generated test to that
  suite's async fixtures before committing it.

**The generated `.spec.ts`/`.spec.js` won't run.**
- Install the runner in your app project: `npm install -D @playwright/test`.
- Set `baseURL` in `playwright.config.ts` (copy from
  `~/.agents/skills/pw-playwright-fieldkit/templates/`), or make the `goto` paths
  absolute.

**The generated test passes as a flow but fails in the project runner.**
Usually a timing or auth difference. Add explicit `expect(...).toBeVisible()`
or `expect(...).to_be_visible()` waits, and configure authentication through the
project's established fixtures/config rather than relying on the flow's session.

## Output & secrets

**I see `[REDACTED]` in a report.**
The tool masked a selected sensitive URL parameter, bearer token, or unusually
long email-like string. Redaction is deliberately best-effort: ordinary emails
and arbitrary secrets embedded in HTML or console text may remain. Always review
artifacts before sharing them.

**Reports keep piling up.**
The default crawl, inspect, flow, compare, charter, coverage, matrix, and triage
directories are git-ignored. Custom output paths are not, so add them to your
project's ignore rules if needed. Reports are regenerated artifacts and can
otherwise be deleted freely.

## Still stuck?

Run the failing command with `--headed` to watch the browser, and read the
matching `.json` output for the full detail the Markdown summarized. Almost every
"the tool is wrong" case turns out to be a late-rendering page (needs `--wait`),
a scoping filter, or a missing session.
