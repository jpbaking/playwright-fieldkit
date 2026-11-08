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

Installation is agent-guided only (no install scripts) and **user-global** —
nothing is added to your repos. Paste this into your coding agent; it merges
with existing global instruction files instead of colliding with them:

```
Install Playwright FieldKit. Using git with my existing credentials (do not
download raw files or archives), clone
https://github.com/jpbaking/playwright-fieldkit with --depth 1 into a new
temporary directory outside any project. Then read AGENT-INSTALL.md from that
clone and follow it exactly. Merge with—never blindly overwrite—any existing
global instruction files, ask me which harnesses to install for, and report
every file you created or changed.
```

Without a tag, the prompt installs the default branch as it is at clone time;
add `at tag vX.Y.Z` (cloned with `--branch vX.Y.Z`) to pin a release. On a
fork, mirror, or enterprise host, substitute the remote you clone from.

**What the prompt does:** your agent clones this repository with your own git
credentials and executes [AGENT-INSTALL.md](../../AGENT-INSTALL.md), the authoritative
install contract. It installs the package to
`~/.agents/skills/pw-playwright-fieldkit/` (Codex, Gemini CLI, Cline, and
OpenCode discovery, plus the single scripts runtime — always installed), with
byte-identical copies in `~/.claude/skills/` (Claude Code) and
`~/.gemini/antigravity-cli/skills/` (Antigravity CLI) when selected. It stores
the activation rule once at `~/.agents/rules/pw-playwright-fieldkit.md` and
adds a marker-guarded pointer to each selected host's global instruction
file. It writes nowhere else, and nothing is added to your repos. The install
is per-user and per-machine; re-run it anytime to update, and the contract
also covers uninstall.

Then:

```bash
cd ~/.agents/skills/pw-playwright-fieldkit/scripts
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
# copy ~/.agents/skills/pw-playwright-fieldkit/assets/playwright.config.ts to your project root, set baseURL
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
        working-directory: ~/.agents/skills/pw-playwright-fieldkit/scripts
        run: |
          npm install
          npx playwright install --with-deps chromium
      - name: Run toolkit self-tests
        working-directory: ~/.agents/skills/pw-playwright-fieldkit/scripts
        run: npm test
      - name: Crawl staging for regressions
        run: node ~/.agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs "$STAGING_URL" --depth 2 --max-pages 40 --out report
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
COPY ~/.agents/skills/pw-playwright-fieldkit/scripts/package.json ~/.agents/skills/pw-playwright-fieldkit/scripts/package-lock.json ~/.agents/skills/pw-playwright-fieldkit/scripts/
RUN cd ~/.agents/skills/pw-playwright-fieldkit/scripts && npm ci
COPY . .
# Browsers are preinstalled in this base image.
ENTRYPOINT ["node", "~/.agents/skills/pw-playwright-fieldkit/scripts/crawl.mjs"]
```

```bash
docker build -t pw-playwright-fieldkit .
docker run --rm -v "$PWD/report:/work/report" pw-playwright-fieldkit https://example.com --out report
```

Match the base-image tag to the exact `playwright` version pinned in
`~/.agents/skills/pw-playwright-fieldkit/scripts/package-lock.json`. The package manifest accepts a range, so copying only
`package.json` and running an unlocked install can select a version whose browser
binary does not match the image.

## Offline / air-gapped notes

- Browser downloads can be redirected with `PLAYWRIGHT_DOWNLOAD_HOST` or vendored
  via `PLAYWRIGHT_BROWSERS_PATH`.
- The toolkit makes no model/search API calls. The browser still contacts the
  target site and any third-party resources that site loads.

See [troubleshooting.md](troubleshooting.md) if setup fails.
