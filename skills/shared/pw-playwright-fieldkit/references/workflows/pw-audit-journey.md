# /pw-audit-journey — check accessibility at meaningful UI states

Identify interactive states from a recording/charter: open menus and dialogs,
validation errors, empty/loading/error states, and post-submit confirmation.
Place an `auditA11y` step after the flow reaches each state:

```json
[
  { "click": "[data-testid=open-dialog]" },
  { "expectVisible": "[role=dialog]" },
  { "auditA11y": "open settings dialog" }
]
```

The step deterministically checks language, main/h1 structure, form labels, and
names for buttons, links, and dialogs. It fails the flow and is emitted into
generated Python/Node tests. `allow` may list finding codes only for a documented
known issue; do not use it to make an unexplained audit pass.

These lightweight checks do not prove WCAG conformance. If the project already
uses axe, integrate a state-specific axe scan in its native fixtures and retain
manual keyboard/screen-reader assessment in the charter.
