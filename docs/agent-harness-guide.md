# Using Playwright FieldKit with Other Agent Harnesses

Playwright FieldKit is packaged for Cline first, but its browser runtime,
templates, and workflow playbooks do not call Cline APIs. Any coding-agent
harness that can run shell commands and read workspace files can use it.

## What is portable

| Part | Purpose | Harness dependency |
|---|---|---|
| `.cline/skills/pw-playwright-fieldkit/scripts/` | Deterministic browser and QE commands | None; ordinary Node.js |
| `.cline/skills/pw-playwright-fieldkit/templates/` | Flows, charters, matrices, and test scaffolds | None |
| `.cline/skills/pw-playwright-fieldkit/references/workflows/` | Canonical operating playbooks | None; Markdown |
| `.cline/skills/pw-playwright-fieldkit/SKILL.md` | Intent router and safety contract | Skill-aware agents can load it directly; others can read it as instructions |
| `.clinerules/` | Cline activation hint and slash-command shortcuts | Cline-specific adapter |

The `.cline` directory name is packaging, not a runtime API dependency. For the
least maintenance, keep the canonical package at that path even when another
harness uses it: the skill and examples intentionally use stable workspace-root
commands such as:

```bash
node .cline/skills/pw-playwright-fieldkit/scripts/crawl.mjs <URL>
```

If you relocate the package, update those path references consistently. Do not
keep two independently edited copies of the scripts or playbooks.

## Requirements for an agent harness

The agent needs permission to:

- run Node.js commands in the workspace;
- read Markdown and JSON reports;
- create test/report files in the project;
- inspect existing Python or Node test conventions before generating tests.

Node.js 18+ and the Playwright browser engine are installed once:

```bash
cd .cline/skills/pw-playwright-fieldkit/scripts
npm install
npx playwright install chromium
npm test
```

No browser MCP server, web-search capability, or model-specific API is required.
`/pw-record-flow` is the exception to headless operation: recording needs a visible
desktop, display forwarding, or VNC so the user can control Codegen.

## Integration pattern A: a repository instruction

This is the most compatible approach. Add the following idea to the harness's
repository-level instructions, using whatever filename that harness recognizes:

```markdown
For requests to explore, debug, audit, record, compare, or automate a live web
application, read `.cline/skills/pw-playwright-fieldkit/SKILL.md`. Select and follow
the matching canonical workflow under its `references/workflows/` directory.
Run the workflow; do not only tell the user which command exists. Operate only on
authorized targets and never add `--i-am-authorized` without explicit approval.
```

Keep this adapter short. Intent routing belongs in `SKILL.md`, and detailed
procedures belong in the canonical workflow files.

## Integration pattern B: a native skill adapter

If the harness discovers skills from its own directory, create a small native
adapter that points to the canonical package. Its description should cover live
site exploration, browser debugging, journey recording, test generation, QE
charters, coverage gaps, negative paths, matrices, accessibility states, and
flake triage. Its body only needs to say:

```markdown
Read and follow `.cline/skills/pw-playwright-fieldkit/SKILL.md`. Treat its linked
workflow references, scripts, templates, and safety rules as canonical.
```

A filesystem symlink to the canonical skill can also work when the harness
supports it, but a tiny adapter is easier to use across Windows and archives.
Do not copy the full skill into several discovery directories unless your
packaging process regenerates those copies automatically.

## Integration pattern C: explicit shortcuts

Slash commands are conveniences, not required functionality. If the harness has
commands, prompts, or tasks, make each one a thin wrapper around the matching
canonical file. For example:

| Shortcut | Canonical workflow |
|---|---|
| `pw-explore-site` | `references/workflows/pw-explore-site.md` |
| `pw-record-flow` | `references/workflows/pw-record-flow.md` |
| `pw-create-test-charter` | `references/workflows/pw-create-test-charter.md` |
| `pw-analyze-test-coverage` | `references/workflows/pw-analyze-test-coverage.md` |
| `pw-generate-negative-tests` | `references/workflows/pw-generate-negative-tests.md` |
| `pw-triage-flaky-test` | `references/workflows/pw-triage-flaky-test.md` |

The complete routing list is in `SKILL.md`. Preserve a single source of truth:
wrappers should delegate, not restate the procedure.

## Integration pattern D: no skill system

For a terminal-capable agent with no persistent rules or skill discovery, give
it a direct prompt:

> Read `.cline/skills/pw-playwright-fieldkit/SKILL.md`, follow the workflow matching
> my request, and execute its bundled scripts. Explore my authorized staging app
> at `https://…` and report what is broken.

For non-agent use, run the same CLI tools directly and read their Markdown
reports. The [Coder Guide](user-guide.md) documents every command and flow
action; the [QA/QE Guide](qa-qe-guide.md) organizes them around test-design work.

## Expected agent behavior

Regardless of harness, the adapter should preserve these rules:

1. Use the deterministic bundled command when it supports the task.
2. Read Markdown output first and JSON only for missing detail.
3. Inspect the consuming suite before choosing Python or Node generation.
4. Generate a regression test only after its flow passes.
5. Keep charters, data ownership, cleanup, and meaningful outcomes with the test.
6. Treat auth state, recordings, HAR files, and reports as potentially sensitive.
7. Stay within the configured authorization scope.

## Portability smoke test

After adding an adapter, ask the harness:

> What bundled workflow would you use to let me demonstrate a checkout journey,
> and what files would it read? Do not start the browser yet.

A correctly integrated agent should find `SKILL.md`, select `pw-record-flow.md`,
mention the headed browser/user handoff, and recognize that intent and outcome
must be captured after recording. Then run `npm test` to validate the portable
runtime independently of the agent integration.
