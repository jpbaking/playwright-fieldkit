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
   `.agents/skills/`, `.claude/skills/`, `.cline/skills/`,
   `.clinerules/skills/`, and `.pi/skills/`, plus legacy
   project-level `.clinerules/workflows/pw-*.md` files. Report anything you
   find; a project-level copy can shadow or duplicate the global install.
3. Check for this toolkit's legacy rule copies under
   `~/.gemini/config/rules/` and the Cline Rules directories, plus old global
   Cline `pw-*` workflow files. Confirm which of Antigravity CLI, Codex,
   Claude Code, Cline, and Pi the user wants. Do not infer consent from
   detected configuration directories.

## 3. Install the skill

Copy the whole `.agents/skills/pw-playwright-fieldkit/` directory (SKILL.md,
`references/`, `scripts/`, `templates/`, `agents/`), replacing any existing
same-named directory, to:

- `~/.agents/skills/pw-playwright-fieldkit/` — **always** (Codex discovery
  and the single scripts runtime), preserving an existing
  `scripts/node_modules/` there if present (it is a per-machine npm
  artifact; never copy one from staging);

and, for each additional harness the user selects,
a byte-identical copy **without** `scripts/node_modules`:

| Harness | Destination |
| --- | --- |
| Antigravity CLI (`agy`) | `~/.gemini/antigravity-cli/skills/pw-playwright-fieldkit/` |
| Claude Code | `~/.claude/skills/pw-playwright-fieldkit/` |
| Cline | `~/.cline/skills/pw-playwright-fieldkit/` |
| Pi | no additional copy; uses `~/.agents/skills/pw-playwright-fieldkit/` |

Codex also uses the always-installed `~/.agents/skills/` copy.

The SKILL.md instructs agents to run all scripts from the
`~/.agents/skills/...` runtime home regardless of which copy was
discovered, so the extra copies never need their own dependencies.

## 4. Install the rule

The rule is an intent router; it triggers on live-website work, not on
project state, and is safe to load globally.

1. Copy `rules/shared/pw-playwright-fieldkit.md` to
   `~/.agents/rules/pw-playwright-fieldkit.md`.
2. For each selected harness, merge the marker-guarded block below into its
   user-owned global instruction file:

   | Harness | Instruction file |
   | --- | --- |
   | Antigravity CLI (`agy`) | `~/.gemini/GEMINI.md` |
   | Codex | `~/.codex/AGENTS.md` |
   | Claude Code | `~/.claude/CLAUDE.md` |
   | Cline | `~/.agents/AGENTS.md` |
   | Pi | `~/.pi/agent/AGENTS.md` |

   If the marker exists, replace that block with the current text. Otherwise
   append it once. Create a missing file, but never overwrite, reorder, or
   delete unrelated content.

   ```markdown
   <!-- playwright-fieldkit:global-rule -->
   For requests to explore, debug, audit, record, compare, or test a live
   web application, read and follow
   `~/.agents/rules/pw-playwright-fieldkit.md` (it routes into the
   `pw-playwright-fieldkit` skill). Only operate on authorized targets.
   <!-- /playwright-fieldkit:global-rule -->
   ```

Never write to `~/.codex/rules` or any `.codex/rules` — that path holds
command-execution policy, not guidance.

Do not install global Cline `pw-*` workflow files: Cline's native skill
command and implicit activation already route through the skill, while the
portable guide only standardizes project workflow shims. Report old global
workflow or same-tool rule files and ask before removing them.

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
   Codex uses its `$` selector; Antigravity CLI and Claude Code use
   `/pw-playwright-fieldkit`; Cline also has the project shim
   `/pw-playwright-fieldkit.md`; Pi uses
   `/skill:pw-playwright-fieldkit` when enabled. Remind them the toolkit only
   operates on authorized targets.

## Project-level adapter install (opt-in only)

Only on explicit user request: copy the skill directory to the project's
`.agents/skills/` and mirror it byte-identically to `.claude/skills/`. Copy
`.clinerules/workflows/pw-playwright-fieldkit.md`, merge the rule body from
`rules/shared/pw-playwright-fieldkit.md` once into `AGENTS.md`, and ensure
`CLAUDE.md` imports `AGENTS.md` exactly once. Do not duplicate the rule in
host rule directories. Keep script execution pointed at the global
`~/.agents/skills/...` runtime home.

Commit the root files, both skill trees, and Cline shim together. Never touch
the project's `.gitignore`; report an exact ignore pattern if it hides an
adapter.
