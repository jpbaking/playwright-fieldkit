# /generate-negative-tests — turn risks into deterministic failure paths

Read the journey charter and actual network evidence. Select negative cases that
protect a stated risk: validation, unauthorized access, conflict/double-submit,
slow/unavailable dependencies, or recoverable server failures. Do not invent
responses that the product contract cannot produce.

Use real staging behavior when safe. For deterministic client recovery paths,
add `mockResponse` or `mockAbort` before navigation in a flow:

```json
[
  { "mockResponse": "**/api/pricing", "status": 503,
    "body": { "error": "temporarily unavailable" } },
  { "goto": "/checkout" },
  { "expectText": "Pricing is temporarily unavailable" },
  { "expectVisible": "[data-testid=retry-pricing]" }
]
```

See `.cline/skills/playwright-fieldkit/templates/negative-flow.example.json`.
Run the flow and generate a project-language test only after it passes. Assert
both the visible failure handling and protected invariants (no charge, no lost
input, unchanged total). Avoid mocking the happy path so heavily that the test
no longer exercises meaningful integration.
