# /create-test-charter — preserve QE intent before automating

Use after a recording or before test generation. Copy
`.cline/skills/playwright-fieldkit/templates/journey.example.json` to a working
file and fill it from the user's language and repository evidence.

Capture: intent, business risk, persona/role, preconditions, observable outcomes,
negative/boundary cases, destructive behavior, unique/isolated test-data
strategy, idempotent cleanup, meaningful matrix variants, tags, and links to the
recording/flow/test. Ask only for missing facts that materially change the test.

Validate and render it:

```bash
node .cline/skills/playwright-fieldkit/scripts/charter.mjs journey.json --out report/journey
```

Do not automate a destructive charter without cleanup. Treat warnings as review
items, not proof of failure. Keep `journey.md` beside the test or in the team's
normal test-design location so future agents retain the QE reasoning.
