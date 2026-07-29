#!/usr/bin/env node
// save-auth.mjs — Log in once and save the session so crawl/inspect/flow can
// explore authenticated pages. Two modes:
//
//   Interactive (you log in by hand):
//     node save-auth.mjs <loginUrl> --out auth.json --headed
//     ...a browser opens; log in; then press Enter in this terminal.
//
//   Scripted (log in from a flow JSON that ends logged-in):
//     node save-auth.mjs --flow login.json --out auth.json
//
// The saved auth.json contains cookies and localStorage. Treat it like a
// password — never commit it. See docs/reference/cli.md#authentication.

import { readFileSync } from "node:fs";
import { launch, gotoSafe } from "./lib/browser.mjs";
import { parseArgs, log, ensureDir, writeJson } from "./lib/util.mjs";
import { createScope, installNavigationScope } from "./lib/scope.mjs";
import { flowAction } from "./lib/flow-actions.mjs";
import { runStep } from "./lib/run-step.mjs";
import { dirname } from "node:path";

async function main() {
  const args = parseArgs();
  const out = args.out || "auth.json";
  const scope = createScope(args);
  ensureDir(dirname(out) === "" ? "." : dirname(out));

  if (args.flow) {
    // Scripted login: runs the same step vocabulary as flow.mjs. A step that
    // fails or is not recognized aborts the run — silently skipping part of a
    // login flow would save a broken (possibly unauthenticated) state.
    const flow = JSON.parse(readFileSync(args.flow, "utf8"));
    if (!Array.isArray(flow.steps)) {
      log.err(`Flow file must have a "steps" array.`);
      process.exit(1);
    }
    for (const step of flow.steps) flowAction(step);
    for (const step of flow.steps) {
      if (flowAction(step) !== "goto") continue;
      const target = /^https?:/.test(step.goto) ? step.goto : (flow.baseUrl || "") + step.goto;
      scope.assertAllowed(target, "Authentication flow navigation");
    }
    const { browser, context } = await launch(args);
    await installNavigationScope(context, scope);
    const page = await context.newPage();
    log.info(`Logging in via flow "${flow.name || args.flow}"`);
    const flowOutDir = dirname(out) === "" ? "." : dirname(out);
    for (let i = 0; i < flow.steps.length; i++) {
      const detail = await runStep(page, flow.steps[i], { baseUrl: flow.baseUrl, outDir: flowOutDir, index: i, scope });
      log.dim(`  ${i + 1}. ${detail}`);
      await page.waitForTimeout(400);
    }
    await context.storageState({ path: out });
    if (scope.enabled || scope.override) writeJson(`${out}.meta.json`, { scope: scope.metadata() });
    await browser.close();
    log.ok(`Saved auth state to ${out}`);
    return;
  }

  const loginUrl = args._[0];
  if (!loginUrl) {
    log.err(`Provide a login URL (interactive) or --flow login.json (scripted).`);
    process.exit(1);
  }
  scope.assertAllowed(loginUrl, "Login URL");
  const { browser, context } = await launch({ ...args, headed: true });
  await installNavigationScope(context, scope);
  const page = await context.newPage();
  await gotoSafe(page, loginUrl);
  log.info(`A browser window is open. Log in there, then press Enter here to save the session.`);
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", resolve);
  });
  await context.storageState({ path: out });
  if (scope.enabled || scope.override) writeJson(`${out}.meta.json`, { scope: scope.metadata() });
  await browser.close();
  log.ok(`Saved auth state to ${out}`);
  process.exit(0);
}

main().catch((e) => {
  log.err(String(e.stack || e));
  process.exit(1);
});
