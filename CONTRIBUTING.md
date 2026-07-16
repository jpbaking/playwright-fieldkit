# Contributing

Contributions to Playwright FieldKit are welcome. Keep changes focused and open
an issue first when a proposal would significantly change package structure,
safety boundaries, generated-test conventions, or report formats.

Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

## Development setup

```bash
cd .cline/skills/pw-playwright-fieldkit/scripts
npm ci
npx playwright install chromium
npm test
```

The normal suite runs entirely against localhost. It must pass before a pull
request is submitted. CI additionally runs the browser suite with Chromium,
Firefox, and WebKit and executes generated TypeScript and Python tests with
their native runners.

## Pull requests

- Preserve `.cline/skills/pw-playwright-fieldkit/` as the canonical package.
- Keep `.clinerules/workflows/` as thin shortcuts to canonical playbooks.
- Add or update deterministic self-tests for behavioral changes.
- Update the User Guide and the affected focused QE, setup, or reference guide
  when user-visible behavior changes.
- Do not include real credentials, auth state, HAR files, recordings, target
  reports, or private application details.
- Keep unrelated formatting or generated artifacts out of the change.

By contributing, you agree that your contribution is licensed under the
project's [MIT License](LICENSE).
