#!/usr/bin/env node
// Validate and render test cases derived from a feature specification.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { ensureDir, join, log, parseArgs, resolveOut, writeJson, writeText } from "./lib/util.mjs";

const HELP = `test-cases.mjs — validate and render specification-derived test cases

  node test-cases.mjs <test-cases.json> [--out report/test-cases]
                                      [--require-approved]

Required: feature.title/source, requirements[], and cases[]. Each case must
trace to known requirement IDs and contain actions with expected results.
See ../templates/test-cases.example.json.`;

const TYPES = new Set(["positive", "negative", "boundary", "permission", "accessibility", "recovery", "compatibility"]);
const PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const REVIEW_STATUSES = new Set(["draft", "ready-for-approval", "changes-requested", "approved"]);

function text(value) {
  return String(value ?? "").trim();
}

function strings(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function normalizeRequirement(value) {
  return {
    id: text(value?.id),
    text: text(value?.text),
    sourceRef: text(value?.sourceRef),
    risk: text(value?.risk || "medium").toLowerCase(),
  };
}

function normalizeCase(value) {
  return {
    id: text(value?.id),
    title: text(value?.title),
    requirementIds: strings(value?.requirementIds),
    type: text(value?.type || "positive").toLowerCase(),
    priority: text(value?.priority || "medium").toLowerCase(),
    persona: text(value?.persona),
    preconditions: strings(value?.preconditions),
    testData: strings(value?.testData),
    steps: Array.isArray(value?.steps) ? value.steps.map((step) => ({
      action: text(step?.action),
      expected: text(step?.expected),
    })) : [],
    destructive: value?.destructive === true,
    cleanup: strings(value?.cleanup),
    automationCandidate: value?.automationCandidate !== false,
    notes: strings(value?.notes),
  };
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function escapeCell(value) {
  return text(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function list(values) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "_None._";
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
    log.err(`Could not read test cases: ${error.message}`);
    process.exit(1);
  }

  const data = {
    feature: {
      title: text(source.feature?.title),
      source: text(source.feature?.source),
      version: text(source.feature?.version),
      summary: text(source.feature?.summary),
    },
    requirements: Array.isArray(source.requirements) ? source.requirements.map(normalizeRequirement) : [],
    assumptions: strings(source.assumptions),
    openQuestions: strings(source.openQuestions),
    cases: Array.isArray(source.cases) ? source.cases.map(normalizeCase) : [],
    review: {
      status: text(source.review?.status || "draft").toLowerCase(),
      reviewer: source.review?.reviewer ? text(source.review.reviewer) : null,
      notes: strings(source.review?.notes),
    },
    sourceFile: basename(args._[0]),
  };

  const errors = [];
  const warnings = [];
  if (!data.feature.title) errors.push("feature.title is required");
  if (!data.feature.source) errors.push("feature.source is required");
  if (!data.requirements.length) errors.push("at least one requirement is required");
  if (!data.cases.length) errors.push("at least one test case is required");
  if (!REVIEW_STATUSES.has(data.review.status)) errors.push(`unknown review status: ${data.review.status}`);

  const requirementIds = data.requirements.map((requirement) => requirement.id).filter(Boolean);
  for (const id of duplicates(requirementIds)) errors.push(`duplicate requirement ID: ${id}`);
  data.requirements.forEach((requirement, index) => {
    if (!requirement.id) errors.push(`requirement ${index + 1} has no ID`);
    if (!requirement.text) errors.push(`requirement ${requirement.id || index + 1} has no text`);
    if (!PRIORITIES.has(requirement.risk)) warnings.push(`requirement ${requirement.id || index + 1} has non-standard risk: ${requirement.risk}`);
    if (!requirement.sourceRef) warnings.push(`requirement ${requirement.id || index + 1} has no source reference`);
  });

  const requirementSet = new Set(requirementIds);
  const caseIds = data.cases.map((testCase) => testCase.id).filter(Boolean);
  for (const id of duplicates(caseIds)) errors.push(`duplicate test-case ID: ${id}`);
  data.cases.forEach((testCase, index) => {
    const label = testCase.id || `case ${index + 1}`;
    if (!testCase.id) errors.push(`test case ${index + 1} has no ID`);
    if (!testCase.title) errors.push(`${label} has no title`);
    if (!testCase.requirementIds.length) errors.push(`${label} is not linked to a requirement`);
    for (const id of testCase.requirementIds) {
      if (!requirementSet.has(id)) errors.push(`${label} references unknown requirement: ${id}`);
    }
    if (!TYPES.has(testCase.type)) warnings.push(`${label} has non-standard type: ${testCase.type}`);
    if (!PRIORITIES.has(testCase.priority)) warnings.push(`${label} has non-standard priority: ${testCase.priority}`);
    if (!testCase.steps.length) errors.push(`${label} has no steps`);
    testCase.steps.forEach((step, stepIndex) => {
      if (!step.action) errors.push(`${label} step ${stepIndex + 1} has no action`);
      if (!step.expected) {
        const finding = `${label} step ${stepIndex + 1} has no expected result`;
        if (["ready-for-approval", "approved"].includes(data.review.status)) errors.push(finding);
        else warnings.push(finding);
      }
    });
    if (!testCase.preconditions.length) warnings.push(`${label} has no preconditions`);
    if (!testCase.testData.length) warnings.push(`${label} has no test data`);
    if (testCase.destructive && !testCase.cleanup.length) errors.push(`${label} is destructive but has no cleanup`);
  });

  const covered = new Set(data.cases.flatMap((testCase) => testCase.requirementIds));
  for (const id of requirementIds) {
    if (!covered.has(id)) warnings.push(`requirement ${id} has no test case`);
  }
  if (duplicates(data.cases.map((testCase) => testCase.title.toLowerCase()).filter(Boolean)).length) {
    warnings.push("two or more test cases have the same title");
  }
  if (data.review.status === "approved") {
    if (!data.review.reviewer) errors.push("approved test cases require review.reviewer");
    if (data.openQuestions.length) errors.push("approved test cases cannot contain open questions");
  }
  if (args["require-approved"] && data.review.status !== "approved") {
    errors.push(`test cases must be approved before execution; current status is ${data.review.status}`);
  }

  if (errors.length) {
    for (const error of errors) log.err(error);
    process.exit(1);
  }

  const traceability = data.requirements.map((requirement) => {
    const linked = data.cases.filter((testCase) => testCase.requirementIds.includes(requirement.id)).map((testCase) => testCase.id);
    return `| ${escapeCell(requirement.id)} | ${escapeCell(requirement.text)} | ${escapeCell(requirement.sourceRef || "Not specified")} | ${escapeCell(requirement.risk)} | ${linked.length ? linked.join(", ") : "—"} |`;
  }).join("\n");

  const renderedCases = data.cases.map((testCase) => {
    const steps = testCase.steps.map((step, index) => `| ${index + 1} | ${escapeCell(step.action)} | ${escapeCell(step.expected || "Unresolved — not ready for approval")} |`).join("\n");
    return `## ${testCase.id}: ${testCase.title}

- **Requirements:** ${testCase.requirementIds.join(", ")}
- **Type:** ${testCase.type}
- **Priority:** ${testCase.priority}
- **Persona/role:** ${testCase.persona || "Not specified"}
- **Automation candidate:** ${testCase.automationCandidate ? "yes" : "no"}
- **Destructive:** ${testCase.destructive ? "yes" : "no"}

### Preconditions

${list(testCase.preconditions)}

### Test data

${list(testCase.testData)}

### Steps and expected results

| # | Action | Expected result |
|---|---|---|
${steps}

### Cleanup

${list(testCase.cleanup)}

### Notes

${list(testCase.notes)}`;
  }).join("\n\n");

  const md = `# Test cases: ${data.feature.title}

- **Feature source:** ${data.feature.source}
- **Source version:** ${data.feature.version || "Not specified"}
- **Review status:** ${data.review.status}
- **Reviewer:** ${data.review.reviewer || "Not assigned"}
- **Summary:** ${data.feature.summary || "Not specified"}

## Requirements traceability

| Requirement | Requirement text | Source reference | Risk | Test cases |
|---|---|---|---|---|
${traceability}

## Assumptions

${list(data.assumptions)}

## Open questions

${list(data.openQuestions)}

${renderedCases}

## Review notes

${list(data.review.notes)}

## Validation warnings

${list(warnings)}
`;

  const outDir = resolveOut(args.out || "report/test-cases");
  ensureDir(outDir);
  const jsonPath = writeJson(join(outDir, "test-cases.json"), { ...data, warnings });
  const mdPath = writeText(join(outDir, "test-cases.md"), md);
  log.ok(`Test cases: ${mdPath}`);
  console.log(JSON.stringify({
    testCases: mdPath,
    data: jsonPath,
    requirements: data.requirements.length,
    cases: data.cases.length,
    reviewStatus: data.review.status,
    warnings: warnings.length,
  }));
}

main();
