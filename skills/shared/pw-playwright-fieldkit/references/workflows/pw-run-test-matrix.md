# /pw-run-test-matrix — exercise meaningful roles, browsers, and devices

Start from the journey's risk and supported product matrix. Do not multiply every
test across every combination. Select variants that exercise a real role,
engine, viewport/device, locale, or timezone risk; keep a fast primary variant
for ordinary feedback.

Copy `.agents/skills/pw-playwright-fieldkit/templates/matrix.example.json`, then
replace each command with the repository's normal runner invocation. Commands
are arrays and are executed without shell interpolation. Ensure parallel variants
have isolated accounts/data and non-colliding artifact paths.

Matrix variants that run permanent tests follow the same trace contract as
`pw-run-automated-tests.md`: include `--tracing=on` (pytest-playwright) or
`--trace on` (`@playwright/test`) in each variant's command and report every
variant's trace paths with its result.

```bash
node .agents/skills/pw-playwright-fieldkit/scripts/matrix.mjs matrix.json --dry-run
node .agents/skills/pw-playwright-fieldkit/scripts/matrix.mjs matrix.json --out report/matrix
```

Report failures per variant; distinguish product differences from unsupported
combinations or environment setup. When the native runner already provides a
project/parameter matrix, prefer its configuration and use this workflow to
review and generate that native setup.
