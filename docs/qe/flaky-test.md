# Flaky-Test Triage

For workflow selection, return to the [User Guide](../user-guide.md).

Use this guide when a test sometimes passes and sometimes fails without a
relevant product change. Flakiness reduces confidence in the whole suite and
must be investigated with evidence.

## Reproduce the narrowest case

Use `/pw-triage-flaky-test` with the smallest repository-native command that
runs the suspect test. Retain a trace for every repeated permanent-test run:

```bash
node ~/.agents/skills/pw-playwright-fieldkit/scripts/triage.mjs \
  --runs 8 --artifacts test-results --out report/triage -- \
  pytest tests/e2e/test_checkout.py -k coupon --tracing=on
```

The agent preserves each run's output and groups signals related to:

- an element used before it was ready;
- timing, animation, or missing waits for observable readiness;
- network or backend instability;
- accounts or records shared by parallel tests;
- browser or test infrastructure;
- a real product failure or incorrect assertion;
- an unknown cause requiring more evidence.

The classification is a lead, not a verdict.

## Compare passing and failing evidence

For mixed results, compare at least one passing and one failing trace. Look for
the first meaningful difference rather than only the final timeout or assertion.

Ask:

- Did both runs start with equivalent data and authentication?
- Was the target element visible but not ready?
- Did a request fail, slow down, or return different data?
- Did another worker modify the same account or record?
- Did the assertion assume ordering, timing, or text not guaranteed by the
  product contract?

## Fix the cause

Fix readiness, isolation, ownership, environment, assertion, or product
behavior. Arbitrary sleeps, much larger timeouts, retries, and quarantine can
hide the underlying cause and should not be the automatic answer.

Re-run enough times to exercise the original failure opportunity. Record the
root cause, fix, commands, run counts, and trace paths. If the evidence shows a
product defect, attach the relevant permanent-test trace to the developer issue.

## Triage checklist

- Is the reproduction command as narrow as possible?
- Does every repeated run retain separate artifacts and a trace?
- Were at least one pass and failure compared?
- Is the first divergent signal identified?
- Does the proposed fix address the cause rather than mask the symptom?
- Was the fix exercised repeatedly under the original conditions?
