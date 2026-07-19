#!/bin/sh
# Playwright FieldKit universal installer/updater.
#
# Installs the portable pw-playwright-fieldkit Agent Skill, the always-on
# activation rule, and generated Cline workflow shortcuts for Codex,
# Claude Code, Google Antigravity, and Cline. Run from a project root:
#   curl -fsSL https://raw.githubusercontent.com/jpbaking/playwright-skills/main/install.sh | sh
#
# Prefer the agent-guided install (AGENT-INSTALL.md) when an AI agent is
# available — it merges with existing project files instead of colliding.
# FieldKit-owned adapters are replaced on update. Root AGENTS.md / CLAUDE.md
# files are appended to at most once, never overwritten. Override the source
# with PW_FIELDKIT_REPO (owner/repo), PW_FIELDKIT_REF (branch/tag), or
# PW_FIELDKIT_SOURCE (local checkout).

set -eu

REPO="${PW_FIELDKIT_REPO:-jpbaking/playwright-skills}"
REF="${PW_FIELDKIT_REF:-main}"
SKILL="pw-playwright-fieldkit"
STAGING=""

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
cleanup() { [ -z "$STAGING" ] || rm -rf "$STAGING"; }
trap cleanup EXIT HUP INT TERM

has_text() {
  [ -f "$1" ] && grep -F "$2" "$1" >/dev/null 2>&1
}

# Resolve the canonical source tree: local checkout or one GitHub tarball.
if [ -n "${PW_FIELDKIT_SOURCE:-}" ]; then
  [ -d "$PW_FIELDKIT_SOURCE/skills/shared/$SKILL" ] || die "PW_FIELDKIT_SOURCE has no skills/shared/$SKILL directory."
  SRC="$PW_FIELDKIT_SOURCE"
  echo "Playwright FieldKit install from local source $SRC"
else
  STAGING="$(mktemp -d "${TMPDIR:-/tmp}/pw-fieldkit-install.XXXXXX")"
  url="https://codeload.github.com/$REPO/tar.gz/$REF"
  echo "Playwright FieldKit install from $REPO@$REF"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$STAGING/src.tar.gz"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$STAGING/src.tar.gz"
  else
    die "need curl or wget"
  fi
  mkdir "$STAGING/x"
  tar -xzf "$STAGING/src.tar.gz" -C "$STAGING/x"
  set -- "$STAGING/x"/*
  [ "$#" -eq 1 ] && [ -d "$1" ] || die "unexpected archive layout"
  SRC="$1"
fi
echo "  into $(pwd)"

# Skill: .agents/skills is shared by Codex, Antigravity, and current Cline,
# and is the single runtime home of the scripts. Claude Code gets its own
# byte-identical copy for skill discovery; script commands inside it still
# point at the .agents copy. node_modules (a per-machine npm artifact) is
# never copied.
for root in .agents .claude; do
  mkdir -p "$root/skills"
  rm -rf "$root/skills/$SKILL"
  cp -R "$SRC/skills/shared/$SKILL" "$root/skills/$SKILL"
  rm -rf "$root/skills/$SKILL/scripts/node_modules"
  echo "  + $root/skills/$SKILL/"
done

# Rule: same body, one copy per host discovery directory.
mkdir -p .agents/rules .claude/rules .clinerules
cp "$SRC/rules/shared/$SKILL.md" ".agents/rules/$SKILL.md"
cp "$SRC/rules/shared/$SKILL.md" ".claude/rules/$SKILL.md"
cp "$SRC/rules/shared/$SKILL.md" ".clinerules/$SKILL.md"
echo "  + rule in .agents/rules/, .claude/rules/, .clinerules/"

# Cline slash-command shortcuts: generated thin stubs, one per canonical
# workflow playbook bundled in the skill.
mkdir -p .clinerules/workflows
for wf in ".agents/skills/$SKILL/references/workflows"/pw-*.md; do
  name="$(basename "$wf" .md)"
  cat > ".clinerules/workflows/$name.md" <<EOF
# /$name

Activate the \`$SKILL\` skill (or read
\`.agents/skills/$SKILL/SKILL.md\`), then read and follow
\`.agents/skills/$SKILL/references/workflows/$name.md\`.

Execute the workflow now; do not merely suggest this shortcut to the user.
EOF
done
echo "  + .clinerules/workflows/pw-*.md (generated shortcuts)"

# Bridge pointers: append once, conditional wording so a fresh clone (where
# the gitignored adapters are absent) still degrades safely.
if ! has_text "AGENTS.md" "$SKILL"; then
  [ -f AGENTS.md ] || printf '# Project rules\n' > AGENTS.md
  cat >> AGENTS.md <<'EOF'

## Playwright FieldKit

If `.agents/rules/pw-playwright-fieldkit.md` exists, follow it: requests to
explore, debug, audit, record, compare, or automate a live web application go
through the `pw-playwright-fieldkit` skill. If the rule or skill is missing
(fresh clone — the adapters are gitignored), re-run the installer from
https://github.com/jpbaking/playwright-skills. Only operate on authorized
targets.
EOF
  echo "  + AGENTS.md (appended Playwright FieldKit pointer)"
else
  echo "  = kept existing AGENTS.md (already mentions $SKILL)"
fi

if [ ! -f CLAUDE.md ]; then
  printf '@AGENTS.md\n' > CLAUDE.md
  echo "  + CLAUDE.md (@AGENTS.md import)"
elif ! has_text "CLAUDE.md" "AGENTS.md" && ! has_text "CLAUDE.md" "$SKILL"; then
  echo "  ! kept existing CLAUDE.md; add @AGENTS.md or a FieldKit pointer yourself"
else
  echo "  = kept existing CLAUDE.md"
fi

# Generated adapters stay out of the target's git history; the root bridges
# above remain committable.
GI_MARK="# Playwright FieldKit installer-managed agent adapters (generated; do not edit or commit)"
if has_text ".gitignore" "$GI_MARK"; then
  echo "  = kept existing .gitignore Playwright FieldKit block"
else
  if [ -s .gitignore ]; then printf '\n' >> .gitignore; fi
  {
    printf '%s\n' "$GI_MARK"
    printf '.agents/skills/%s/\n.claude/skills/%s/\n' "$SKILL" "$SKILL"
    printf '.agents/rules/%s.md\n.claude/rules/%s.md\n.clinerules/%s.md\n' "$SKILL" "$SKILL" "$SKILL"
    printf '.clinerules/workflows/pw-*.md\n'
  } >> .gitignore
  echo "  + .gitignore (adapter entries; AGENTS.md / CLAUDE.md stay tracked)"
fi

echo "Done."
echo "Next: (cd .agents/skills/$SKILL/scripts && npm install && npx playwright install chromium)"
echo "Then ask your agent to use the $SKILL skill (e.g. \"explore my site at localhost:3000\")."
