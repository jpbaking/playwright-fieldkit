# /pw-plan-test-data — make setup, parallelism, and cleanup reliable

Inspect existing API clients, factories, fixtures, worker isolation, accounts,
and cleanup conventions before adding anything. Prefer API/factory setup over
unrelated UI setup; keep the UI interactions that are actually under test.

For each journey, document in its charter:

- whether data is per test, run, worker, or shared read-only;
- how unique IDs/emails/idempotency keys are created;
- which role/account owns the data;
- what cleanup runs after partial failures;
- whether cleanup is safe to repeat;
- what can run concurrently without collisions.

Adapt the matching scaffold from
`~/.agents/skills/pw-playwright-fieldkit/templates/test-data-lifecycle.py` or
`test-data-lifecycle.ts`. Never invent real endpoints. Use the application's
existing API layer and secret management. Validate cleanup by forcing a test to
fail midway and confirming no durable data remains.
