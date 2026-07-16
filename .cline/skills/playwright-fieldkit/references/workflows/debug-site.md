# /debug-site — find and reproduce bugs by using the site

Goal: locate what's broken and produce a concrete, reproducible bug report (and
optionally a failing test that proves it).

## Step 1 — Understand the bug
Get from the user: the **URL**, and if they know it, the **steps to reproduce**
and **what should happen vs. what happens**. If they only say "something's
broken," start with a crawl to find it.

Treat navigation complaints as bugs too. Phrases such as “links point to the
wrong targets,” “this button goes to the wrong page,” “navigation is broken,” or
“this link redirects somewhere unexpected” select the link-target procedure in
Step 2C. The user does not need to type `/debug-site`.

## Step 2A — If you must find the bug: crawl
```
node .cline/skills/playwright-fieldkit/scripts/crawl.mjs <START_URL> --depth 2 --max-pages 40 --out report/debug
```
Read `report/debug/report.md` → **Problems found**. Each entry has the URL and
the exact console error / failed request / bad status code. Those are your bugs.

## Step 2B — If you know the page: inspect it
```
node .cline/skills/playwright-fieldkit/scripts/inspect.mjs <URL> --wait 2000 --out report/debug
```
`inspect.md` gives you: HTTP status, every JS error with stack, failed/slow
network requests, console warnings, the accessibility tree, and a screenshot.
To capture the bug after an interaction, chain clicks:
```
node .cline/skills/playwright-fieldkit/scripts/inspect.mjs <URL> --click "text=Load more" --click "#save" --wait 2000
```
Each `--click` re-captures state, so you see errors triggered by the interaction.

## Step 2C — If links or navigation targets are wrong

Do not stop after checking for 404s: a wrong destination can return `200` and
still be a bug.

1. Inspect the **source page**:
   ```
   node .cline/skills/playwright-fieldkit/scripts/inspect.mjs <SOURCE_URL> --wait 1000 --out report/debug-links
   ```
2. Read the initial state's **Link targets** in
   `report/debug-links/inspect.md`. Find the reported link by its visible text
   and record: source URL, text, declared destination, `target`, and selector.
3. Compare the declared destination with what the user expected. If they differ,
   that is direct evidence even when both pages return `200`.
4. Verify normal same-tab behavior by clicking the exact selector printed in the
   report:
   ```
   node .cline/skills/playwright-fieldkit/scripts/inspect.mjs <SOURCE_URL> --click '<SELECTOR>' --wait 1000 \
        --out report/debug-link-click
   ```
   Read the **URL** under “State: after click …”. Report both the declared target
   and this final post-click URL so redirects are visible.
5. If the link has `target="_blank"`, the source tab will not navigate. Inspect
   its declared destination directly and use that inspection state's URL to
   reveal redirects.

For a site-wide complaint, crawl first to locate bad status codes, then apply
this procedure to the source pages the user identifies. Do not infer that a
valid `200` destination is semantically correct; compare it with the user's
expected destination or clearly label that judgment as unresolved.

For a site-wide request to find unreachable links or assets, run the crawl with
`--check-links` and use section 6. This checks technical reachability and redirect
chains; semantic correctness still needs an expected destination.

If the expected URL is known, encode the reproduction as `click` followed by
`expectUrl`. Before the fix it should fail and capture evidence. After the fix,
rerun it with `--gen-test` to create the passing regression test. Inspect the
existing E2E suite first and use a `.py` or `.ts`/`.js` output path that matches
its language. Ask the user if no convention is clear.

## Step 3 — Reproduce it deterministically as a flow
Write a small `flow.json` that reproduces the bug step by step, then run it:
```json
{ "name": "repro: save button throws", "baseUrl": "https://app.example.com",
  "steps": [
    { "goto": "/editor" },
    { "fill": "#title", "value": "test" },
    { "click": "#save" },
    { "expectText": "Saved" }
] }
```
```
node .cline/skills/playwright-fieldkit/scripts/flow.mjs flow.json --out report/debug
```
`flow.md` shows exactly which step failed, with a `FAILED-step-N.png` screenshot
and any JS/network errors that fired during that step.

## Step 4 — Diagnose
Correlate: a failed request URL + a console error + the failing step usually
points straight at the cause (a 500 from an API, a null-reference in a handler,
a missing element). Look at the screenshot for the visual state.

## Step 5 — Report the bug
Give the user:
- **Repro steps** (the flow you ran).
- **Expected vs. actual.**
- **Evidence:** the exact error text, the failing request (method/URL/status),
  and the screenshot path.
- **Likely cause** and, if the code is in this repo, the file/line to look at.
- Optionally, keep the `flow.json` as a **regression test** via a matching output
  such as `--gen-test tests/test_repro_<bug>.py` or
  `--gen-test tests/repro-<bug>.spec.ts` so the fix can be verified.
