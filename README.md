# 🧰 Playwright FieldKit

**Agent-guided web exploration and QE automation.**

Give your AI coding assistant a reliable pair of hands and eyes on the web.

Playwright FieldKit is a drop-in toolkit that teaches Cline (and other coding
agents) to *walk through a website like a real user* — clicking,
reading, filling forms, following links — and come back with a report you can
act on. Point it at a URL and it will map the reachable, same-origin surface, catch what's broken,
uncover hidden features, and write integration tests that actually pass.

Cline gets first-class skill activation and shortcut packaging, but the core is
ordinary Node.js plus Markdown playbooks. Other terminal-capable agent harnesses
can use the same canonical package through a thin adapter; see the
[agent-harness guide](docs/agent-harness-guide.md).

No screen-watching. No brittle hand-written automation. No web access required
for the model — just a browser and a plan.

---

## Why it exists

Coding assistants are great at reading code but blind to the running app. Ask one
to "test the site" and it will usually hallucinate Playwright scripts that don't
run. Playwright FieldKit flips the model:

> **The model doesn't write browser code — it runs battle-tested scripts and
> reasons over their reports.**

That single design choice makes it work even with **smaller, cheaper models** and
**no web-search or fetch tools**. The scripts do the driving; the model does the
thinking.

---

## What it does

| | |
|---|---|
| 🗺️ **Maps the reachable site** | Crawls same-origin links breadth-first — plus `sitemap.xml`/`robots.txt` seeding and optional SPA route discovery — building a live map of the pages visited within the configured depth and page cap. |
| 🐞 **Finds what's broken** | Catches JS errors, failed/slow network requests, bad status codes, and stray dialogs — ranked, with the exact URL. |
| 🔗 **Checks links on demand** | `--check-links` verifies discovered internal/external links and assets with bounded, rate-limited requests, including redirect chains and source pages. |
| 🔍 **Uncovers hidden features** | Flags beta flags, gated routes, admin tools, `robots` Disallow paths, and links the UI hides — logged out *and* logged in. |
| 🎬 **Records your journey** | Opens a visible browser so you can demonstrate a flow, then lets the agent review, explain, and integrate the generated test. |
| ✅ **Writes real tests** | Turns user journeys into verified Python or TypeScript/JavaScript Playwright tests, following the repository's existing convention. |
| 🧭 **Preserves QE intent** | Turns journey intent, risk, data, outcomes, variants, and cleanup into a validated charter before replay code becomes the specification. |
| 🧩 **Finds automation gaps** | Compares crawled routes and forms with literal navigation found in existing Python or Node tests for review and prioritization. |
| 🧪 **Exercises failure states** | Adds deterministic response/network mocks and accessibility checks at meaningful interactive states, then emits them into generated tests. |
| 🩺 **Triages flaky tests** | Repeats a narrow command, preserves run evidence, classifies common causes, and distinguishes consistent from intermittent failures. |
| 🔀 **Diffs two crawls** | Before/after a deploy, or logged-out vs logged-in: new/removed pages, status regressions, increased error-signal counts, and structural changes. Crawls must use the same origin. |
| ♿ **Audits quality deterministically** | Reports missing language, headings, landmarks, control/link/button names, and configurable page/request performance thresholds from captured evidence. |
| 💡 **Recommends fixes** | Prioritized, evidence-backed improvements across reliability, a11y, UX, and testability. |

---

## See it in action

```console
$ node .cline/skills/playwright-fieldkit/scripts/crawl.mjs https://quotes.toscrape.com --depth 1 --max-pages 8 --out report/explore

i Crawling https://quotes.toscrape.com/ (depth 1, max 8 pages, chromium)
✓ Visited 8 pages. 0 pages with errors, 1 forms.
✓ Report:  /…/playwright-fieldkit/report/explore/report.md
```

```markdown
## 1. Problems found (fix these)
_No console errors, failed requests, or bad status codes observed._

## 3. Interactive features & forms
**Login/auth walls detected on:** `https://quotes.toscrape.com/login`
**Forms** (candidates for integration tests):
- `POST` /login — fields: csrf_token, username, password, submit
```

From there the model can say: *"Found a login form at `/login`. Want me to turn
it into a test?"* — and `/generate-tests` writes a passing test in the
project's existing language.

---

## Quick start

Copy `.cline/skills/playwright-fieldkit/` into the same path in your project.
For Cline's activation fallback and shortcuts, also merge
`.clinerules/playwright-fieldkit.md` and `.clinerules/workflows/` into the
project; do not replace unrelated rules already there. Then, from the project
root:

```bash
# 1. Install the browser engine (once)
(cd .cline/skills/playwright-fieldkit/scripts && npm install && npx playwright install chromium)

# 2. Map a site
node .cline/skills/playwright-fieldkit/scripts/crawl.mjs https://your-app.example.com --depth 2 --max-pages 40

# 3. Read playwright-report-explore/report.md — or just ask Cline to "/explore-site"
```

If you use **Cline**, the canonical package lives in
`.cline/skills/playwright-fieldkit/`. A small always-on rule helps weaker models
activate it from natural-language requests, while the familiar workflows remain
available as explicit shortcuts:

- *"Explore my site at localhost:3000 and tell me what's broken"* → `/explore-site`
- *"The save button throws an error, debug it"* → `/debug-site`
- *"What features does this app have that aren't documented?"* → `/discover-features`
- *"Write integration tests for the login and search flows"* → `/generate-tests`
- *"Let me demonstrate the checkout flow in a browser"* → `/record-flow`
- *"Audit the site and tell me what to improve"* → `/recommend-improvements`
- *"Did my last deploy change or break anything?"* → `/compare-runs`

Quality engineers can also use explicit shortcuts for charters, coverage gaps,
test data, negative paths, interactive accessibility, risk-based matrices, and
flake triage. The [QA/QE Guide](docs/qa-qe-guide.md) starts with the
non-technical “demonstrate, then explain” workflow.

Using another coding-agent harness? Keep the canonical skill at
`.cline/skills/playwright-fieldkit/` and point that harness's repository rule or
native skill adapter at its `SKILL.md`. The
[agent-harness guide](docs/agent-harness-guide.md) includes a portable adapter
prompt, shortcut mapping, capability requirements, and a smoke test.

---

## What's in the box

```
playwright-fieldkit/
├── .cline/skills/playwright-fieldkit/
│   ├── SKILL.md             # Intent routing, operating guidance, safety
│   ├── scripts/             # Deterministic browser engine + regression suite
│   │   ├── crawl.mjs
│   │   ├── inspect.mjs
│   │   ├── flow.mjs
│   │   ├── record.mjs
│   │   ├── compare.mjs
│   │   ├── save-auth.mjs
│   │   ├── charter.mjs
│   │   ├── coverage.mjs
│   │   ├── matrix.mjs
│   │   └── triage.mjs
│   ├── templates/           # Flow, charter, matrix, data, spec, and page-object scaffolds
│   └── references/workflows/ # Detailed workflow playbooks
├── .clinerules/             # Always-on activation rule + browser/QE shortcuts
└── docs/                    # Coder guide, QA/QE guide, install, troubleshooting, roadmap
```

---

## Requirements

- **Node.js 18+**
- **Playwright** (`npm install && npx playwright install chromium` in
  `.cline/skills/playwright-fieldkit/scripts/`)
- A coding agent that can run shell commands and read files (Cline, or any
  similar agent). **No web-search/fetch capability is needed.**

Run the bundled localhost regression suite with `cd .cline/skills/playwright-fieldkit/scripts && npm test`.

---

## Design principles

1. **Scripts over improvisation.** Deterministic, tested tools beat model-authored
   automation — especially for weaker models.
2. **Markdown for the model, JSON for the record.** Each reporting command emits a
   short report a model can read in one pass, plus JSON for captured detail.
3. **Passive by default.** Normal crawling navigates and reads, dialogs are
   auto-dismissed, and obvious secrets in URL parameters and bearer tokens are
   redacted. Opt-in `--spa` discovery clicks navigation-like elements, so use it
   only where those interactions are safe.
4. **Authorization can be enforced.** An optional allowlist blocks unapproved
   navigation in code; explicit overrides are recorded in output metadata.
5. **From exploration to regression.** The same journey you explore with becomes
   the test that protects it.

---

## Documentation

- 🧑‍💻 **[Coder Guide](docs/user-guide.md)** — CLI tools, options, flow format, and examples
- 🧪 **[QA/QE Guide](docs/qa-qe-guide.md)** — demonstrate journeys, design coverage, data, variants, failure states, and flake triage
- 🔌 **[Agent Harness Guide](docs/agent-harness-guide.md)** — use the same skill, scripts, and playbooks outside Cline
- ⚙️ **[Installation](docs/installation.md)** — setup, CI, Docker
- 🧯 **[Troubleshooting](docs/troubleshooting.md)** — when a crawl misbehaves
- 🗺️ **[Future work](docs/future-work.md)** — unimplemented candidates under consideration

## License

[MIT](LICENSE). Use it, fork it, ship it. Contributions are welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md). Report security concerns privately as
described in [SECURITY.md](SECURITY.md).
