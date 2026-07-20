# Playwright FieldKit — agent-guided install

You are an AI coding agent installing Playwright FieldKit. Follow these
steps exactly. This procedure is merge-aware — it never blindly overwrites
files the user already owns — and it is the only install path; there are no
install scripts.

Playwright FieldKit is a **user-global** toolkit: the skill, its bundled
scripts, and the rule install once per user. Nothing is installed into
projects; reports and generated tests the scripts produce land in whatever
project the user runs them from, following that project's own policy.

The user-global skill root `~/.agents/skills/pw-playwright-fieldkit/` is the
**single scripts runtime**: it is always installed (whatever harnesses are
selected), and every other harness copy points its script commands there, so
`node_modules` and the Playwright browsers exist in exactly one place.

Source repository: `https://github.com/jpbaking/playwright-fieldkit`. If the
user named a fork or tag, substitute it below.

## 1. Acquire the sources

Obtain the sources in a temporary directory (never inside a project):

- `git clone --depth 1 https://github.com/jpbaking/playwright-fieldkit <tmp>/playwright-fieldkit`
  (add `--branch <tag>` for a pinned tag), or
- download and extract `https://github.com/jpbaking/playwright-fieldkit/archive/refs/heads/main.zip`
  (or the tarball `https://codeload.github.com/jpbaking/playwright-fieldkit/tar.gz/main`), or
- `gh repo clone jpbaking/playwright-fieldkit <tmp>/playwright-fieldkit`.

Copy from this staging directory below; delete it when done.

## 2. Survey before writing

1. Check Node.js 18+ is available (`node --version`) — the scripts need it
   at runtime. Report if missing; the install can proceed but the scripts
   will not run.
2. Check for a same-named `pw-playwright-fieldkit` skill in the global
   directories listed below and, if inside a project, under its
   `.agents/skills/`, `.claude/skills/`, `.cline/skills/`, plus legacy
   project-level `.clinerules/workflows/pw-*.md` files. Report anything you
   find; a project-level copy can shadow or duplicate the global install.

## 3. Install the skill

Copy the whole `skills/shared/pw-playwright-fieldkit/` directory (SKILL.md,
`references/`, `scripts/`, `templates/`, `agents/`), replacing any existing
same-named directory, to:

- `~/.agents/skills/pw-playwright-fieldkit/` — **always** (Codex discovery
  and the single scripts runtime), preserving an existing
  `scripts/node_modules/` there if present (it is a per-machine npm
  artifact; never copy one from staging);

and, for each additional harness the user selects (all is a safe default),
a byte-identical copy **without** `scripts/node_modules`:

| Harness | Destination |
| --- | --- |
| Claude Code | `~/.claude/skills/pw-playwright-fieldkit/` |
| Antigravity | `~/.gemini/config/skills/pw-playwright-fieldkit/` |
| Cline | `~/.cline/skills/pw-playwright-fieldkit/` |

Cursor needs **no separate copy**: it natively discovers `~/.agents/skills/`
(and `~/.claude/skills/` / `~/.codex/skills/` as compatibility paths). Do
not install to `~/.cursor/skills/` — that would create a duplicate.

The SKILL.md instructs agents to run all scripts from the
`~/.agents/skills/...` runtime home regardless of which copy was
discovered, so the extra copies never need their own dependencies.

## 4. Install the rule and Cline workflow shortcuts

The rule is an intent router; it triggers on live-website work, not on
project state, and is safe to load globally.

1. Copy `rules/shared/pw-playwright-fieldkit.md` to
   `~/.agents/rules/pw-playwright-fieldkit.md` and
   `~/.gemini/config/rules/pw-playwright-fieldkit.md`.
2. Cline: copy it to `~/Cline/Rules/pw-playwright-fieldkit.md` on Linux, or
   `~/Documents/Cline/Rules/pw-playwright-fieldkit.md` on macOS/Windows (if
   both exist, use the populated one).
3. Codex and Claude Code: append this marker-guarded block once (skip if the
   marker is present) to both `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`
   (create either if missing; merge, never overwrite):

   ```markdown
   <!-- playwright-fieldkit:global-rule -->
   For requests to explore, debug, audit, record, compare, or test a live
   web application, read and follow
   `~/.agents/rules/pw-playwright-fieldkit.md` (it routes into the
   `pw-playwright-fieldkit` skill). Only operate on authorized targets.
   <!-- /playwright-fieldkit:global-rule -->
   ```

4. If Cline is selected, generate a global workflow stub for each playbook
   `~/.agents/skills/pw-playwright-fieldkit/references/workflows/pw-<name>.md`
   at `~/Cline/Workflows/pw-<name>.md` (Linux; `~/Documents/Cline/Workflows/`
   on macOS/Windows) containing:

   > # /pw-\<name\>
   >
   > Activate the `pw-playwright-fieldkit` skill (or read
   > `~/.agents/skills/pw-playwright-fieldkit/SKILL.md`), then read and follow
   > `~/.agents/skills/pw-playwright-fieldkit/references/workflows/pw-<name>.md`.
   >
   > Execute the workflow now; do not merely suggest this shortcut to the user.

Cursor has no file-based global rules (User Rules are app settings). If
the user works in Cursor, print the pointer block above and ask them to
paste it into Cursor Settings → Rules once.

Never write to `~/.codex/rules` or any `.codex/rules` — that path holds
command-execution policy, not guidance.

## 5. Set up the browser runtime, validate, and report

1. Offer to run (or instruct the user to run):
   `(cd ~/.agents/skills/pw-playwright-fieldkit/scripts && npm install && npx playwright install chromium)`
2. Verify all harness skill copies are byte-identical to the canonical
   source (excluding any `node_modules`), and the rule copies match.
3. Remove the temporary staging directory.
4. Report every file created, changed, or intentionally left alone, plus
   collisions from step 2 (suggest deleting legacy gitignored project-level
   adapters or `.clinerules/workflows/pw-*.md` stubs only with user
   approval). Note the install is per-user and per-machine.
5. Tell the user: ask their agent to use the `pw-playwright-fieldkit` skill
   (e.g. "explore my site at localhost:3000 and tell me what's broken");
   Cline/Claude also expose `/pw-*` shortcuts, Codex uses a `$` skill
   mention. Remind them the toolkit only operates on authorized targets.

## Project-level adapter install (opt-in only)

Only on explicit user request: copy the skill directory to the project's
`.agents/skills/` and `.claude/skills/` and the rule to `.agents/rules/`,
`.claude/rules/`, and `.clinerules/`. Even then, keep script execution
pointed at the global `~/.agents/skills/...` runtime home. Whether the
team commits or gitignores the adapters is the project's own policy — never
touch the project's `.gitignore` yourself; if existing ignore rules hide the
adapters from a harness, report the exact pattern instead of changing it.
