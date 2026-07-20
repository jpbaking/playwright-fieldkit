# Feature Specification to Test Cases

For workflow selection, return to the [User Guide](../user-guide.md).

Use this guide when the starting document describes a feature, requirements, or
acceptance criteria but does not yet provide executable test cases.

This workflow set ends with approved test cases. It does not open a browser or
generate permanent automation.

## Recognize the input

A **feature specification** usually describes users, rules, constraints, and
desired behavior. It may say:

> Eligible returning customers can apply one active coupon to a cart.

A **test case** adds the information needed to execute that rule:

- a case ID and purpose;
- requirement links;
- persona or role;
- preconditions and test data;
- ordered actions;
- observable expected results;
- cleanup and priority.

If the source already contains those details, use the
[Test Case Execution guide](execution.md) instead.

## Workflow 1: design cases from the specification

Ask `/pw-design-test-cases` and provide the specification path or pasted text.
The agent reads it as the source of truth and separates:

- documented requirements;
- assumptions needed to draft cases;
- open questions that could change expected behavior.

The agent must not use the application's current behavior to fill a missing
business rule. It preserves existing requirement IDs or assigns stable local
IDs, then records the source section or page for each requirement.

An undefined expected result remains visibly unresolved in the draft and is
recorded as an open question. It must be resolved from an authoritative source
before approval.

Example request:

> Design test cases from `docs/features/coupons.md`. Trace every case to a
> requirement, identify open questions, and do not execute the application.

### Select cases by risk

Consider these categories only where the specification or product risk supports
them:

| Category | Question |
|---|---|
| Positive | Does the intended successful behavior work? |
| Negative | Is invalid or denied behavior handled safely? |
| Boundary | What happens at documented limits? |
| Permission | Can only the intended roles perform the action? |
| Recovery | Does the product recover safely from a dependency failure? |
| Accessibility | Can users perceive and operate important states? |
| Compatibility | Is there a documented browser, device, locale, or timezone risk? |

Do not create every combination automatically. Each case should protect a
stated requirement or risk and have one understandable failure cause.

### Generated design artifacts

The workflow creates:

- `report/test-cases/test-cases-source.json` — editable source;
- `report/test-cases/test-cases.json` — normalized data;
- `report/test-cases/test-cases.md` — readable cases and traceability matrix.

The validator checks unique IDs, known requirement links, actions and expected
results, destructive cleanup, coverage warnings, and review status:

```bash
node ~/.agents/skills/pw-playwright-fieldkit/scripts/test-cases.mjs \
  report/test-cases/test-cases-source.json --out report/test-cases
```

Draft cases remain `draft`; design does not approve its own output.

## Workflow 2: review and approve the cases

Ask `/pw-review-test-cases`. The agent reads both the original feature
specification and the test cases. It reviews:

- requirement traceability and meaningful coverage;
- fidelity of expected results to the specification;
- clarity of setup, data, actions, and outcomes;
- risk coverage without unnecessary combinations;
- safety, ownership, isolation, and cleanup;
- automation feasibility and honest manual-only labeling;
- duplication, independence, and maintainability.

Findings are classified as blocking changes, non-blocking improvements, or
accepted assumptions. A requirement ID alone does not prove coverage; the case
must actually exercise the rule.

The agent asks for an explicit decision:

> Do you approve these test cases as the executable interpretation of this
> feature specification? Reply **approve**, **request changes**, or **not yet**.

Only the user can provide approval. Approval is bound to the exact content: the
validator reports a `contentHash`, and the approved artifact records it as
`review.approvedHash`. Editing an approved case set invalidates the approval
until it is re-reviewed. Approved artifacts require a reviewer, the matching
hash, and no open questions:

```bash
node ~/.agents/skills/pw-playwright-fieldkit/scripts/test-cases.mjs \
  report/test-cases/test-cases-source.json --out report/test-cases \
  --require-approved
```

## Optional: create a journey charter

Use `/pw-create-test-charter` when one high-risk user journey needs additional
intent, business risk, data lifecycle, variants, and automation links kept
together. A charter complements the requirement traceability matrix; it does not
replace test-case approval.

## Handoff

After approval, select one or more case IDs and continue to the
[Test Case Execution and Evidence guide](execution.md). No browser
execution or permanent test generation belongs in this workflow set.

## Design review checklist

- Is every expected result supported by the specification?
- Does every material requirement have justified coverage?
- Are assumptions and unanswered questions visible?
- Can another QE reproduce the setup and data?
- Does each case have one clear purpose?
- Are destructive cases paired with safe cleanup?
- Are manual-only checks labeled instead of forced into browser automation?
- Has a real reviewer explicitly approved the final set?
