# 🧰 Playwright FieldKit

**Agent-guided web exploration and QE automation.**

Give your AI coding assistant a reliable pair of hands and eyes on the web.

Playwright FieldKit is a drop-in toolkit that teaches coding agents to *walk
through a website like a real user*—clicking,
reading, filling forms, following links — and come back with a report you can
act on. Point it at a URL and it will map the reachable, same-origin surface, catch what's broken,
uncover hidden features, and write integration tests that actually pass.

The core is ordinary Node.js plus Markdown playbooks, packaged as one portable
Agent Skill for Antigravity CLI, Codex, Claude Code, Gemini CLI, Cline, and OpenCode.
Start with
the [User Guide](docs/user-guide.md) for setup paths and workflows.

Run unattended or watch the agent execute a supplied test case in a headed
browser. No brittle hand-written automation or model web access is required—just
a browser and a plan.

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
| 🧠 **Derives tests from your source code** | Reads routing, handler, and validation code for candidate journeys — parameterized routes, role gates, server-side validation — reconciles each against a crawl, and labels every expected result as specified, derived, or contested. |
| 📝 **Designs test cases from feature specs** | Extracts traceable requirements, drafts risk-based cases, and enforces separate QE review and approval before execution. |
| 👀 **Executes approved test-case documents** | `pw-execute-test-case` translates one approved case into a headed or headless journey, captures a trace, and asks you to confirm the execution. |
| ▶️ **Runs permanent automated tests** | `pw-run-automated-tests` runs existing Python or TypeScript/JavaScript test code unchanged and reports every result with mandatory traces. |
| ✅ **Writes real tests** | `pw-generate-tests` turns confirmed journeys into permanent test code, then hands it to the automated-test runner for traced verification. |
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
$ node ~/.agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://quotes.toscrape.com --depth 1 --max-pages 8 --out report/explore

i Crawling https://quotes.toscrape.com/ (depth 1, max 8 pages, chromium)
✓ Visited 8 pages. 0 pages with errors, 1 forms.
✓ Report:  /…/pw-playwright-fieldkit/report/explore/report.md
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
it into a test?"* — and `pw-generate-tests` writes a passing test in the
project's existing language.

---

## Quick start

Installation is agent-guided only — there are no install scripts. Paste this into your coding agent:

```
Install Playwright FieldKit. Using git with my existing credentials (do not
download raw files or archives), clone
https://github.com/jpbaking/playwright-fieldkit at tag v4.0.0 with --depth 1
into a new temporary directory outside any project. Then read AGENT-INSTALL.md
from that clone and follow it exactly. Merge with—never blindly overwrite—any
existing global instruction files, ask me which harnesses to install for, and
report every file you created or changed.
```

This prompt pins release `v4.0.0` (cloned with `--branch v4.0.0`). To install
another release, change the tag; to track the default branch, drop
`at tag v4.0.0`. On a fork, mirror, or enterprise host, substitute the remote
you clone from.

**What the prompt does:** your agent clones this repository with your own git
credentials and executes [AGENT-INSTALL.md](./AGENT-INSTALL.md), the authoritative
install contract. It installs the package to
`~/.agents/skills/pw-playwright-fieldkit/` (Codex, Gemini CLI, Cline, and
OpenCode discovery, plus the single scripts runtime — always installed), with
byte-identical copies in `~/.claude/skills/` (Claude Code) and
`~/.gemini/antigravity-cli/skills/` (Antigravity CLI) when selected. It stores
the activation rule once at `~/.agents/rules/pw-playwright-fieldkit.md` and
adds a marker-guarded pointer to each selected host's global instruction
file. It writes nowhere else, and nothing is added to your repos. The install
is per-user and per-machine; re-run it anytime to update, and the contract
also covers uninstall. Then, from any project root:

```bash
# 1. Install the browser engine (once)
(cd ~/.agents/skills/pw-playwright-fieldkit/scripts && npm install && npx playwright install chromium)

# 2. Map a site
node ~/.agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs https://your-app.example.com --depth 2 --max-pages 40

# 3. Read playwright-report-explore/report.md—or ask the agent to explore the site
```

The installed package lives in `~/.agents/skills/pw-playwright-fieldkit/`. A
small always-on rule helps weaker models activate it from natural-language
requests, and the skill routes each request to the matching bundled workflow:

- *"Explore my site at localhost:3000 and tell me what's broken"* → `pw-explore-site`
- *"The save button throws an error, debug it"* → `pw-debug-site`
- *"What features does this app have that aren't documented?"* → `pw-discover-features`
- *"Design test cases from this feature specification"* → `pw-design-test-cases`
- *"Review these cases against the specification"* → `pw-review-test-cases`
- *"Read the code and work out what integration tests this app needs"* → `pw-derive-tests-from-code`
- *"Write integration tests for the login and search flows"* → `pw-generate-tests`
- *"Let me demonstrate the checkout flow in a browser"* → `pw-record-flow`
- *"Execute this approved test case and let me review the trace"* → `pw-execute-test-case`
- *"Run these generated Playwright tests and report every trace"* → `pw-run-automated-tests`
- *"Audit the site and tell me what to improve"* → `pw-recommend-improvements`
- *"Did my last deploy change or break anything?"* → `pw-compare-runs`

Quality engineers can request charters, coverage gaps, test data, negative
paths, interactive accessibility, risk-based matrices, and flake triage in
plain language. The [User Guide](docs/user-guide.md) routes beginners to a
focused guide for each workflow set. The
[Agent Harness Guide](docs/setup/agent-harness.md) documents capability
requirements and smoke tests.

---

## What's in the box

```
pw-playwright-fieldkit/
├── .agents/skills/pw-playwright-fieldkit/   # authoritative
│   ├── SKILL.md             # Intent routing, operating guidance, safety
│   ├── scripts/             # Deterministic browser engine + regression suite
│   │   ├── crawl.mjs
│   │   ├── inspect.mjs
│   │   ├── flow.mjs
│   │   ├── record.mjs
│   │   ├── compare.mjs
│   │   ├── save-auth.mjs
│   │   ├── charter.mjs
│   │   ├── test-cases.mjs
│   │   ├── coverage.mjs
│   │   ├── matrix.mjs
│   │   └── triage.mjs
│   ├── assets/              # Flow, charter, matrix, data, spec, and page-object scaffolds
│   └── references/workflows/ # Detailed workflow playbooks
├── .claude/skills/pw-playwright-fieldkit/  # generated byte-identical mirror
├── .gemini/settings.json                   # points Gemini CLI at AGENTS.md
├── rules/shared/            # Always-on activation rule (installed per harness)
├── AGENT-INSTALL.md         # The agent-guided (user-global) install contract
└── docs/
    ├── user-guide.md        # Single product and workflow entry point
    ├── qe/                  # Focused QE workflow-set guides
    ├── setup/               # Installation, harness, and troubleshooting
    └── reference/           # CLI and future-work references
```

---

## Requirements

- **Node.js 18+**
- **Playwright** (`npm install && npx playwright install chromium` in
  `~/.agents/skills/pw-playwright-fieldkit/scripts/`)
- A coding agent that can run shell commands and read files. **No
  web-search/fetch capability is needed.**

Run the bundled localhost regression suite with `cd ~/.agents/skills/pw-playwright-fieldkit/scripts && npm test`.

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

**[User Guide](docs/user-guide.md)** is the single product entry point. It maps
your goal to an agentic workflow and links the focused QE, setup,
troubleshooting, harness, CLI, and future-work documentation.

## License

[MIT](LICENSE). Use it, fork it, ship it. Contributions are welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md). Report security concerns privately as
described in [SECURITY.md](SECURITY.md).
