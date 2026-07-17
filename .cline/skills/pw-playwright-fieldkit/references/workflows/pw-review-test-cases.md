# /pw-review-test-cases — review and approve specification-derived cases

Goal: independently check test cases against their feature specification and
create an explicit approval gate before execution or automation.

## Step 1 — Validate and read both artifacts

Read the feature specification and the test-case source completely; do not
review only the rendered summary. Run:

```bash
node .cline/skills/pw-playwright-fieldkit/scripts/test-cases.mjs \
  report/test-cases/test-cases-source.json --out report/test-cases
```

Stop and correct structural errors before judging coverage. Treat the feature
specification as the source of requirements and expected behavior.

## Step 2 — Review test-design quality

Check and report:

- **Traceability:** every case cites known requirements and every material
  requirement has justified coverage.
- **Fidelity:** expected results come from the specification, not from guesses
  or current application behavior.
- **Clarity:** preconditions, data, actions, and results are unambiguous and
  observable.
- **Risk coverage:** important positive, negative, boundary, permission,
  recovery, accessibility, or compatibility risks are addressed where relevant.
- **Safety:** destructive effects, ownership, isolation, and cleanup are explicit.
- **Feasibility:** automation candidates are browser-observable and manual-only
  cases are labeled honestly.
- **Maintainability:** cases have one purpose, avoid duplicates, and do not
  create a wasteful combinatorial matrix.

Classify findings as blocking changes, non-blocking improvements, or accepted
assumptions. Do not mark a requirement covered merely because a case links its
ID; confirm that the actions and expected results actually exercise it.

## Step 3 — Prepare the approval decision

Apply agreed non-controversial corrections while preserving the original source
references. Set `review.status` to `ready-for-approval` only when no blocking
finding remains. Keep disputed items in `openQuestions` or review notes.

Re-run the validator after the final edits and note the `contentHash` it
reports: approval is bound to that exact content, and any later edit
invalidates it.

Present the requirement coverage, case counts by type/priority, manual-only
cases, open questions, and changes made. Then ask:

> Do you approve these test cases as the executable interpretation of
> `<feature-spec>`? Reply **approve**, **request changes**, or **not yet**.

The agent may recommend approval but must not supply the user's decision.

## Step 4 — Record and validate the decision

- **Approve:** first remove or resolve all open questions, re-run the validator,
  and note the `contentHash` of that final content. Then set `review.status` to
  `approved`, record the reviewer identity supplied by the user, set
  `review.approvedHash` to that hash (the hash covers everything except the
  `review` block, so recording the approval does not change it), and validate
  with:

  ```bash
  node .cline/skills/pw-playwright-fieldkit/scripts/test-cases.mjs \
    report/test-cases/test-cases-source.json --out report/test-cases \
    --require-approved
  ```

- **Request changes:** set the status to `changes-requested`, record the requested
  changes, revise, and repeat review.
- **Not yet:** retain `ready-for-approval` or `draft` and state what is unresolved.

Do not execute or automate cases in this workflow. After approval, offer
`pw-execute-test-case.md` for one or more explicitly selected case IDs. That later
workflow owns browser execution, trace review, confirmation, and the handoff to
permanent test generation.
