# /pw-recommend-improvements — audit a site and suggest fixes

Goal: use the exploration data to give the user a prioritized list of concrete
improvements across reliability, accessibility, UX, and testability.

## Step 1 — Gather evidence
```
node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs <START_URL> --depth 2 --max-pages 40 --out report/audit
```
Read section 7, **Deterministic quality audit**, first. Then `inspect.mjs` a few
representative pages with `--wait 2000` for deeper accessibility-tree and console
evidence.

## Step 2 — Analyze across these axes
Use the crawl's structured audit findings as the primary evidence, then inspect
the reports and `*.a11y.yaml` trees for context:

**Reliability**
- Pages under "Problems found": JS errors, failed requests, 4xx/5xx, slow docs.
- Unexpected `dialog()` popups (often leftover debug code).

**Accessibility** (from the `*.a11y.yaml` trees and extracted features)
- Missing landmarks (no `main`/`nav`/`header`), missing/duplicate `h1`.
- Form fields with no associated label (report shows `label: null`).
- Buttons/links with empty accessible names.
- Missing `lang` on `<html>`.

**UX & structure**
- Inconsistent navigation between pages; orphan pages; dead/hidden links.
- Forms with no visible submit, or no client-side validation feedback.
- Very heavy pages (high link/iframe counts) that could be split.

**Security-ish smells** (report, don't exploit)
- Admin/gated routes reachable without auth (from /pw-discover-features).
- Tokens/secrets appearing in URLs (the tools redact these — note if you see the
  `[REDACTED]` marker, it means a secret was exposed in a link/request).

**Testability**
- Elements lacking stable selectors (`selectorHint: null` in the report) — these
  are hard to test; recommend adding `data-testid`.

## Step 3 — Prioritize
Rank findings High / Medium / Low by user impact × effort. Broken pages and
missing form labels are usually High; cosmetic structure issues are Low.

## Step 4 — Deliver
For each recommendation give: **the problem**, **the evidence** (URL + the exact
error or missing attribute from the report), **the suggested fix**, and **why it
matters**. Group by axis, ordered by priority. Offer to `/pw-generate-tests` for the
flows you'd want protected against regression, and `/pw-debug-site` for anything
that needs a root-cause dive.

Stay within evidence: recommend based on what the tools observed, and say when
something needs a human judgment call you can't make from a crawl.
