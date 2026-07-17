#!/usr/bin/env node
// Compare crawl-discovered routes/forms with literal navigation evidence in an
// existing Playwright suite. This is a deterministic heuristic, not code coverage.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { join, log, parseArgs, resolveOut, writeJson, writeText } from "./lib/util.mjs";

const TEST_EXTENSIONS = new Set([".py", ".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "report", "playwright-report", "test-results", "__pycache__"]);

function crawlFile(path) {
  try { return statSync(path).isDirectory() ? join(path, "crawl.json") : path; }
  catch { throw new Error(`Not found: ${path}`); }
}

function testFiles(inputs) {
  const files = [];
  const walk = (path) => {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) if (!SKIP_DIRS.has(name)) walk(join(path, name));
    } else if (TEST_EXTENSIONS.has(extname(path).toLowerCase())) files.push(path);
  };
  for (const input of inputs) walk(resolve(input));
  return files;
}

function routeValue(value, base) {
  try { return new URL(value, base).pathname.replace(/\/$/, "") || "/"; }
  catch { return null; }
}

function main() {
  const args = parseArgs();
  if (args.help || args._.length < 2) {
    console.log("coverage.mjs — node coverage.mjs <crawl.json|dir> <test-file|dir...> [--test-cases <test-cases.json>] [--out report/coverage]");
    process.exit(args.help ? 0 : 1);
  }
  if ("test-cases" in args && typeof args["test-cases"] !== "string") {
    log.err(`--test-cases requires a test-cases JSON path; got ${JSON.stringify(args["test-cases"])}`);
    process.exit(1);
  }
  let crawl;
  try { crawl = JSON.parse(readFileSync(crawlFile(args._[0]), "utf8")); }
  catch (error) { log.err(`Could not read crawl: ${error.message}`); process.exit(1); }
  let testCases = null;
  if (args["test-cases"]) {
    try { testCases = JSON.parse(readFileSync(args["test-cases"], "utf8")); }
    catch (error) { log.err(`Could not read test cases: ${error.message}`); process.exit(1); }
  }

  let files;
  try { files = testFiles(args._.slice(1)); }
  catch (error) { log.err(error.message); process.exit(1); }
  const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  const evidence = new Map();
  const add = (route, file) => {
    if (!route) return;
    if (!evidence.has(route)) evidence.set(route, new Set());
    evidence.get(route).add(file);
  };
  const navigation = /(?:goto|wait_for_url|waitForURL|to_have_url|toHaveURL)\s*\(\s*(?:re\.compile\()?\s*["'`]([^"'`]+)["'`]/g;
  for (const [file, source] of sources) {
    for (const match of source.matchAll(navigation)) add(routeValue(match[1], crawl.startUrl), file);
  }

  // Requirement traceability: a permanent test counts as evidence for a
  // requirement when its source literally mentions the requirement ID or a
  // linked case ID. Heuristic by design — verify candidates before acting.
  let requirementTraceability = null;
  if (testCases) {
    const mentions = (id) => (id ? files.filter((file) => sources.get(file).includes(id)) : []);
    const cases = Array.isArray(testCases.cases) ? testCases.cases : [];
    requirementTraceability = (Array.isArray(testCases.requirements) ? testCases.requirements : []).map((requirement) => {
      const linked = cases.filter((testCase) => Array.isArray(testCase.requirementIds) && testCase.requirementIds.includes(requirement.id));
      const testEvidence = [...new Set([...mentions(requirement.id), ...linked.flatMap((testCase) => mentions(testCase.id))])];
      return {
        id: requirement.id,
        risk: requirement.risk,
        caseIds: linked.map((testCase) => testCase.id),
        automationCandidates: linked.filter((testCase) => testCase.automationCandidate !== false).map((testCase) => testCase.id),
        testEvidence,
      };
    });
  }

  const routes = [...new Set((crawl.pages || []).map((page) => routeValue(page.url, crawl.startUrl)).filter(Boolean))].sort();
  const coveredRoutes = routes.filter((route) => evidence.has(route));
  const uncoveredRoutes = routes.filter((route) => !evidence.has(route));
  const forms = (crawl.pages || []).flatMap((page) => (page.features?.forms || []).map((form) => ({
    page: page.url,
    method: String(form.method || "GET").toUpperCase(),
    action: form.action || "",
  })));
  const uncoveredForms = forms.filter((form) => {
    const action = routeValue(form.action || form.page, form.page);
    return !evidence.has(routeValue(form.page, crawl.startUrl)) && !evidence.has(action);
  });

  const outDir = resolveOut(args.out || "report/coverage");
  const lines = [
    "# Playwright automation coverage gaps", "",
    "> Heuristic route/form coverage based on literal navigation evidence; this is not runtime code coverage.", "",
    `- Crawl routes: ${routes.length}`,
    `- Routes with test evidence: ${coveredRoutes.length}`,
    `- Routes without test evidence: ${uncoveredRoutes.length}`,
    `- Forms without route evidence: ${uncoveredForms.length}`, "",
    "## Routes without test evidence", "",
    ...(uncoveredRoutes.length ? uncoveredRoutes.map((route) => `- \`${route}\``) : ["_None._"]), "",
    "## Forms without route evidence", "",
    ...(uncoveredForms.length ? uncoveredForms.map((form) => `- \`${form.method}\` ${form.action || "(no action)"} on ${form.page}`) : ["_None._"]), "",
    "## Covered routes", "",
    ...(coveredRoutes.length ? coveredRoutes.map((route) => `- \`${route}\` — ${[...evidence.get(route)].join(", ")}`) : ["_None detected._"]), "",
  ];
  if (requirementTraceability) {
    lines.push(
      "## Requirement traceability to permanent tests", "",
      "> A test counts as evidence when it literally mentions the requirement or a linked case ID; verify each candidate.", "",
      "| Requirement | Risk | Cases | Automation candidates | Permanent-test evidence |",
      "|---|---|---|---|---|",
      ...requirementTraceability.map((entry) => `| ${entry.id} | ${entry.risk || "—"} | ${entry.caseIds.join(", ") || "—"} | ${entry.automationCandidates.join(", ") || "—"} | ${entry.testEvidence.join(", ") || "—"} |`),
      "",
    );
  }
  const data = { crawl: crawl.startUrl, testFiles: files, routes, coveredRoutes, uncoveredRoutes, uncoveredForms, requirementTraceability };
  const mdPath = writeText(join(outDir, "coverage-gaps.md"), lines.join("\n"));
  const jsonPath = writeJson(join(outDir, "coverage-gaps.json"), data);
  log.ok(`Coverage gaps: ${mdPath}`);
  console.log(JSON.stringify({
    report: mdPath,
    data: jsonPath,
    uncoveredRoutes: uncoveredRoutes.length,
    uncoveredForms: uncoveredForms.length,
    ...(requirementTraceability ? { requirementsWithoutTestEvidence: requirementTraceability.filter((entry) => !entry.testEvidence.length).length } : {}),
  }));
}

main();
