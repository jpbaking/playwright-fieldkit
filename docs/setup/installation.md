# Installation

For the agent-guided workflow selection, return to the
[User Guide](../user-guide.md).

## Requirements

- **Node.js 18 or newer** (`node --version`).
- Disk space for a browser engine (~150–300 MB per engine).
- Network access to reach the site you're exploring.

You do **not** need any web-search/fetch capability in your AI agent — the
scripts do all the browser work locally.

## Standard setup

**Preferred — agent-guided.** Paste this into your coding agent from the
consuming project's root; it merges with existing `AGENTS.md` / `CLAUDE.md` /
ignore files instead of colliding with them:

```
Fetch https://raw.githubusercontent.com/jpbaking/playwright-skills/main/AGENT-INSTALL.md and follow its instructions exactly to install Playwright FieldKit into this project. Merge with — never blindly overwrite — any existing AGENTS.md, CLAUDE.md, rule, or ignore files, and report every file you created or changed.
```

**Script alternative**, from the consuming project's root:

```sh
curl -fsSL https://raw.githubusercontent.com/jpbaking/playwright-skills/main/install.sh | sh
# Windows: irm https://raw.githubusercontent.com/jpbaking/playwright-skills/main/install.ps1 | iex
```

Both paths install the canonical package to
`.agents/skills/pw-playwright-fieldkit/` (Codex, Antigravity, current Cline —
and the runtime home of the scripts), a byte-identical `.claude/skills/` copy
for Claude Code, the activation rule to `.agents/rules/`, `.claude/rules/`, and
`.clinerules/`, generated `/pw-*` shortcut workflows for Cline, and conditional
`AGENTS.md` / `CLAUDE.md` pointers. All generated adapters are gitignored in
the consuming project; on a fresh clone, re-run either path to regenerate them
(the `scripts/node_modules` browser runtime is per-machine anyway). Keep any
unrelated rules or workflows already present.

Then, from the consuming project root:

```bash
cd .agents/skills/pw-playwright-fieldkit/scripts
npm install                      # installs the `playwright` library
npx playwright install chromium  # downloads the Chromium engine
```

Verify it works:

```bash
npm test
# → runs browser tools, QE artifacts, generation, packaging, and comparison against localhost
```

### Add more browser engines (optional)

```bash
npx playwright install firefox webkit
# then use --browser firefox / --browser webkit
```

### Linux system dependencies

On a fresh Linux box (or CI), the browser may need system libraries:

```bash
npx playwright install-deps chromium   # may require sudo
```

## Running the generated tests

Exploring needs only the bundled Node `playwright` library. Generated tests
should use the consuming application's existing runner and dependency setup.
For a Python pytest suite:

```bash
cd /path/to/your/app
python -m pip install pytest pytest-playwright
python -m playwright install chromium
pytest tests/e2e/test_generated.py --tracing=on
```

For an `@playwright/test` suite:

```bash
cd /path/to/your/app
npm install -D @playwright/test
npx playwright install chromium
# copy .agents/skills/pw-playwright-fieldkit/templates/playwright.config.ts to your project root, set baseURL
npx playwright test --trace on
```

## CI (GitHub Actions example)

```yaml
jobs:
  explore:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Install Playwright
        working-directory: .agents/skills/pw-playwright-fieldkit/scripts
        run: |
          npm install
          npx playwright install --with-deps chromium
      - name: Run toolkit self-tests
        working-directory: .agents/skills/pw-playwright-fieldkit/scripts
        run: npm test
      - name: Crawl staging for regressions
        run: node .agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs "$STAGING_URL" --depth 2 --max-pages 40 --out report
        env:
          STAGING_URL: ${{ secrets.STAGING_URL }}
      - uses: actions/upload-artifact@v4
        with:
          name: exploration-report
          path: report/
```

`crawl.mjs` prints a machine-readable JSON summary on stdout (`{pages, errors,
forms, ...}`), and `flow.mjs` exits non-zero on failure — both are easy to gate
a pipeline on.

The repository's own `.github/workflows/self-test.yml` runs the localhost suite
against Chromium, Firefox, and WebKit. Separate jobs execute generated
TypeScript and Python tests with their respective runners, while neither runner
is added to the toolkit's runtime dependencies.

## Docker

```dockerfile
FROM mcr.microsoft.com/playwright:v1.61.1-jammy
WORKDIR /work
COPY .agents/skills/pw-playwright-fieldkit/scripts/package.json .agents/skills/pw-playwright-fieldkit/scripts/package-lock.json .agents/skills/pw-playwright-fieldkit/scripts/
RUN cd .agents/skills/pw-playwright-fieldkit/scripts && npm ci
COPY . .
# Browsers are preinstalled in this base image.
ENTRYPOINT ["node", ".agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs"]
```

```bash
docker build -t pw-playwright-fieldkit .
docker run --rm -v "$PWD/report:/work/report" pw-playwright-fieldkit https://example.com --out report
```

Match the base-image tag to the exact `playwright` version pinned in
`.agents/skills/pw-playwright-fieldkit/scripts/package-lock.json`. The package manifest accepts a range, so copying only
`package.json` and running an unlocked install can select a version whose browser
binary does not match the image.

## Offline / air-gapped notes

- Browser downloads can be redirected with `PLAYWRIGHT_DOWNLOAD_HOST` or vendored
  via `PLAYWRIGHT_BROWSERS_PATH`.
- The toolkit makes no model/search API calls. The browser still contacts the
  target site and any third-party resources that site loads.

See [troubleshooting.md](troubleshooting.md) if setup fails.
