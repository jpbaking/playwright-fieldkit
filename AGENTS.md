# Playwright FieldKit repository instructions

Follow the
[Portable Agent Authoring](https://github.com/jpbaking/portable-agent-authoring)
guides for every skill or harness change.

- Edit the portable skill only under
  `.agents/skills/pw-playwright-fieldkit/`.
- Regenerate `.claude/skills/pw-playwright-fieldkit/` byte-identically,
  excluding only machine-local `scripts/node_modules/`.
- Keep `.clinerules/workflows/pw-playwright-fieldkit.md` as a thin skill
  invocation shim; detailed procedures belong in `references/workflows/`.
- Keep the distributable intent rule in
  `rules/shared/pw-playwright-fieldkit.md` and preserve the authorized-target
  boundary.
- Run `npm test` from the authoritative skill's `scripts/` directory after
  changing scripts or workflow contracts.
