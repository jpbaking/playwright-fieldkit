#!/usr/bin/env node
// Repeat one test command, preserve each run's output, and classify intermittent
// failure signals without hiding them behind retries.

import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { join, log, parseArgs, resolveOut, truncate, writeJson, writeText } from "./lib/util.mjs";

function splitArgs(argv) {
  const separator = argv.indexOf("--");
  if (separator < 0) return { options: parseArgs(argv), command: [] };
  return { options: parseArgs(argv.slice(0, separator)), command: argv.slice(separator + 1) };
}

function classify(output) {
  const text = output.toLowerCase();
  if (/strict mode|locator|element.*(?:not found|not visible)|waiting for.*selector/.test(text)) return "locator-or-readiness";
  if (/timeout|timed out|networkidle/.test(text)) return "timing";
  if (/econn|err_|net::|\b50[0-9]\b|connection|socket|dns/.test(text)) return "network-or-backend";
  if (/unique constraint|duplicate key|already exists|test data|fixture/.test(text)) return "shared-test-data";
  if (/browser.*(?:closed|crash)|target closed|out of memory|worker.*exit/.test(text)) return "browser-or-infrastructure";
  if (/expect|assert|expected|actual/.test(text)) return "product-or-assertion";
  return "unknown";
}

function artifacts(root, since) {
  if (!root) return [];
  const found = [];
  const walk = (path) => {
    try {
      const stat = statSync(path);
      if (stat.isDirectory()) for (const name of readdirSync(path)) walk(join(path, name));
      else if (stat.mtimeMs >= since) found.push(path);
    } catch {}
  };
  walk(resolve(root));
  return found;
}

function execute(command, timeoutMs) {
  return new Promise((resolveRun, reject) => {
    const started = Date.now();
    const child = spawn(command[0], command.slice(1), { env: { ...process.env, FORCE_COLOR: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveRun({ code: timedOut ? 124 : (code ?? 1), timedOut, durationMs: Date.now() - started, stdout, stderr });
    });
  });
}

async function main() {
  const { options: args, command } = splitArgs(process.argv.slice(2));
  if (args.help || !command.length) {
    console.log("triage.mjs — node triage.mjs [--runs 5] [--timeout 120000] [--artifacts dir] [--out report/triage] -- <test command...>");
    process.exit(args.help ? 0 : 1);
  }
  const runs = Number(args.runs ?? 5);
  const timeoutMs = Number(args.timeout ?? 120000);
  if (!Number.isInteger(runs) || runs < 2 || runs > 50) { log.err("--runs must be an integer from 2 to 50."); process.exit(1); }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) { log.err("--timeout must be at least 1000 ms."); process.exit(1); }

  const outDir = resolveOut(args.out || "report/triage");
  const results = [];
  for (let index = 0; index < runs; index++) {
    log.info(`Triage run ${index + 1}/${runs}`);
    const started = Date.now();
    const result = await execute(command, timeoutMs);
    const combined = `${result.stdout}\n${result.stderr}`;
    const runArtifacts = artifacts(args.artifacts, started);
    const classification = result.code === 0 ? null : classify(combined);
    results.push({ run: index + 1, ...result, classification, artifacts: runArtifacts });
    writeText(join(outDir, `run-${String(index + 1).padStart(2, "0")}.log`), combined);
  }
  const passes = results.filter((result) => result.code === 0).length;
  const failures = results.length - passes;
  const status = passes === runs ? "consistent-pass" : failures === runs ? "consistent-fail" : "flaky";
  const categories = {};
  for (const result of results) if (result.classification) categories[result.classification] = (categories[result.classification] || 0) + 1;
  const lines = [
    "# Flaky-test triage", "",
    `- **Status:** ${status}`,
    `- **Command:** \`${command.join(" ")}\``,
    `- **Runs:** ${runs}; passed ${passes}; failed ${failures}`, "",
    "## Run results", "",
    ...results.map((result) => `- ${result.code === 0 ? "✅" : "❌"} run ${result.run}: exit ${result.code}, ${result.durationMs} ms${result.classification ? `, ${result.classification}` : ""}${result.artifacts.length ? `, artifacts: ${result.artifacts.join(", ")}` : ""}`), "",
    "## Failure categories", "",
    ...(Object.keys(categories).length ? Object.entries(categories).map(([name, count]) => `- ${name}: ${count}`) : ["_None._"]), "",
    "## Recommended next action", "",
    status === "flaky"
      ? "Re-run the failing case with trace-on-failure, compare failing and passing logs, and fix the identified readiness/data/network cause. Do not mask it with retries."
      : status === "consistent-fail"
        ? "Treat this as a reproducible product, assertion, environment, or data failure; inspect the first failing log and runner trace."
        : "No intermittent failure reproduced. Increase runs only when the original failure frequency justifies the cost.", "",
    failures ? `First failure excerpt: \`${truncate((results.find((result) => result.code !== 0).stderr || results.find((result) => result.code !== 0).stdout).replace(/\s+/g, " "), 300)}\`` : "", "",
  ];
  const mdPath = writeText(join(outDir, "triage.md"), lines.join("\n"));
  const jsonPath = writeJson(join(outDir, "triage.json"), { command, status, passes, failures, categories, results });
  console.log(JSON.stringify({ report: mdPath, data: jsonPath, status, passes, failures }));
  process.exit(failures ? 1 : 0);
}

main().catch((error) => { log.err(String(error.stack || error)); process.exit(1); });
