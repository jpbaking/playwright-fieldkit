#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRobots, robotsMatcher } from "../lib/sitemap.mjs";
import { createScope } from "../lib/scope.mjs";
import { languageFromTestPath } from "../lib/gen-test.mjs";
import { auditPages, auditLinkCheck, insecureHops } from "../lib/audit.mjs";
import { redact } from "../lib/util.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(TEST_DIR, "..");
const SKILL_DIR = resolve(SCRIPTS_DIR, "..");
const WORKSPACE_ROOT = resolve(SKILL_DIR, "../../..");
const FIXTURE_DIR = join(TEST_DIR, "fixture");
const TEST_BROWSER = process.env.TEST_BROWSER || "chromium";

const ROUTES = new Map([
  ["/about.html", "about.html"],
  ["/added.html", "added.html"],
  ["/removed.html", "removed.html"],
  ["/private.html", "private.html"],
  ["/sitemap-only.html", "sitemap-only.html"],
  ["/flow.html", "flow.html"],
  ["/inspect.html", "inspect.html"],
  ["/final-target.html", "final-target.html"],
  ["/robots.txt", "robots.txt"],
  ["/sitemap.xml", "sitemap.xml"],
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(script, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [join(SCRIPTS_DIR, script), ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolveRun({ stdout, stderr });
      reject(new Error(`${script} exited ${code}\n${stderr}\n${stdout}`));
    });
  });
}

function runNode(entry, args, cwd = SCRIPTS_DIR) {
  return runCommand(process.execPath, [entry, ...args], cwd);
}

function runCommand(command, args, cwd = SCRIPTS_DIR) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolveRun({ stdout, stderr })
      : reject(new Error(`${command} exited ${code}\n${stderr}\n${stdout}`)));
  });
}

function runAndInterrupt(script, args, marker) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [join(SCRIPTS_DIR, script), ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let sent = false;
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (!sent && stderr.includes(marker)) {
        sent = true;
        child.kill("SIGINT");
      }
    });
    child.on("error", reject);
    child.on("close", (code) => code === 130 ? resolveRun() : reject(new Error(`expected interrupted exit 130, got ${code}\n${stderr}`)));
  });
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
}

function close(server) {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

async function main() {
  const parsedRobots = parseRobots(`
User-agent: ExampleBot
Disallow: /
User-agent: *
Disallow: /private
Allow: /private/public
`, "https://example.test", "PlaywrightFieldKit");
  const parsedMatcher = robotsMatcher(parsedRobots);
  assert(parsedMatcher("/private/secret"), "selected Disallow rule was not applied");
  assert(!parsedMatcher("/private/public"), "longest Allow rule did not take precedence");
  const rootMatcher = robotsMatcher(parseRobots("User-agent: *\nDisallow: /", "https://example.test"));
  assert(rootMatcher("/anything"), "site-wide Disallow rule was discarded");

  // A chain that leaves TLS and returns still ends 200, so the status alone hides it.
  const downgrade = ["https://site.test/blog", "http://site.test:8080/blog/", "https://site.test/blog/"];
  assert.deepEqual(insecureHops(downgrade), ["http://site.test:8080/blog/"], "plaintext redirect hop was not detected");
  assert.deepEqual(insecureHops(["https://site.test/a", "https://site.test/a/"]), [], "same-scheme redirect was reported as insecure");
  assert.deepEqual(insecureHops(["http://site.test/a", "http://site.test/a/"]), [], "plain-HTTP site was reported as a downgrade");
  const navAudit = auditPages([{ url: "https://site.test/blog", nav: { ok: true, status: 200, ms: 10, redirectChain: downgrade }, features: { lang: "en", headings: [{ level: 1, text: "x" }], landmarks: [{ tag: "main" }] } }], { pageLoadMs: 5000 });
  const navFinding = navAudit.find((entry) => entry.code === "insecure-redirect");
  assert(navFinding, "navigation downgrade was not audited");
  assert.equal(navFinding.severity, "high");
  assert.equal(navFinding.category, "security");
  const linkAudit = auditLinkCheck({ results: [{ url: "https://site.test/cv", redirects: [{ to: "http://site.test:8080/cv/" }, { to: "https://site.test/cv/" }] }] });
  assert.equal(linkAudit.length, 1, "link-check downgrade was not audited");
  assert.equal(linkAudit[0].code, "insecure-redirect");

  assert.equal(redact("Bearer tokens are expiring, shown once"), "Bearer tokens are expiring, shown once", "redaction mangled ordinary prose after the word Bearer");
  assert.equal(redact("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc-def"), "Authorization: Bearer [REDACTED]", "a real bearer token was not redacted");
  assert.equal(redact("Bearer nas_9fk2Lm4xQ7"), "Bearer [REDACTED]", "a token-shaped credential was not redacted");
  assert.equal(redact("contact ops@example.com"), "contact [REDACTED]", "email was not redacted");
  console.log("✓ audit units: insecure-redirect detection and bearer/email redaction");

  let variant = "baseline";
  let origin = "";
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, origin || "http://127.0.0.1").pathname;
    if (pathname === "/declared-target.html") {
      response.writeHead(302, { location: "/final-target.html", "cache-control": "no-store" });
      response.end();
      return;
    }
    if (pathname === "/external-redirect") {
      response.writeHead(302, { location: "https://example.invalid/outside", "cache-control": "no-store" });
      response.end();
      return;
    }
    if (pathname === "/head-fallback") {
      response.writeHead(request.method === "HEAD" ? 405 : 200, { "content-type": "text/plain", "cache-control": "no-store" });
      response.end(request.method === "HEAD" ? "" : "GET fallback worked");
      return;
    }
    const filename = pathname === "/" ? `index-${variant}.html` : ROUTES.get(pathname);
    if (!filename) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    let body = readFileSync(join(FIXTURE_DIR, filename), "utf8").replaceAll("{{ORIGIN}}", origin);
    const status = pathname === "/about.html" && variant === "current" ? 503 : 200;
    const type = filename.endsWith(".html")
      ? "text/html; charset=utf-8"
      : filename.endsWith(".xml")
        ? "application/xml; charset=utf-8"
        : "text/plain; charset=utf-8";
    response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    response.end(body);
  });

  const workDir = mkdtempSync(join(tmpdir(), "pw-playwright-fieldkit-test-"));
  let passed = false;
  try {
    await listen(server);
    const address = server.address();
    origin = `http://127.0.0.1:${address.port}`;

    const scopeConfig = join(workDir, "fieldkit.config.json");
    writeFileSync(scopeConfig, JSON.stringify({ allowedOrigins: ["127.0.0.1:*"] }));
    assert(createScope({ "scope-config": scopeConfig }).isAllowed(origin), "wildcard port scope did not allow the fixture origin");
    assert(createScope({ "scope-config": scopeConfig, "i-am-authorized": true }).isAllowed("https://example.invalid"), "explicit scope override was not honored");
    const pythonRecording = await run("record.mjs", [origin, "--output", join(workDir, "recording", "test_recorded.py"), "--scope-config", scopeConfig, "--dry-run"]);
    const pythonRecordCommand = JSON.parse(pythonRecording.stdout);
    assert.equal(pythonRecordCommand.target, "python-pytest", "Python recording did not select the pytest target");
    assert(pythonRecordCommand.args.some((arg) => arg.endsWith("playwright/cli.js")), "recorder omitted the bundled Playwright CLI");
    assert(pythonRecordCommand.args.includes("--target=python-pytest"), "recorder omitted the Python target argument");
    const nodeRecording = await run("record.mjs", [origin, "--output", join(workDir, "recording", "recorded.spec.ts"), "--scope-config", scopeConfig, "--dry-run"]);
    assert.equal(JSON.parse(nodeRecording.stdout).target, "playwright-test", "TypeScript recording did not select the Playwright Test target");
    await assert.rejects(
      run("record.mjs", [origin, "--output", join(workDir, "recording", "test_bad.py"), "--target", "playwright-test", "--scope-config", scopeConfig, "--dry-run"]),
      /does not match/,
      "recorder allowed a target/output language mismatch",
    );
    console.log("✓ recorder: scope, Python/Node targets, and mismatch rejection");
    await assert.rejects(
      run("inspect.mjs", ["https://example.invalid", "--scope-config", scopeConfig]),
      /outside the authorization allowlist/,
      "authorization allowlist did not reject an unrelated host",
    );
    const scopeRedirectDir = join(workDir, "scope-redirect");
    await run("inspect.mjs", [`${origin}/external-redirect`, "--scope-config", scopeConfig, "--wait", "0", "--no-a11y", "--no-html", "--browser", TEST_BROWSER, "--out", scopeRedirectDir]);
    assert.equal(readJson(join(scopeRedirectDir, "inspect.json")).nav.ok, false, "navigation guard allowed a redirect outside the scope");

    const baselineDir = join(workDir, "baseline");
    await run("crawl.mjs", [
      origin,
      "--depth", "1",
      "--max-pages", "20",
      "--respect-robots",
      "--delay", "5",
      "--check-links",
      "--link-delay", "0",
      "--audit-page-ms", "0",
      "--scope-config", scopeConfig,
      "--no-screenshots",
      "--browser", TEST_BROWSER,
      "--out", baselineDir,
    ]);
    const baseline = readJson(join(baselineDir, "crawl.json"));
    const baselinePaths = new Set(baseline.pages.map((page) => new URL(page.url).pathname));
    assert.equal(baseline.config.respectRobots, true);
    assert.equal(baseline.config.delay, 5);
    assert.equal(baseline.scope.enabled, true);
    assert(baselinePaths.has("/removed.html"), "baseline-only linked page was not crawled");
    assert(baselinePaths.has("/sitemap-only.html"), "sitemap-only page was not seeded");
    assert(!baselinePaths.has("/private.html"), "robots-disallowed page was crawled");
    assert(Array.isArray(baseline.audit), "crawl JSON omitted deterministic audit findings");
    assert(baseline.audit.some((entry) => entry.code === "unlabeled-control" && entry.url.endsWith("/flow.html")), "unlabeled form control was not audited");
    assert(baseline.audit.some((entry) => entry.code === "slow-page"), "configured page performance threshold was not audited");
    assert.equal(baseline.linkCheck.broken, 1, "broken linked asset was not reported");

    const charterSource = join(workDir, "journey-source.json");
    writeFileSync(charterSource, readFileSync(resolve(SKILL_DIR, "templates", "journey.example.json"), "utf8").replace("https://staging.example.com/cart", `${origin}/flow.html`));
    const charterDir = join(workDir, "journey");
    await run("charter.mjs", [charterSource, "--out", charterDir]);
    const charter = readJson(join(charterDir, "journey.json"));
    assert(charter.outcomes.length >= 1, "journey charter omitted outcomes");
    assert.equal(charter.destructive, false);

    const coverageTest = join(workDir, "test_existing.py");
    writeFileSync(coverageTest, `def test_existing(page):\n    page.goto("/flow.html")\n`);
    const coverageDir = join(workDir, "coverage");
    await run("coverage.mjs", [baselineDir, coverageTest, "--out", coverageDir]);
    const coverage = readJson(join(coverageDir, "coverage-gaps.json"));
    assert(coverage.coveredRoutes.includes("/flow.html"), "coverage analysis missed literal navigation");
    assert(coverage.uncoveredRoutes.includes("/removed.html"), "coverage analysis omitted an uncovered crawl route");

    const matrixSource = join(workDir, "matrix-source.json");
    writeFileSync(matrixSource, JSON.stringify({ variants: [
      { name: "customer-chromium", role: "customer", browser: "chromium", command: [process.execPath, "-e", "process.exit(0)"] },
      { name: "admin-firefox", role: "admin", browser: "firefox", command: [process.execPath, "-e", "process.exit(0)"] },
    ] }));
    const matrixDir = join(workDir, "matrix");
    await run("matrix.mjs", [matrixSource, "--out", matrixDir]);
    assert.equal(readJson(join(matrixDir, "matrix.json")).results.length, 2, "matrix runner omitted variants");

    const triageDir = join(workDir, "triage");
    await assert.rejects(
      run("triage.mjs", ["--runs", "4", "--out", triageDir, "--", process.execPath, join(FIXTURE_DIR, "flaky-command.mjs"), join(workDir, "flaky-state.txt")]),
      /exited 1/,
      "flake triage did not preserve a failing exit",
    );
    const triage = readJson(join(triageDir, "triage.json"));
    assert.equal(triage.status, "flaky", "flake triage did not classify mixed results");
    assert.equal(triage.categories["locator-or-readiness"], 2, "flake triage did not classify locator failures");
    console.log("✓ QE artifacts: charter, coverage gaps, matrix, and flake triage");
    assert(baseline.linkCheck.results.some((entry) => entry.url.endsWith("/missing-audit-asset.png") && entry.broken), "broken asset detail was omitted");
    assert(baseline.linkCheck.results.some((entry) => entry.url.endsWith("/head-fallback") && entry.method === "GET" && entry.status === 200), "HEAD-to-GET fallback was not exercised");
    assert(baseline.linkCheck.results.some((entry) => entry.url === "https://example.invalid/outside" && entry.skipped), "out-of-scope external link was not skipped");
    assert(baseline.linkCheck.results.some((entry) => entry.url.endsWith("/declared-target.html") && entry.redirects.length === 1), "link redirect chain was not captured");
    const removed = baseline.pages.find((page) => new URL(page.url).pathname === "/removed.html");
    assert(removed.signals.console.some((entry) => entry.text.includes("baseline-only fixture error")), "console error was not captured");
    console.log("✓ crawl: links, sitemap, robots, delay, and console findings");

    const resumeDir = join(workDir, "resume");
    const resumeArgs = [origin, "--depth", "1", "--max-pages", "2", "--no-sitemap", "--no-screenshots", "--checkpoint-every", "1", "--browser", TEST_BROWSER, "--out", resumeDir];
    await runAndInterrupt("crawl.mjs", resumeArgs, `d0 ${origin}`);
    assert.equal(readJson(join(resumeDir, ".crawl-state.json")).version, 1, "interrupted crawl did not write a checkpoint");
    await run("crawl.mjs", [...resumeArgs, "--resume"]);
    assert.equal(readJson(join(resumeDir, "crawl.json")).pageCount, 2, "resumed crawl did not finish its remaining queue");
    assert.throws(() => readFileSync(join(resumeDir, ".crawl-state.json")), /ENOENT/, "successful resume did not remove its checkpoint");
    console.log("✓ scope guard and crawl checkpoint/resume");

    const inspectDir = join(workDir, "inspect");
    await run("inspect.mjs", [
      `${origin}/inspect.html`,
      "--click", "#trigger",
      "--click", "a[href=\"/declared-target.html\"]",
      "--wait", "25",
      "--no-a11y",
      "--no-html",
      "--browser", TEST_BROWSER,
      "--out", inspectDir,
    ]);
    const inspection = readJson(join(inspectDir, "inspect.json"));
    assert.equal(inspection.states.length, 3);
    assert(inspection.console.some((entry) => entry.text.includes("clicked fixture error")), "post-click console error was not captured");
    const inspectedLink = inspection.states[0].features.links.find((link) => link.text === "Misdirected link fixture");
    assert(inspectedLink, "inspection did not expose the source link");
    assert.equal(inspectedLink.declaredHref, "/declared-target.html");
    assert.equal(inspectedLink.selectorHint, 'a[href="/declared-target.html"]');
    assert.equal(new URL(inspection.states[2].url).pathname, "/final-target.html");
    const redirectDir = join(workDir, "redirect-chain");
    await run("inspect.mjs", [`${origin}/declared-target.html`, "--wait", "0", "--no-a11y", "--no-html", "--browser", TEST_BROWSER, "--out", redirectDir]);
    const redirectNav = readJson(join(redirectDir, "inspect.json")).nav;
    assert.deepEqual(
      redirectNav.redirectChain.map((entry) => new URL(entry).pathname),
      ["/declared-target.html", "/final-target.html"],
      "navigation redirect chain was not captured",
    );
    assert.deepEqual(insecureHops(redirectNav.redirectChain), [], "same-scheme fixture redirect was flagged as insecure");
    const inspectMarkdown = readFileSync(join(inspectDir, "inspect.md"), "utf8");
    assert(inspectMarkdown.includes("Link targets:"), "inspection report omitted link targets");
    assert(inspectMarkdown.includes(`${origin}/final-target.html`), "inspection report omitted the post-redirect URL");
    console.log("✓ inspect: link target, selector, redirect URL, and console capture");

    const flowPath = join(workDir, "flow.json");
    assert.equal(languageFromTestPath("tests/test_login.py"), "python");
    assert.equal(languageFromTestPath("tests/login.spec.ts"), "typescript");
    assert.throws(() => languageFromTestPath("tests/login.txt"), /Cannot infer/);
    const flowSource = readFileSync(join(FIXTURE_DIR, "flow.json"), "utf8").replaceAll("{{ORIGIN}}", origin);
    writeFileSync(flowPath, flowSource);
    const flowDir = join(workDir, "flow");
    const specPath = join(flowDir, "generated.spec.ts");
    await run("flow.mjs", [flowPath, "--wait", "0", "--browser", TEST_BROWSER, "--out", flowDir, "--gen-test", specPath]);
    const flow = readJson(join(flowDir, "flow.json"));
    assert.equal(flow.passed, true);
    assert.equal(flow.results.length, 14);
    const spec = readFileSync(specPath, "utf8");
    for (const expected of ["page.route('**/api/unavailable'", "route.abort('failed')", ".hover()", ".scrollIntoViewIfNeeded()", ".toHaveValue('verified')", ".toHaveCount(2)", ".toBeHidden()", "accessibility state completed flow", "page.waitForURL(/\\/final-target\\.html/)", "toHaveURL(/\\/final-target\\.html/)"])
      assert(spec.includes(expected), `generated spec omitted ${expected}`);
    new Function(spec.replace(/^import .*$/m, "let test, expect;")); // regression: URL regexes with slashes must stay syntactically valid
    if (process.env.EXECUTE_GENERATED_TEST === "1") {
      const cli = join(SCRIPTS_DIR, "node_modules", "@playwright", "test", "cli.js");
      symlinkSync(join(SCRIPTS_DIR, "node_modules"), join(workDir, "node_modules"), "dir");
      const configPath = join(flowDir, "playwright.generated.config.mjs");
      writeFileSync(configPath, `export default ${JSON.stringify({ testDir: flowDir, reporter: "line", workers: 1, use: { baseURL: origin }, projects: [{ name: TEST_BROWSER, use: { browserName: TEST_BROWSER } }] }, null, 2)};\n`);
      await runNode(cli, ["test", specPath, "--config", configPath], flowDir);
      console.log(`✓ generated spec: executed with @playwright/test (${TEST_BROWSER})`);
    }

    const pythonFlowDir = join(workDir, "flow-python");
    const pythonSpecPath = join(pythonFlowDir, "test_generated.py");
    await run("flow.mjs", [flowPath, "--wait", "0", "--browser", TEST_BROWSER, "--out", pythonFlowDir, "--gen-test", pythonSpecPath]);
    const pythonSpec = readFileSync(pythonSpecPath, "utf8");
    for (const expected of ["from playwright.sync_api import Page, expect", "page.route(\"**/api/unavailable\"", "route.abort(\"failed\")", ".hover()", ".scroll_into_view_if_needed()", ".to_have_value(\"verified\")", ".to_have_count(2)", ".to_be_hidden()", "accessibility state completed flow", "wait_for_url(re.compile(re.escape(\"/final-target.html\")))", "to_have_url(re.compile(re.escape(\"/final-target.html\")))"])
      assert(pythonSpec.includes(expected), `generated Python test omitted ${expected}`);
    if (process.env.EXECUTE_GENERATED_PYTHON_TEST === "1") {
      const python = process.env.PYTHON_EXECUTABLE || "python3";
      await runCommand(python, ["-m", "pytest", pythonSpecPath, "--base-url", origin, "--browser", TEST_BROWSER], pythonFlowDir);
      console.log(`✓ generated Python test: executed with pytest-playwright (${TEST_BROWSER})`);
    }
    console.log("✓ flow: extended operations and TypeScript/Python assertions");

    const authFlowPath = join(workDir, "login-flow.json");
    writeFileSync(authFlowPath, JSON.stringify({ baseUrl: origin, steps: [
      { goto: "/flow.html" },
      { fill: "#query", value: "fieldkit" },
      { expectValue: "#query", value: "fieldkit" },
    ] }));
    const authOut = join(workDir, "auth", "auth.json");
    await run("save-auth.mjs", ["--flow", authFlowPath, "--out", authOut, "--browser", TEST_BROWSER, "--scope-config", scopeConfig]);
    assert(Array.isArray(readJson(authOut).cookies), "scripted save-auth did not write a storage state");
    const badAuthFlowPath = join(workDir, "bad-login-flow.json");
    writeFileSync(badAuthFlowPath, JSON.stringify({ baseUrl: origin, steps: [{ goto: "/flow.html" }, { frobnicate: "#x" }] }));
    await assert.rejects(
      run("save-auth.mjs", ["--flow", badAuthFlowPath, "--out", join(workDir, "auth", "bad.json"), "--browser", TEST_BROWSER, "--scope-config", scopeConfig]),
      /exactly one supported action/,
      "save-auth did not reject a flow with an unsupported action",
    );
    console.log("✓ save-auth: scripted flow runs shared step vocabulary and rejects unknown actions");

    variant = "current";
    const currentDir = join(workDir, "current");
    await run("crawl.mjs", [
      origin,
      "--depth", "1",
      "--max-pages", "20",
      "--respect-robots",
      "--no-screenshots",
      "--browser", TEST_BROWSER,
      "--out", currentDir,
    ]);
    const compareDir = join(workDir, "compare");
    await run("compare.mjs", [baselineDir, currentDir, "--out", compareDir]);
    const comparison = readJson(join(compareDir, "compare.json"));
    assert(comparison.onlyInCur.some((url) => url.endsWith("/added.html")), "new page was not reported");
    assert(comparison.onlyInBase.some((url) => url.endsWith("/removed.html")), "removed page was not reported");
    assert(comparison.statusChanges.some((entry) => entry.url.endsWith("/about.html") && entry.from === 200 && entry.to === 503), "status regression was not reported");
    assert(comparison.errorRegressions.some((entry) => new URL(entry.url).pathname === "/"), "new shared-page error was not reported");
    assert(comparison.formChanges.some((entry) => new URL(entry.url).pathname === "/" && entry.addedForms.length === 1), "new form was not reported");
    console.log("✓ compare: pages, status, errors, forms, and structure");

    const rule = readFileSync(resolve(WORKSPACE_ROOT, ".clinerules", "pw-playwright-fieldkit.md"), "utf8");
    const shortcutDir = resolve(WORKSPACE_ROOT, ".clinerules", "workflows");
    const canonicalWorkflowDir = resolve(SKILL_DIR, "references", "workflows");
    const shortcutNames = readdirSync(shortcutDir).filter((name) => name.endsWith(".md")).sort();
    const debugWorkflow = readFileSync(resolve(SKILL_DIR, "references", "workflows", "pw-debug-site.md"), "utf8");
    const recordWorkflow = readFileSync(resolve(SKILL_DIR, "references", "workflows", "pw-record-flow.md"), "utf8");
    assert.match(rule, /activate the\s+`pw-playwright-fieldkit` skill/, "always-on rule omitted skill activation");
    assert(rule.includes("do not merely tell the user"), "always-on rule does not require workflow execution");
    assert.equal(shortcutNames.length, 14, "expected all browser and QE shortcuts");
    for (const name of shortcutNames) {
      const shortcut = readFileSync(resolve(shortcutDir, name), "utf8");
      readFileSync(resolve(canonicalWorkflowDir, name), "utf8");
      assert(shortcut.includes(`references/workflows/${name}`), `${name} does not route to its canonical workflow`);
    }
    assert(debugWorkflow.includes("Step 2C — If links or navigation targets are wrong"), "canonical debug workflow omitted link-target procedure");
    assert(recordWorkflow.includes("Launch and wait for the user"), "canonical record workflow omitted the interactive handoff");
    console.log("✓ Cline packaging: skill router, 14 shortcuts, and canonical workflows");

    passed = true;
    console.log("\nAll Playwright FieldKit self-tests passed.");
  } catch (error) {
    error.message += `\nTest artifacts retained at ${workDir}`;
    throw error;
  } finally {
    await close(server).catch(() => {});
    if (passed) rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
