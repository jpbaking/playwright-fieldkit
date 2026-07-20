# /pw-explore-site — map a website end to end

Goal: give the user a complete picture of a site — its pages, its health, its
forms, and its hidden corners — by walking it as a user.

Ask the user for the **start URL** if they didn't give one. Then:

## Step 1 — Setup check
If you have not run the tools yet this session, confirm Playwright is installed.
If a script errors with `Playwright is not installed`, tell the user to run
`(cd ~/.agents/skills/pw-playwright-fieldkit/scripts && npm install && npx playwright install chromium)` and stop until done.

## Step 2 — Crawl
```
node ~/.agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs <START_URL> --depth 2 --max-pages 40 --out report/explore
```
- If the site is large, keep `--depth 2` but raise `--max-pages` gradually.
- To stay inside one section, add `--same-path` or `--include "^/docs"`.
- To skip noisy areas, add `--exclude "/logout|/api/"`.
- If the site is a **single-page app** (React/Vue/etc.) and the crawl only finds a
  page or two, add `--spa` so client-rendered routes (navigated via clicks, not
  `<a href>`) are discovered too.
- To audit the **mobile** experience, add `--device "iPhone 13"`.
- If the interesting pages are behind a login, first run `/pw-explore-site` after
  `save-auth.mjs` (see the authentication section of
  `docs/reference/cli.md`) and add
  `--storage-state auth.json`.

The crawl automatically seeds from `robots.txt` and `sitemap.xml` (unlinked
routes + the owner's Disallow list) — no flag needed; use `--no-sitemap` to skip.
For a requested site-wide link audit, add `--check-links`. If an earlier crawl was
interrupted and its output contains `.crawl-state.json`, rerun compatible options
with `--resume`.

## Step 3 — Read the report
Open `report/explore/report.md`. It has eight sections:
1. Problems found · 2. Site map · 3. Forms & interactive features ·
4. Possibly undocumented/gated features · 5. Performance · 6. Link check ·
7. Deterministic quality audit · 8. Suggested next steps.

## Step 4 — Drill into anything flagged
For every page listed under **Problems found**, run:
```
node ~/.agents/skills/pw-playwright-fieldkit/scripts/inspect.mjs <THAT_URL> --wait 1500 --out report/inspect
```
and read `report/inspect/inspect.md` for the full console + network detail.

## Step 5 — Report back
Summarize for the user in prose:
- **Scope:** how many pages you visited out of how many discovered.
- **Health:** the broken pages / errors, each with its URL and the actual error.
- **Surface area:** the main sections, the forms, and any login walls.
- **Hidden features:** anything from section 4 worth investigating.
- **Recommended next move:** e.g. "run /pw-generate-tests on the login form" or
  "run /pw-debug-site on the 500 at /account".

Do not paste the whole report; pull out what matters and link the file paths.
