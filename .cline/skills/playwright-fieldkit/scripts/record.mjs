#!/usr/bin/env node
// Launch Playwright Codegen in a visible browser so a user can demonstrate a
// journey. The requested output extension chooses the default recording target.

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createScope } from "./lib/scope.mjs";
import { ensureDir, join, log, parseArgs, redact } from "./lib/util.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PLAYWRIGHT_CLI = join(SCRIPT_DIR, "node_modules", "playwright", "cli.js");
const PYTHON_TARGETS = new Set(["python", "python-async", "python-pytest"]);
const NODE_TARGETS = new Set(["javascript", "playwright-test"]);

const HELP = `record.mjs — let a user demonstrate a journey in Playwright Codegen

  node record.mjs <url> --output <test.py|test.spec.ts> [options]

  --output <file>             required recording destination
  --target <target>           override inferred target (python, python-async,
                              python-pytest, javascript, playwright-test)
  --browser <name>            chromium, firefox, or webkit
  --load-storage <file>       start with saved authentication state
  --save-storage <file>       save authentication state when the recorder closes
  --device <name>             emulate a Playwright device
  --test-id-attribute <name>  preferred test-id attribute for locators
  --scope-config <file>       authorization allowlist configuration
  --dry-run                   print the resolved Codegen invocation without opening UI

Other supported Codegen options: --color-scheme, --viewport-size,
--ignore-https-errors, --lang, --timezone, --geolocation, --user-agent,
--proxy-server, --proxy-bypass, --channel, --block-service-workers, --timeout,
--user-data-dir, --save-har, and --save-har-glob.`;

const PASSTHROUGH = [
  "browser", "device", "test-id-attribute", "color-scheme", "viewport-size",
  "ignore-https-errors", "lang", "timezone", "geolocation", "user-agent",
  "proxy-server", "proxy-bypass", "channel", "block-service-workers", "timeout",
  "save-har-glob",
];
const PATH_OPTIONS = ["load-storage", "save-storage", "save-har", "user-data-dir"];

function fail(message) {
  log.err(message);
  process.exit(1);
}

function categoryForOutput(output) {
  const extension = extname(output).toLowerCase();
  if (extension === ".py") return "python";
  if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(extension)) return "node";
  fail(`Cannot infer recorder target from "${output}". Use .py for Python or .ts/.js for @playwright/test.`);
}

function selectTarget(output, requested) {
  const category = categoryForOutput(output);
  const target = requested || (category === "python" ? "python-pytest" : "playwright-test");
  const valid = category === "python" ? PYTHON_TARGETS : NODE_TARGETS;
  if (!valid.has(target)) fail(`Target "${target}" does not match ${extname(output)} output.`);
  return target;
}

function appendOption(command, name, value) {
  if (value === undefined || value === false) return;
  if (Array.isArray(value)) fail(`--${name} may be supplied only once.`);
  command.push(value === true ? `--${name}` : `--${name}=${value}`);
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args._.length !== 1) fail("Provide exactly one authorized start URL.");
  if (!args.output || args.output === true) fail("Provide --output with a .py, .ts, or .js filename.");
  if (Array.isArray(args.output) || Array.isArray(args.target)) fail("--output and --target may be supplied only once.");

  const startUrl = String(args._[0]);
  let parsed;
  try {
    parsed = new URL(startUrl);
  } catch {
    fail(`Invalid start URL: ${startUrl}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) fail("Recorder start URL must use HTTP or HTTPS.");

  const scope = createScope(args);
  scope.assertAllowed(startUrl, "Recorder start URL");

  const output = resolve(String(args.output));
  const target = selectTarget(output, args.target ? String(args.target) : null);
  ensureDir(dirname(output));

  const command = ["codegen", `--target=${target}`, `--output=${output}`];
  for (const name of PASSTHROUGH) appendOption(command, name, args[name]);
  for (const name of PATH_OPTIONS) {
    const value = args[name];
    if (value === undefined || value === false) continue;
    if (value === true || Array.isArray(value)) fail(`--${name} requires one path.`);
    const path = resolve(String(value));
    if (name === "load-storage" && !existsSync(path)) fail(`Storage state not found: ${path}`);
    if (["save-storage", "save-har"].includes(name)) ensureDir(dirname(path));
    appendOption(command, name, path);
  }
  command.push(startUrl);

  if (args["dry-run"]) {
    console.log(JSON.stringify({
      executable: process.execPath,
      args: [PLAYWRIGHT_CLI, ...command].map((value) => redact(value)),
      output,
      target,
      scope: scope.metadata(),
    }, null, 2));
    return;
  }

  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    fail("No graphical display detected. Run the recorder on a desktop session or configure display forwarding/VNC.");
  }

  log.info("A browser and Playwright Inspector will open. Demonstrate the journey and add outcome assertions where useful.");
  log.info("Close the browser/Inspector when recording is complete; the agent will then review the generated file.");

  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [PLAYWRIGHT_CLI, ...command], { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code, signal) => resolveExit(signal === "SIGINT" ? 130 : (code ?? 1)));
  });
  if (exitCode !== 0) process.exit(exitCode);

  if (existsSync(output) && statSync(output).size > 0) log.ok(`Recording: ${output}`);
  else log.warn(`Recorder closed without writing actions to ${output}.`);
}

main().catch((error) => {
  log.err(String(error.stack || error));
  process.exit(1);
});
