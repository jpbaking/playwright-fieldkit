#!/usr/bin/env node
// Validate a QE journey charter and render a concise Markdown artifact.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { ensureDir, join, log, parseArgs, resolveOut, writeJson, writeText } from "./lib/util.mjs";

const HELP = `charter.mjs — validate and render a QE journey charter

  node charter.mjs <journey.json> [--out report/journey]

Required fields: title, intent, outcomes[]. Destructive journeys must declare
at least one cleanup step. See ../templates/journey.example.json.`;

function strings(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function main() {
  const args = parseArgs();
  if (args.help || args._.length !== 1) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  let source;
  try {
    source = JSON.parse(readFileSync(args._[0], "utf8"));
  } catch (error) {
    log.err(`Could not read charter: ${error.message}`);
    process.exit(1);
  }

  const charter = {
    title: String(source.title || "").trim(),
    intent: String(source.intent || "").trim(),
    risk: String(source.risk || "").trim(),
    persona: String(source.persona || "").trim(),
    startUrl: String(source.startUrl || "").trim(),
    preconditions: strings(source.preconditions),
    outcomes: strings(source.outcomes),
    negativeCases: strings(source.negativeCases),
    cleanup: strings(source.cleanup),
    tags: strings(source.tags),
    destructive: source.destructive === true,
    testData: {
      strategy: String(source.testData?.strategy || "unspecified"),
      notes: strings(source.testData?.notes),
    },
    matrix: Array.isArray(source.matrix) ? source.matrix : [],
    recording: source.recording ? String(source.recording) : null,
    flow: source.flow ? String(source.flow) : null,
    automation: source.automation && typeof source.automation === "object" ? source.automation : {},
    source: basename(args._[0]),
  };

  const errors = [];
  const warnings = [];
  if (!charter.title) errors.push("title is required");
  if (!charter.intent) errors.push("intent is required");
  if (!charter.outcomes.length) errors.push("at least one outcome is required");
  if (charter.destructive && !charter.cleanup.length) errors.push("destructive journeys require cleanup steps");
  if (!charter.preconditions.length) warnings.push("preconditions are not documented");
  if (charter.testData.strategy === "unspecified") warnings.push("test-data strategy is unspecified");
  if (charter.matrix.length > 1 && !/unique|isolated|per[- ]?(worker|run|test)/i.test(charter.testData.strategy)) {
    warnings.push("multi-variant journey does not declare isolated or unique test data");
  }
  if (errors.length) {
    for (const error of errors) log.err(error);
    process.exit(1);
  }

  const outDir = resolveOut(args.out || "report/journey");
  ensureDir(outDir);
  const list = (values) => values.length ? values.map((value) => `- ${value}`).join("\n") : "_Not specified._";
  const md = `# Journey charter: ${charter.title}

## Intent and risk

- **Intent:** ${charter.intent}
- **Business risk:** ${charter.risk || "Not specified."}
- **Persona/role:** ${charter.persona || "Not specified."}
- **Start URL:** ${charter.startUrl || "Not specified."}
- **Destructive:** ${charter.destructive ? "yes" : "no"}
- **Tags:** ${charter.tags.length ? charter.tags.join(", ") : "None"}

## Preconditions

${list(charter.preconditions)}

## Expected outcomes

${list(charter.outcomes)}

## Negative and boundary cases

${list(charter.negativeCases)}

## Test data

- **Strategy:** ${charter.testData.strategy}
${list(charter.testData.notes)}

## Cleanup

${list(charter.cleanup)}

## Intended matrix

${charter.matrix.length ? charter.matrix.map((entry) => `- ${typeof entry === "string" ? entry : JSON.stringify(entry)}`).join("\n") : "_Single/default variant._"}

## Automation links

- **Recording:** ${charter.recording || "Not recorded."}
- **Flow:** ${charter.flow || "Not created."}
- **Test:** ${charter.automation.testPath || "Not generated."}

## Charter warnings

${list(warnings)}
`;
  const jsonPath = writeJson(join(outDir, "journey.json"), { ...charter, warnings });
  const mdPath = writeText(join(outDir, "journey.md"), md);
  log.ok(`Charter: ${mdPath}`);
  console.log(JSON.stringify({ charter: mdPath, data: jsonPath, warnings: warnings.length }));
}

main();
