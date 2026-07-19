#!/usr/bin/env node
// Execute an explicit QE role/browser/device matrix without shell interpolation.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, log, parseArgs, resolveOut, writeJson, writeText } from "./lib/util.mjs";

function execute(command, env) {
  return new Promise((resolveRun, reject) => {
    const started = Date.now();
    const child = spawn(command[0], command.slice(1), {
      env: { ...process.env, ...env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolveRun({ code: code ?? 1, durationMs: Date.now() - started, stdout, stderr }));
  });
}

async function main() {
  const args = parseArgs();
  if (args.help || args._.length !== 1) {
    console.log("matrix.mjs — node matrix.mjs <matrix.json> [--out report/matrix] [--dry-run]");
    process.exit(args.help ? 0 : 1);
  }
  let config;
  try { config = JSON.parse(readFileSync(args._[0], "utf8")); }
  catch (error) { log.err(`Could not read matrix: ${error.message}`); process.exit(1); }
  if (!Array.isArray(config.variants) || !config.variants.length) {
    log.err("Matrix requires a non-empty variants array.");
    process.exit(1);
  }
  const names = new Set();
  for (const variant of config.variants) {
    if (!variant.name || names.has(variant.name)) { log.err("Every matrix variant needs a unique name."); process.exit(1); }
    names.add(variant.name);
    if (!Array.isArray(variant.command) || !variant.command.length || variant.command.some((part) => typeof part !== "string")) {
      log.err(`Variant "${variant.name}" needs a command string array.`); process.exit(1);
    }
  }
  if (args["dry-run"]) {
    console.log(JSON.stringify({ variants: config.variants.map(({ name, command, role, browser, device }) => ({ name, command, role, browser, device })) }, null, 2));
    return;
  }

  const outDir = resolveOut(args.out || "report/matrix");
  const results = [];
  for (const variant of config.variants) {
    log.info(`Matrix: ${variant.name}`);
    const result = await execute(variant.command, variant.env || {});
    results.push({
      name: variant.name, role: variant.role || null, browser: variant.browser || null,
      device: variant.device || null, command: variant.command, ...result,
    });
    writeText(join(outDir, `${String(results.length).padStart(2, "0")}-${variant.name.replace(/[^a-z0-9]+/gi, "-")}.log`), `${result.stdout}\n${result.stderr}`);
  }
  const failed = results.filter((result) => result.code !== 0);
  const lines = ["# QE test matrix", "", `- Variants: ${results.length}`, `- Passed: ${results.length - failed.length}`, `- Failed: ${failed.length}`, "", "## Results", ""];
  for (const result of results) lines.push(`- ${result.code === 0 ? "✅" : "❌"} **${result.name}** — ${result.durationMs} ms${result.role ? `; role=${result.role}` : ""}${result.browser ? `; browser=${result.browser}` : ""}${result.device ? `; device=${result.device}` : ""}`);
  const mdPath = writeText(join(outDir, "matrix.md"), lines.join("\n") + "\n");
  const jsonPath = writeJson(join(outDir, "matrix.json"), { config: args._[0], results });
  console.log(JSON.stringify({ report: mdPath, data: jsonPath, variants: results.length, failed: failed.length }));
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => { log.err(String(error.stack || error)); process.exit(1); });
