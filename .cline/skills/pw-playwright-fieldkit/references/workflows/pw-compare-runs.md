# /pw-compare-runs — diff two crawls to catch regressions and changes

Goal: tell the user exactly what changed between two same-origin crawls of a
site — for before/after a deploy or logged-out vs logged-in.

## Step 1 — Produce two crawls
Crawl the two states into separate output directories. Use the **same crawl
options** (depth, max-pages, filters) for both so the diff is apples-to-apples.

**Before/after a change (regression check):**
```
node .cline/skills/pw-playwright-fieldkit/scripts/crawl.mjs <URL> --depth 2 --max-pages 40 --out report/before
# ...deploy / make the change...
node .cline/skills/pw-playwright-fieldkit/scripts/crawl.mjs <URL> --depth 2 --max-pages 40 --out report/after
```
**Logged-out vs logged-in / role vs role (feature discovery):**
```
node .cline/skills/pw-playwright-fieldkit/scripts/crawl.mjs <URL> --out report/anon
node .cline/skills/pw-playwright-fieldkit/scripts/crawl.mjs <URL> --storage-state auth.json --out report/auth
```
The comparator matches exact absolute URLs, so do not compare different origins
(such as staging and production) without first normalizing the crawl data.

> Keep `--aria` on (the default) in both runs — it's what enables the structural
> (accessibility-tree) diff.

## Step 2 — Compare
```
node .cline/skills/pw-playwright-fieldkit/scripts/compare.mjs report/before report/after --out report/diff
```
(You can pass either the directory or its `crawl.json`.) Read
`report/diff/compare.md`. It reports:
- **New pages / removed pages** — routes that appeared or disappeared.
- **Status changes** — with regressions (2xx→4xx/5xx/FAIL) flagged.
- **Increased error signals on shared pages** — pages whose aggregate
  JS/console/network error count increased.
- **Form changes** — added/removed forms (a new form on a new page = a new feature).
- **Structural changes** — accessibility-tree node deltas per shared page, ranked
  by size, so you see which pages changed shape the most.

## Step 3 — Interpret and report
- **Regression check:** lead with removed pages, status regressions, and new
  errors — those are likely breakage. Offer to `/pw-debug-site` each one.
- **Feature discovery:** lead with new pages and new forms — those are the gated
  or role-specific features. Offer to `/pw-discover-features` or `/pw-generate-tests`.
The machine-readable summary on stdout (`{newPages, removedPages, statusChanges,
errorRegressions}`) is easy to gate CI on — a nonzero regression count can fail a
pipeline.
