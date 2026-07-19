# /pw-discover-features — find undocumented and gated features

Goal: surface functionality that isn't in the docs — hidden routes, beta flags,
role-gated pages, admin tools, and interactive widgets a user might miss.

## Step 1 — Crawl broadly, logged out
```
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs <START_URL> --depth 3 --max-pages 60 --out report/discover
```
Read `report/discover/report.md` → **section 4, "Possibly undocumented / gated
features"**. It lists:
- **Beta/experimental markers** — elements tagged beta/experimental or carrying
  `data-feature` / `data-flag` attributes.
- **Links present in the DOM but not visible** — often routes the UI hides based
  on role, flags, or state. These are prime undocumented-feature candidates.
Also check **section 3** for login walls and interactive widgets (tabs, menus,
dialogs, switches, file uploads, search).

## Step 2 — Crawl again, logged in
Many features only appear once authenticated or with a privileged role.
```
node .agents/skills/pw-playwright-fieldkit/scripts/save-auth.mjs <LOGIN_URL> --headed --out auth.json      # log in once
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs <START_URL> --depth 3 --max-pages 60 \
     --storage-state auth.json --out report/discover-auth
```
Then **diff the two crawls automatically** — don't compare by hand:
```
node .agents/skills/pw-playwright-fieldkit/scripts/compare.mjs report/discover report/discover-auth --out report/gated
```
`report/gated/compare.md` lists exactly the **new pages, new forms, and structural
changes** that appear only when logged in — those are the gated features. For
multiple roles, save an `auth.json` per role and compare each against logged-out
(or admin against user).

Also run the crawl with `--spa` if the app is a single-page app (React/Vue/etc.),
so client-rendered routes with no `<a href>` are discovered too. And check the
crawl report's **robots.txt Disallow paths** (section 4) — the site owner listing
a path there often marks an internal/admin area worth probing with auth.

## Step 3 — Probe the candidates
For each hidden/gated route you found, inspect it directly:
```
node .agents/skills/pw-playwright-fieldkit/scripts/inspect.mjs <HIDDEN_URL> --storage-state auth.json --wait 1500
```
- A `200` with real content = a working, possibly undocumented feature.
- A `403`/redirect to login = gated; note what role/flag it needs.
- Use `--click` to expand menus/tabs and reveal sub-features.

## Step 4 — Exercise interactive widgets
For dialogs, menus, and toggles from section 3, use `inspect.mjs --click` to open
them and capture what they expose, or write a short `flow.json` to walk through a
multi-step feature.

## Step 5 — Report
Give the user a catalogue:
- **Feature** (name/route) · **How you reach it** (URL, role, flag, clicks) ·
  **What it does** (from the screenshot / a11y tree / content) ·
  **Documented?** (your guess) · **Worth a test?**
Flag anything that looks unfinished, insecure (e.g. an admin route reachable
without auth), or surprising.
