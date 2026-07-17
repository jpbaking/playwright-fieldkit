#!/usr/bin/env node
// flow.mjs — Run a scripted user journey described in a small JSON file, capture
// what happened at every step, and (optionally) emit a ready-to-run Playwright
// test from it. This is how a weaker model reproduces a bug or builds an
// integration test WITHOUT writing Playwright code by hand.
//
// Usage:
//   node flow.mjs <flow.json> [options]
//
// Options:
//   --out <dir>          output dir           (default playwright-report-flow)
//   --browser <name>     chromium | firefox | webkit
//   --headed             show the browser
//   --storage-state <f>  auth state JSON
//   --device <name>      emulate a device, e.g. "iPhone 13"
//   --trace[=file.zip]   capture a Playwright trace (default <out>/trace.zip;
//                        a relative file resolves under --out)
//   --gen-test <file>    write a Playwright test; .py selects Python, .ts/.js selects Node
//   --wait <ms>          settle time after each step        (default 500)
//   --help
//
// Flow file shape (see ../templates/flow.example.json):
//   { "name": "...", "baseUrl": "https://...", "steps": [ {action}, ... ] }
// Each step is one object with exactly one action key:
//   {"goto":"/path"} {"click":"selector"} {"fill":"sel","value":"x"}
//   {"type":"sel","value":"x"} {"select":"sel","value":"x"}
//   {"check":"sel"} {"uncheck":"sel"} {"press":"Enter","selector":"sel"}
//   {"hover":"sel"} {"scrollTo":"sel"}
//   {"waitFor":"sel"} {"waitForUrl":"substr"} {"wait":1000}
//   {"expectText":"visible text"} {"expectUrl":"substr"} {"expectVisible":"sel"}
//   {"expectNotVisible":"sel"} {"expectValue":"sel","value":"x"}
//   {"expectCount":"sel","value":3} {"mockResponse":"**/api","status":503}
//   {"mockAbort":"**/api"} {"auditA11y":"state label"} {"screenshot":"label"}

import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { launch } from "./lib/browser.mjs";
import { instrument } from "./lib/instrument.mjs";
import {
  parseArgs, log, ensureDir, writeJson, writeText, resolveOut, join, truncate,
} from "./lib/util.mjs";
import { generateTestFromFlow, languageFromTestPath } from "./lib/gen-test.mjs";
import { createScope, installNavigationScope } from "./lib/scope.mjs";
import { flowAction } from "./lib/flow-actions.mjs";
import { runStep } from "./lib/run-step.mjs";

const HELP = `flow.mjs — run a JSON user journey, capture each step, optionally emit a test

  node flow.mjs <flow.json> [--headed] [--storage-state auth.json] [--trace]
                [--gen-test tests/test_flow.py|tests/flow.spec.ts] [--out dir]

  Actions include goto/click/fill/type/select/check/press/hover/scrollTo,
  waits, expectText/expectUrl/expectVisible/expectNotVisible/expectValue/
  expectCount, mockResponse/mockAbort, auditA11y, and screenshots.
  See ../templates/flow.example.json.`;

async function main() {
  const args = parseArgs();
  if (args.help || args._.length === 0) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  let flow;
  try {
    flow = JSON.parse(readFileSync(args._[0], "utf8"));
  } catch (e) {
    log.err(`Could not read flow file ${args._[0]}: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(flow.steps)) {
    log.err(`Flow file must have a "steps" array.`);
    process.exit(1);
  }
  try {
    for (const step of flow.steps) flowAction(step);
  } catch (error) {
    log.err(error.message);
    process.exit(1);
  }
  if (args["gen-test"]) {
    try {
      languageFromTestPath(args["gen-test"]);
    } catch (error) {
      log.err(error.message);
      process.exit(1);
    }
  }

  const outDir = resolveOut(args.out || "playwright-report-flow");
  ensureDir(outDir);
  if (resolve(process.cwd(), args._[0]) === join(outDir, "flow.json")) {
    log.err(`Refusing to run: the results file ${join(outDir, "flow.json")} would overwrite the input flow. Rename the input (e.g. case-flow.json) or use a different --out.`);
    process.exit(1);
  }
  let tracePath = null;
  if (args.trace !== undefined && args.trace !== false) {
    if (args.trace === true) {
      tracePath = join(outDir, "trace.zip");
    } else if (typeof args.trace === "string" && args.trace.endsWith(".zip")) {
      tracePath = isAbsolute(args.trace) ? args.trace : join(outDir, args.trace);
    } else {
      log.err(`--trace takes no bare value; use --trace (writes <out>/trace.zip) or --trace=<file.zip>. Got: ${JSON.stringify(args.trace)}`);
      process.exit(1);
    }
  }
  if (tracePath) ensureDir(dirname(tracePath));
  const wait = args.wait ?? 500;
  const scope = createScope(args);
  for (const step of flow.steps) {
    if (flowAction(step) !== "goto") continue;
    const target = step.goto;
    const targetUrl = /^https?:/.test(target) ? target : (flow.baseUrl || "") + target;
    scope.assertAllowed(targetUrl, "Flow navigation");
  }

  log.info(`Running flow "${flow.name || args._[0]}" (${flow.steps.length} steps)`);
  const { browser, context } = await launch({ ...args, storageState: args["storage-state"] || flow.storageState });
  if (tracePath) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }
  await installNavigationScope(context, scope);
  const page = await context.newPage();
  const collector = instrument(page);

  const results = [];
  let failedAt = -1;
  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    collector.drain();
    try {
      const detail = await runStep(page, step, { baseUrl: flow.baseUrl, outDir, index: i, scope });
      await page.waitForTimeout(wait);
      const signals = collector.drain();
      const problem = signals.errors.length || signals.requests.some((r) => r.kind !== "slow");
      results.push({ step, ok: true, detail, signals });
      log[problem ? "warn" : "dim"](`  ${i + 1}. ${detail}${problem ? "  ⚠ errors during step" : ""}`);
    } catch (e) {
      const signals = collector.drain();
      results.push({ step, ok: false, error: String(e.message || e).split("\n")[0], signals });
      log.err(`  ${i + 1}. FAILED: ${results[i].error}`);
      await page.screenshot({ path: join(outDir, `FAILED-step-${i + 1}.png`) }).catch(() => {});
      failedAt = i;
      break;
    }
  }

  let savedTracePath = null;
  if (tracePath) {
    try {
      await context.tracing.stop({ path: tracePath });
      savedTracePath = tracePath;
      log.ok(`Trace:  ${savedTracePath}`);
    } catch (error) {
      log.warn(`Could not save Playwright trace: ${error.message}`);
    }
  }
  await browser.close();

  const passed = failedAt === -1;
  const md = buildFlowReport(flow, results, passed, failedAt, savedTracePath);
  const mdPath = writeText(join(outDir, "flow.md"), md);
  const jsonPath = writeJson(join(outDir, "flow.json"), {
    flow: flow.name,
    scope: scope.metadata(),
    passed,
    failedAt,
    trace: savedTracePath,
    results,
  });

  if (args["gen-test"]) {
    if (passed) {
      const spec = generateTestFromFlow(flow, args["gen-test"]);
      const specPath = writeText(args["gen-test"], spec);
      log.ok(`Test:   ${specPath}`);
    } else {
      log.warn(`Skipped --gen-test: the flow failed, so the test is unverified. Fix the flow and re-run.`);
    }
  }
  log[passed ? "ok" : "err"](passed ? `Flow PASSED (${results.length} steps)` : `Flow FAILED at step ${failedAt + 1}`);
  log.ok(`Report: ${mdPath}`);
  console.log(JSON.stringify({
    passed,
    failedAt: failedAt + 1 || null,
    steps: results.length,
    report: mdPath,
    data: jsonPath,
    trace: savedTracePath,
  }));
  process.exit(passed ? 0 : 1);
}

function buildFlowReport(flow, results, passed, failedAt, tracePath) {
  const L = [`# Flow: ${flow.name || "(unnamed)"}`, "", `**Result:** ${passed ? "✅ PASSED" : `❌ FAILED at step ${failedAt + 1}`}`, ""];
  if (tracePath) {
    L.push(`**Playwright trace:** \`${tracePath}\``, "");
  }
  L.push(`## Steps`);
  results.forEach((r, i) => {
    L.push(`${i + 1}. ${r.ok ? "✅" : "❌"} \`${JSON.stringify(r.step)}\``);
    if (r.detail) L.push(`   - ${r.detail}`);
    if (r.error) L.push(`   - **error:** ${r.error}`);
    for (const e of r.signals.errors) L.push(`   - ⚠ JS error: ${truncate(e.message, 120)}`);
    for (const req of r.signals.requests.filter((x) => x.kind !== "slow")) L.push(`   - ⚠ request ${req.status || req.error}: ${truncate(req.url, 100)}`);
  });
  L.push("");
  if (!passed) L.push(`See \`FAILED-step-${failedAt + 1}.png\` for the screenshot at the point of failure.`);
  return L.join("\n");
}

main().catch((e) => {
  log.err(String(e.stack || e));
  process.exit(1);
});
