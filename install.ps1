# Playwright FieldKit universal installer/updater (PowerShell 5.1+).
#
# Installs the portable pw-playwright-fieldkit Agent Skill, the always-on
# activation rule, and generated Cline workflow shortcuts for Codex,
# Claude Code, Google Antigravity, and Cline. Run from a project root:
#   irm https://raw.githubusercontent.com/jpbaking/playwright-fieldkit/main/install.ps1 | iex
#
# Prefer the agent-guided install (AGENT-INSTALL.md) when an AI agent is
# available. Override the source with $env:PW_FIELDKIT_REPO,
# $env:PW_FIELDKIT_REF, or $env:PW_FIELDKIT_SOURCE (local checkout).

$ErrorActionPreference = "Stop"

$Repo = if ($env:PW_FIELDKIT_REPO) { $env:PW_FIELDKIT_REPO } else { "jpbaking/playwright-fieldkit" }
$Ref  = if ($env:PW_FIELDKIT_REF)  { $env:PW_FIELDKIT_REF }  else { "main" }
$Skill = "pw-playwright-fieldkit"
$Staging = $null

function Has-Text {
    param([string]$Path, [string]$Text)
    return (Test-Path $Path -PathType Leaf) -and [bool](Select-String -Path $Path -SimpleMatch $Text -Quiet)
}

try {
    if ($env:PW_FIELDKIT_SOURCE) {
        if (-not (Test-Path (Join-Path $env:PW_FIELDKIT_SOURCE "skills/shared/$Skill") -PathType Container)) {
            throw "PW_FIELDKIT_SOURCE has no skills/shared/$Skill directory."
        }
        $Src = $env:PW_FIELDKIT_SOURCE
        Write-Host "Playwright FieldKit install from local source $Src"
    } else {
        $Staging = Join-Path ([System.IO.Path]::GetTempPath()) ("pw-fieldkit-install-" + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $Staging -Force | Out-Null
        $Zip = Join-Path $Staging "src.zip"
        Write-Host "Playwright FieldKit install from $Repo@$Ref"
        Invoke-WebRequest -Uri "https://api.github.com/repos/$Repo/zipball/$([Uri]::EscapeDataString($Ref))" -OutFile $Zip -UseBasicParsing
        Expand-Archive -Path $Zip -DestinationPath (Join-Path $Staging "x")
        $Top = @(Get-ChildItem (Join-Path $Staging "x") -Directory)
        if ($Top.Count -ne 1) { throw "unexpected archive layout" }
        $Src = $Top[0].FullName
    }
    Write-Host "  into $(Get-Location)"

    # Skill: .agents/skills is the shared location and the runtime home of
    # the scripts; Claude Code gets a byte-identical discovery copy.
    foreach ($root in ".agents", ".claude") {
        $Dest = Join-Path "$root\skills" $Skill
        New-Item -ItemType Directory -Path "$root\skills" -Force | Out-Null
        if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
        Copy-Item (Join-Path $Src "skills/shared/$Skill") $Dest -Recurse
        $NodeModules = Join-Path $Dest "scripts\node_modules"
        if (Test-Path $NodeModules) { Remove-Item $NodeModules -Recurse -Force }
        Write-Host "  + $Dest\"
    }

    # Rule: same body, one copy per host discovery directory.
    New-Item -ItemType Directory -Force -Path ".agents\rules", ".claude\rules", ".clinerules", ".clinerules\workflows" | Out-Null
    foreach ($ruleFile in ".agents\rules\$Skill.md", ".claude\rules\$Skill.md", ".clinerules\$Skill.md") {
        Copy-Item (Join-Path $Src "rules/shared/$Skill.md") $ruleFile -Force
    }
    Write-Host "  + rule in .agents\rules\, .claude\rules\, .clinerules\"

    # Cline slash-command shortcuts: generated thin stubs.
    Get-ChildItem ".agents\skills\$Skill\references\workflows" -Filter "pw-*.md" | ForEach-Object {
        $name = $_.BaseName
        $stub = @"
# /$name

Activate the ``$Skill`` skill (or read
``.agents/skills/$Skill/SKILL.md``), then read and follow
``.agents/skills/$Skill/references/workflows/$name.md``.

Execute the workflow now; do not merely suggest this shortcut to the user.
"@
        Set-Content -Path ".clinerules\workflows\$name.md" -Value $stub
    }
    Write-Host "  + .clinerules\workflows\pw-*.md (generated shortcuts)"

    # Bridge pointers: append once, conditional wording so a fresh clone
    # (where the gitignored adapters are absent) still degrades safely.
    $Pointer = @"

## Playwright FieldKit

If ``.agents/rules/pw-playwright-fieldkit.md`` exists, follow it: requests to
explore, debug, audit, record, compare, or automate a live web application go
through the ``pw-playwright-fieldkit`` skill. If the rule or skill is missing
(fresh clone -- the adapters are gitignored), re-run the installer from
https://github.com/jpbaking/playwright-fieldkit. Only operate on authorized
targets.
"@
    if (-not (Has-Text "AGENTS.md" $Skill)) {
        if (-not (Test-Path "AGENTS.md")) { Set-Content -Path "AGENTS.md" -Value "# Project rules" }
        Add-Content -Path "AGENTS.md" -Value $Pointer
        Write-Host "  + AGENTS.md (appended Playwright FieldKit pointer)"
    } else {
        Write-Host "  = kept existing AGENTS.md (already mentions $Skill)"
    }
    if (-not (Test-Path "CLAUDE.md")) {
        Set-Content -Path "CLAUDE.md" -Value "@AGENTS.md"
        Write-Host "  + CLAUDE.md (@AGENTS.md import)"
    } elseif (-not (Has-Text "CLAUDE.md" "AGENTS.md") -and -not (Has-Text "CLAUDE.md" $Skill)) {
        Write-Host "  ! kept existing CLAUDE.md; add @AGENTS.md or a FieldKit pointer yourself"
    } else {
        Write-Host "  = kept existing CLAUDE.md"
    }

    # Generated adapters stay out of the target's git history.
    $GitignoreMark = "# Playwright FieldKit installer-managed agent adapters (generated; do not edit or commit)"
    if (Has-Text ".gitignore" $GitignoreMark) {
        Write-Host "  = kept existing .gitignore Playwright FieldKit block"
    } else {
        $entries = @(
            $GitignoreMark,
            ".agents/skills/$Skill/", ".claude/skills/$Skill/",
            ".agents/rules/$Skill.md", ".claude/rules/$Skill.md", ".clinerules/$Skill.md",
            ".clinerules/workflows/pw-*.md"
        )
        $block = ($entries -join "`n") + "`n"
        if ((Test-Path ".gitignore") -and (Get-Item ".gitignore").Length -gt 0) { $block = "`n" + $block }
        Add-Content -Path ".gitignore" -Value $block -NoNewline
        Write-Host "  + .gitignore (adapter entries; AGENTS.md / CLAUDE.md stay tracked)"
    }

    Write-Host "Done."
    Write-Host "Next: cd .agents\skills\$Skill\scripts; npm install; npx playwright install chromium"
    Write-Host "Then ask your agent to use the $Skill skill."
} finally {
    if ($Staging -and (Test-Path $Staging)) { Remove-Item $Staging -Recurse -Force }
}
