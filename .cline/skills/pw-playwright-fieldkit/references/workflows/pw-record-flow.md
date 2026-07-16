# /pw-record-flow — learn a journey from a user's browser demonstration

Goal: open a visible Playwright recorder, let the user demonstrate a real
journey, then turn the recording into a reviewed, project-native test or flow.

## Step 1 — Inspect the project and choose a draft format

Inspect the existing E2E suite exactly as in `pw-generate-tests.md`: determine its
language, runner, sync/async style, test directory, fixtures, authentication,
and nearby naming conventions. Use a draft under `report/recording/`, not a
permanent test path, until the recording has been reviewed.

- Python pytest: use a `.py` output; the recorder defaults to `python-pytest`.
- Async Python: use `.py --target python-async` and adapt the result to the
  project's async fixtures.
- `@playwright/test`: use `.spec.ts` or `.spec.js`; the recorder defaults to
  `playwright-test`.
- If the convention is absent or ambiguous, ask the user before launching.

## Step 2 — Confirm safety and authentication

Confirm the start URL is authorized and that the demonstrated interactions are
safe in that environment. The initial URL passes through the authorization
scope guard, but Codegen cannot enforce the allowlist after the user takes
control; tell the user to remain within the authorized target.

The demonstration performs real actions. Do not record destructive
purchase/delete/send operations against production. Prefer `--load-storage`
with a locally saved auth state over typing a real password, because Codegen can
write filled values into the generated source. Treat recorded source, storage
state, and optional HAR files as sensitive until reviewed.

## Step 3 — Launch and wait for the user

Before launching, tell the user:

1. a browser and Playwright Inspector will open;
2. they should demonstrate the journey in the browser;
3. they can add visibility, text, and value assertions from Inspector;
4. they should close the browser/Inspector when finished.

Then run the recorder and keep the terminal process attached:

```bash
# Python pytest example
node .cline/skills/pw-playwright-fieldkit/scripts/record.mjs <URL> \
  --output report/recording/test_recorded.py

# Existing authenticated @playwright/test example
node .cline/skills/pw-playwright-fieldkit/scripts/record.mjs <URL> \
  --output report/recording/recorded.spec.ts \
  --load-storage auth.json
```

Do not continue to analysis while the recorder is still active. If no graphical
display is available, stop and explain that local desktop access, display
forwarding, or VNC is required.

## Step 4 — Review before integrating

After Codegen exits, inspect the draft immediately:

- remove or replace passwords, tokens, personal data, and environment-specific
  values with the project's secret/test-data mechanism;
- identify what the user intended at each meaningful step;
- replace fragile selectors only when the project has a clearer stable pattern;
- add missing outcome assertions—recorded actions alone do not express intent;
- reuse the project's fixtures, page objects, storage state, markers, and setup;
- remove accidental navigation or actions unrelated to the demonstrated goal.

If the intended outcome is not evident from recorded assertions, ask the user
what should prove success before writing the permanent test.

## Step 5 — Persist what was learned and verify it

Capture the user's intent, risk, preconditions, outcomes, negative cases, data,
cleanup, and meaningful variants with the `pw-create-test-charter` workflow. Then
move/refactor the reviewed draft into the project's normal E2E location and run
it with the repository's own command. Report the charter, final test file, and
verification result. Delete the unreviewed draft after successful integration
unless the user wants it retained.

When useful, also translate the journey into this toolkit's `flow.json` format
and execute it with `flow.mjs`; this gives the agent a small reusable artifact
for future debugging and regeneration. The recording and resulting artifacts
are the durable learning—the model itself is not retrained.
