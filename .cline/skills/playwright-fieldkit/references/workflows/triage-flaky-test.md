# /triage-flaky-test — reproduce and classify intermittent failures

Identify the narrowest repository-native command for the suspect test and its
artifact directory. Ensure the runner records a trace on failure/retry when
supported. Then repeat without hiding failures:

```bash
node .cline/skills/playwright-fieldkit/scripts/triage.mjs \
  --runs 8 --artifacts test-results --out report/triage -- \
  pytest tests/e2e/test_checkout.py -k coupon
```

Use a command array after `--`; no shell pipeline is interpreted. Read
`triage.md`, failing logs, traces, screenshots, and network/console evidence.
The classifier distinguishes locator/readiness, timing, network/backend, shared
data, browser/infrastructure, product/assertion, and unknown signals, but it is a
lead rather than a verdict.

Compare at least one pass and failure for a flaky result. Fix readiness,
ownership, isolation, or product behavior; do not automatically add sleeps,
timeouts, retries, or quarantine. Re-run enough times to demonstrate the fix and
record the root cause in the test/defect.
