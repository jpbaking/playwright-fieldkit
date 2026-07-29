#!/usr/bin/env node
// inspect.mjs — Deep-inspect ONE page. Use this to reproduce a bug or fully
// understand a single screen. Captures: navigation timing/status, the complete
// console log, all page errors, failed/slow requests, the accessibility tree
// (the "screen-reader" view), extracted features, a full-page screenshot, and
// the rendered HTML.
//
// Usage:
//   node inspect.mjs <url> [options]
//
// Options:
//   --out <dir>          output dir              (default playwright-report-inspect)
//   --browser <name>     chromium | firefox | webkit
//   --headed             show the browser
//   --storage-state <f>  auth state JSON (inspect a logged-in page)
//   --device <name>      emulate a device, e.g. "iPhone 13"
//   --click <selector>   click this after load, then re-capture (repeatable)
//   --wait <ms>          settle time after load / after each click   (default 1500)
//   --full-page          full-page screenshot instead of viewport    (default on)
//   --a11y               include accessibility tree snapshot          (default on)
//   --html               save rendered HTML                           (default on)
//   --help

import { launch, gotoSafe } from "./lib/browser.mjs";
import { instrument } from "./lib/instrument.mjs";
import { extractPageFeatures } from "./lib/extract.mjs";
import {
  parseArgs, log, normalizeUrl, ensureDir, writeJson, writeText, resolveOut, join, slugifyUrl, redact, truncate,
} from "./lib/util.mjs";
import { createScope, installNavigationScope } from "./lib/scope.mjs";

const HELP = `inspect.mjs — deep-inspect one page (console, network, a11y tree, screenshot, HTML)

  node inspect.mjs <url> [--click <sel> ...] [--wait 1500] [--headed]
                   [--storage-state auth.json] [--out dir] [--browser chromium]`;

function toArray(v) {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// Console listener that keeps EVERYTHING (inspect is deliberately verbose).
function attachFullConsole(page, sink) {
  page.on("console", (msg) => sink.push({ type: msg.type(), text: redact(truncate(msg.text(), 1000)), location: msg.location() }));
}

function buildMarkdown({ url, nav, states, allConsole }) {
  const L = [];
  L.push(`# Page inspection: ${url}`);
  L.push("");
  L.push(`- **Status:** ${nav.ok ? nav.status : "NAVIGATION FAILED — " + nav.error}`);
  L.push(`- **Load time:** ${nav.ms} ms`);
  const errs = states.flatMap((s) => s.signals.errors);
  const reqs = states.flatMap((s) => s.signals.requests);
  L.push(`- **JS errors:** ${errs.length}  |  **Bad/failed requests:** ${reqs.length}  |  **Console lines:** ${allConsole.length}`);
  L.push("");

  if (errs.length) {
    L.push(`## JavaScript errors`);
    for (const e of errs) {
      L.push(`- ${truncate(e.message, 200)}`);
      if (e.stack) L.push(`  \`\`\`\n  ${truncate(e.stack, 400)}\n  \`\`\``);
    }
    L.push("");
  }
  if (reqs.length) {
    L.push(`## Failed / error-status / slow requests`);
    for (const r of reqs) L.push(`- \`${r.kind}\` ${r.method || ""} ${r.status || r.error || ""} ${truncate(r.url, 140)}`);
    L.push("");
  }
  const consoleErrs = allConsole.filter((c) => c.type === "error" || c.type === "warning");
  if (consoleErrs.length) {
    L.push(`## Console warnings & errors`);
    for (const c of consoleErrs.slice(0, 60)) L.push(`- \`${c.type}\` ${truncate(c.text, 200)}`);
    L.push("");
  }

  for (const s of states) {
    L.push(`## State: ${s.label}`);
    L.push(`- URL: ${redact(s.url)}`);
    const f = s.features;
    if (f) {
      L.push(`- Title: ${f.title}`);
      L.push(`- Counts: ${f.counts.links} links, ${f.counts.forms} forms, ${f.counts.buttons} buttons, ${f.counts.interactive} interactive, ${f.counts.iframes} iframes`);
      if (f.forms.length) {
        L.push(`- Forms:`);
        for (const form of f.forms) {
          L.push(`  - \`${form.method.toUpperCase()}\` ${form.action || "(no action)"} — fields: ${form.fields.map((x) => x.name || x.type).join(", ")}`);
        }
      }
      if (f.interactive.length) {
        L.push(`- Interactive: ${f.interactive.slice(0, 20).map((i) => `${i.role}${i.text ? `("${truncate(i.text, 20)}")` : ""}`).join(", ")}`);
      }
      if (f.links.length) {
        L.push(`- Link targets:`);
        for (const link of f.links.slice(0, 40)) {
          const label = truncate(link.text || "(no text)", 50);
          const declared = link.declaredHref && link.declaredHref !== link.href ? ` (declared: \`${truncate(redact(link.declaredHref), 80)}\`)` : "";
          const target = link.target ? `, target \`${link.target}\`` : "";
          const selector = link.selectorHint ? `, selector \`${truncate(redact(link.selectorHint), 100)}\`` : "";
          L.push(`  - "${label}" → ${truncate(redact(link.href), 140)}${declared}${target}${selector}`);
        }
      }
      if (f.flags.hiddenNav.length) {
        L.push(`- Hidden links in DOM: ${f.flags.hiddenNav.slice(0, 10).map((h) => truncate(h.text || h.href, 30)).join(", ")}`);
      }
    }
    if (s.screenshot) L.push(`- Screenshot: \`${s.screenshot}\``);
    L.push("");
  }
  return L.join("\n");
}

async function main() {
  const args = parseArgs();
  if (args.help || args._.length === 0) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  const url = normalizeUrl(args._[0]);
  if (!url) {
    log.err(`Not a valid URL: ${args._[0]}`);
    process.exit(1);
  }
  const scope = createScope(args);
  scope.assertAllowed(url, "Inspection URL");
  const outDir = resolveOut(args.out || "playwright-report-inspect");
  ensureDir(outDir);
  const wait = args.wait ?? 1500;
  const clicks = toArray(args.click);

  log.info(`Inspecting ${url}`);
  const { browser, context } = await launch(args);
  await installNavigationScope(context, scope);
  const page = await context.newPage();
  const collector = instrument(page);
  const allConsole = [];
  attachFullConsole(page, allConsole);

  const nav = await gotoSafe(page, url, { timeout: args.timeout ?? 30000 });
  await page.waitForTimeout(wait);

  const states = [];
  const capture = async (label) => {
    let features = null;
    try {
      features = await extractPageFeatures(page);
    } catch { /* page may be mid-navigation */ }
    const slug = slugifyUrl(url) + "-" + slugifyLabel(label);
    let screenshot = slug + ".png";
    await page.screenshot({ path: join(outDir, screenshot), fullPage: args["full-page"] !== false }).catch(() => (screenshot = null));
    if (args.a11y !== false) {
      // ariaSnapshot() is the "screen-reader view" of the page — the accessible
      // name/role tree a real user's assistive tech would announce. Redact it:
      // the tree carries visible text, which for a logged-in page may be personal.
      const tree = await page.locator("body").ariaSnapshot().catch(() => null);
      if (tree) writeText(join(outDir, slug + ".a11y.yaml"), redact(tree));
    }
    states.push({ label, url: redact(page.url()), features, screenshot, signals: collector.drain() });
  };

  await capture("initial load");

  for (const sel of clicks) {
    log.dim(`  clicking: ${sel}`);
    try {
      await page.locator(sel).first().click({ timeout: 8000 });
      await page.waitForTimeout(wait);
      await capture(`after click ${sel}`);
    } catch (e) {
      log.warn(`  click failed (${sel}): ${String(e.message || e).split("\n")[0]}`);
      states.push({ label: `after click ${sel} (FAILED)`, url: redact(page.url()), features: null, screenshot: null, signals: collector.drain() });
    }
  }

  if (args.html !== false) {
    const html = await page.content().catch(() => "");
    if (html) writeText(join(outDir, slugifyUrl(url) + ".html"), redact(html));
  }

  await browser.close();

  const md = buildMarkdown({ url, nav, states, allConsole });
  const mdPath = writeText(join(outDir, "inspect.md"), md);
  const jsonPath = writeJson(join(outDir, "inspect.json"), { url, scope: scope.metadata(), nav, states, console: allConsole });

  log.ok(`Report: ${mdPath}`);
  log.ok(`Data:   ${jsonPath}`);
  console.log(JSON.stringify({ report: mdPath, data: jsonPath, jsErrors: states.flatMap((s) => s.signals.errors).length }));
}

function slugifyLabel(s) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40).toLowerCase();
}

main().catch((e) => {
  log.err(String(e.stack || e));
  process.exit(1);
});
