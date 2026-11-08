# Playwright FieldKit repository instructions

Follow the
[Portable Agent Authoring](https://github.com/jpbaking/portable-agent-authoring)
guides — especially *Agent toolkit repositories* — for every skill or harness
change.

- Edit the portable skill only under
  `.agents/skills/pw-playwright-fieldkit/`. Detailed procedures belong in its
  `references/workflows/`; templates and examples in its `assets/`.
- Regenerate `.claude/skills/pw-playwright-fieldkit/` byte-identically,
  excluding only machine-local `scripts/node_modules/`; never edit it
  independently.
- No skill or script may fetch this repository's files over raw HTTP.
- Keep the distributable intent rule in
  `rules/shared/pw-playwright-fieldkit.md` and preserve the authorized-target
  boundary.
- Update `AGENT-INSTALL.md`, `README.md`, and `docs/setup/` whenever
  discovery, invocation, or installation changes.
- Run `npm test` from the authoritative skill's `scripts/` directory after
  changing scripts or workflow contracts.
- Dogfooding collision: with FieldKit installed globally, every harness also
  sees this repository's skill. Claude Code and Cline prefer the global copy
  (your edits seem to have no effect), Codex lists both, and Gemini CLI and
  OpenCode prefer the workspace copy. Test changes in a fresh session with the
  global copy temporarily removed or disabled.
