# Playwright FieldKit — agent-guided install

You are an AI coding agent installing Playwright FieldKit into the project at
the current working directory. Follow these steps exactly. This procedure is
merge-aware: it never blindly overwrites files the project already owns, which
is why it is preferred over the script installers.

Source repository: `https://github.com/jpbaking/playwright-fieldkit`. If the
user named a fork or tag, substitute it below.

## 1. Survey before writing

1. Confirm you are at the target project's root.
2. Note whether these exist: `AGENTS.md`, `CLAUDE.md`, `.gitignore`, and
   Node.js 18+ (`node --version`) — the toolkit's scripts need it at runtime.
3. Check for a same-named `pw-playwright-fieldkit` skill under
   `.agents/skills/`, `.claude/skills/`, `.cline/skills/`, and the
   user-global equivalents, plus existing `.clinerules/workflows/pw-*.md`
   files. Report anything you find.

## 2. Install the skill

Obtain the repository's `skills/shared/pw-playwright-fieldkit/` tree — clone
with `git clone --depth 1`, or download the tarball
(`https://codeload.github.com/jpbaking/playwright-fieldkit/tar.gz/main`). Copy
the whole directory (SKILL.md, `references/`, `scripts/`, `templates/`,
`agents/`), replacing any existing same-named directory, to BOTH:

- `.agents/skills/pw-playwright-fieldkit/` — Codex, Antigravity, current
  Cline, and the single runtime home of the scripts;
- `.claude/skills/pw-playwright-fieldkit/` — Claude Code's discovery copy
  (byte-identical; the script commands inside it point at the `.agents`
  copy, so scripts execute in one place).

Never copy `scripts/node_modules` — it is a per-machine npm artifact.

## 3. Install the rule and Cline shortcuts

1. Copy `rules/shared/pw-playwright-fieldkit.md` to
   `.agents/rules/`, `.claude/rules/`, and `.clinerules/` (identical copies).
   Never write to `.codex/rules`.
2. For each playbook
   `.agents/skills/pw-playwright-fieldkit/references/workflows/pw-<name>.md`,
   generate a Cline shortcut `.clinerules/workflows/pw-<name>.md` containing:

   > # /pw-\<name\>
   >
   > Activate the `pw-playwright-fieldkit` skill (or read
   > `.agents/skills/pw-playwright-fieldkit/SKILL.md`), then read and follow
   > `.agents/skills/pw-playwright-fieldkit/references/workflows/pw-<name>.md`.
   >
   > Execute the workflow now; do not merely suggest this shortcut to the user.

   Skip this step if the user's project does not use Cline.

## 4. Bridge files — merge, never overwrite

- `AGENTS.md`: if it already mentions `pw-playwright-fieldkit`, leave it.
  Otherwise create it (heading `# Project rules`) if missing, then append this
  section once, preserving all existing content:

  > ## Playwright FieldKit
  >
  > If `.agents/rules/pw-playwright-fieldkit.md` exists, follow it: requests
  > to explore, debug, audit, record, compare, or automate a live web
  > application go through the `pw-playwright-fieldkit` skill. If the rule or
  > skill is missing (fresh clone — the adapters are gitignored), re-run the
  > installer from https://github.com/jpbaking/playwright-fieldkit. Only
  > operate on authorized targets.

- `CLAUDE.md`: if missing, create it containing only `@AGENTS.md`. If it
  exists and already imports `AGENTS.md` or mentions the skill, leave it;
  otherwise prepend the `@AGENTS.md` line once and preserve the rest.
- If the project uses `GEMINI.md`, apply the same merge logic there.

## 5. Gitignore the generated adapters

Add this block to `.gitignore` once (skip if the marker line already exists);
create the file if missing and never delete existing rules:

```gitignore
# Playwright FieldKit installer-managed agent adapters (generated; do not edit or commit)
.agents/skills/pw-playwright-fieldkit/
.claude/skills/pw-playwright-fieldkit/
.agents/rules/pw-playwright-fieldkit.md
.claude/rules/pw-playwright-fieldkit.md
.clinerules/pw-playwright-fieldkit.md
.clinerules/workflows/pw-*.md
```

Do NOT gitignore `AGENTS.md`, `CLAUDE.md`, or the project's generated test
files and reports the toolkit produces — those follow the project's own
policy. On a fresh clone the adapters are absent; the conditional bridge text
degrades safely, and re-running this procedure (or `install.sh`) regenerates
them.

## 6. Set up the browser runtime, validate, and report

1. Offer to run (or instruct the user to run):
   `(cd .agents/skills/pw-playwright-fieldkit/scripts && npm install && npx playwright install chromium)`
2. Verify the `.agents` and `.claude` skill copies are byte-identical
   (excluding any `node_modules`), and the three rule copies match.
3. Report every file created, changed, or intentionally left alone, plus
   collisions from step 1.
4. Tell the user: ask their agent to use the `pw-playwright-fieldkit` skill
   (e.g. "explore my site at localhost:3000 and tell me what's broken");
   Cline/Claude also expose `/pw-*` shortcuts, Codex uses a `$` skill
   mention. Remind them the toolkit only operates on authorized targets.
