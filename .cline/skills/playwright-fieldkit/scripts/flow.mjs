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
import { launch, gotoSafe } from "./lib/browser.mjs";
import { instrument } from "./lib/instrument.mjs";
import {
  parseArgs, log, ensureDir, writeJson, writeText, resolveOut, join, truncate,
} from "./lib/util.mjs";
import { generateTestFromFlow, languageFromTestPath } from "./lib/gen-test.mjs";
import { createScope, installNavigationScope } from "./lib/scope.mjs";
import { flowAction } from "./lib/flow-actions.mjs";
import { auditPageState } from "./lib/state-audit.mjs";

const HELP = `flow.mjs — run a JSON user journey, capture each step, optionally emit a test

  node flow.mjs <flow.json> [--headed] [--storage-state auth.json]
                [--gen-test tests/test_flow.py|tests/flow.spec.ts] [--out dir]

  Actions include goto/click/fill/type/select/check/press/hover/scrollTo,
  waits, expectText/expectUrl/expectVisible/expectNotVisible/expectValue/
  expectCount, mockResponse/mockAbort, auditA11y, and screenshots.
  See ../templates/flow.example.json.`;

async function runStep(page, step, ctx) {
  const action = flowAction(step);
  const target = step[action];
  const value = step.value;
  switch (action) {
    case "mockResponse": {
      const status = Number(step.status ?? 200);
      if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error(`invalid mock status: ${step.status}`);
      const body = typeof step.body === "string" ? step.body : JSON.stringify(step.body ?? {});
      await page.route(target, (route) => route.fulfill({
        status,
        body,
        contentType: step.contentType || (typeof step.body === "string" ? "text/plain" : "application/json"),
        headers: step.headers || {},
      }));
      return `mocked ${target} with HTTP ${status}`;
    }
    case "mockAbort":
      await page.route(target, (route) => route.abort(step.errorCode || "failed"));
      return `aborted requests matching ${target}`;
    case "goto": {
      const url = /^https?:/.test(target) ? target : (ctx.baseUrl || "") + target;
      ctx.scope.assertAllowed(url, "Flow navigation");
      const nav = await gotoSafe(page, url, { timeout: 30000 });
      if (!nav.ok) throw new Error(`goto failed: ${nav.error}`);
      return `navigated to ${url} (${nav.status})`;
    }
    case "click":
      await page.locator(target).first().click({ timeout: 10000 });
      return `clicked ${target}`;
    case "fill":
      await page.locator(target).first().fill(String(value ?? ""), { timeout: 10000 });
      return `filled ${target}`;
    case "type":
      await page.locator(target).first().pressSequentially(String(value ?? ""), { timeout: 10000 });
      return `typed into ${target}`;
    case "select":
      await page.locator(target).first().selectOption(String(value ?? ""), { timeout: 10000 });
      return `selected ${value} in ${target}`;
    case "check":
      await page.locator(target).first().check({ timeout: 10000 });
      return `checked ${target}`;
    case "uncheck":
      await page.locator(target).first().uncheck({ timeout: 10000 });
      return `unchecked ${target}`;
    case "press":
      if (step.selector) await page.locator(step.selector).first().press(target, { timeout: 10000 });
      else await page.keyboard.press(target);
      return `pressed ${target}`;
    case "hover":
      await page.locator(target).first().hover({ timeout: 10000 });
      return `hovered ${target}`;
    case "scrollTo":
      await page.locator(target).first().scrollIntoViewIfNeeded({ timeout: 10000 });
      return `scrolled to ${target}`;
    case "waitFor":
      await page.locator(target).first().waitFor({ state: "visible", timeout: 15000 });
      return `saw ${target}`;
    case "waitForUrl":
      await page.waitForURL((u) => u.toString().includes(target), { timeout: 15000 });
      return `url reached ${target}`;
    case "wait":
      await page.waitForTimeout(Number(target) || 0);
      return `waited ${target}ms`;
    case "expectText": {
      const found = await page.getByText(target, { exact: false }).first().isVisible({ timeout: 10000 }).catch(() => false);
      if (!found) throw new Error(`expected text not visible: "${target}"`);
      return `verified text "${truncate(target, 40)}"`;
    }
    case "expectUrl": {
      const cur = page.url();
      if (!cur.includes(target)) throw new Error(`expected url to include "${target}" but was ${cur}`);
      return `verified url contains "${target}"`;
    }
    case "expectVisible": {
      const vis = await page.locator(target).first().isVisible({ timeout: 10000 }).catch(() => false);
      if (!vis) throw new Error(`expected visible: ${target}`);
      return `verified ${target} visible`;
    }
    case "expectNotVisible": {
      // Passes if the element is absent or hidden — waits for it to disappear.
      try {
        await page.locator(target).first().waitFor({ state: "hidden", timeout: 10000 });
      } catch {
        throw new Error(`expected NOT visible, but it is: ${target}`);
      }
      return `verified ${target} not visible`;
    }
    case "expectValue": {
      const actual = await page.locator(target).first().inputValue({ timeout: 10000 }).catch(() => null);
      if (actual !== String(value ?? "")) throw new Error(`expected value "${value}" in ${target} but got "${actual}"`);
      return `verified value of ${target}`;
    }
    case "expectCount": {
      const n = await page.locator(target).count();
      if (n !== Number(value)) throw new Error(`expected ${value} matches for ${target} but found ${n}`);
      return `verified count ${n} for ${target}`;
    }
    case "auditA11y": {
      const issues = await auditPageState(page, Array.isArray(step.allow) ? step.allow : []);
      if (issues.length) throw new Error(`accessibility audit "${target}" found: ${issues.map((issue) => `${issue.code}${issue.selector ? `@${issue.selector}` : ""}`).join(", ")}`);
      return `audited accessibility state "${target}"`;
    }
    case "screenshot": {
      const file = `${String(ctx.index).padStart(2, "0")}-${String(target).replace(/[^a-z0-9]+/gi, "-")}.png`;
      await page.screenshot({ path: join(ctx.outDir, file) }).catch(() => {});
      return `screenshot ${file}`;
    }
    default:
      throw new Error(`unknown action "${action}" in step ${JSON.stringify(step)}`);
  }
}

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

  await browser.close();

  const passed = failedAt === -1;
  const md = buildFlowReport(flow, results, passed, failedAt);
  const mdPath = writeText(join(outDir, "flow.md"), md);
  const jsonPath = writeJson(join(outDir, "flow.json"), { flow: flow.name, scope: scope.metadata(), passed, failedAt, results });

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
  console.log(JSON.stringify({ passed, failedAt: failedAt + 1 || null, steps: results.length, report: mdPath, data: jsonPath }));
  process.exit(passed ? 0 : 1);
}

function buildFlowReport(flow, results, passed, failedAt) {
  const L = [`# Flow: ${flow.name || "(unnamed)"}`, "", `**Result:** ${passed ? "✅ PASSED" : `❌ FAILED at step ${failedAt + 1}`}`, ""];
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
