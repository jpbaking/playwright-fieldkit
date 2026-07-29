#!/usr/bin/env node
// crawl.mjs — Walk a website "as a user": follow same-origin links breadth-first,
// and on every page record navigation status, console errors, failed/slow network
// requests, unexpected dialogs, forms, buttons, and interactive/hidden features.
// Emits a JSON dataset, a ranked Markdown report, and per-page screenshots.
//
// Usage:
//   node crawl.mjs <startUrl> [options]
//
// Common options:
//   --depth <n>          link depth to follow from start        (default 2)
//   --max-pages <n>      hard cap on pages visited               (default 40)
//   --out <dir>          output directory            (default playwright-report-explore)
//   --browser <name>     chromium | firefox | webkit             (default chromium)
//   --headed             show the browser window
//   --storage-state <f>  auth state JSON to load (logged-in crawl)
//   --include <regex>    only visit URLs whose path matches
//   --exclude <regex>    never visit URLs whose path matches
//   --same-path          stay under the start URL's path prefix
//   --device <name>      emulate a device, e.g. "iPhone 13"
//   --spa                also click links/buttons to find client-rendered routes
//   --no-sitemap         skip robots.txt / sitemap.xml seeding
//   --no-aria            skip per-page accessibility snapshot (used by compare.mjs)
//   --respect-robots     honor robots.txt Disallow rules (skip those paths)
//   --delay <ms>         pause between page loads (be polite to the server)
//   --check-links        validate discovered HTTP(S) links and assets
//   --resume             continue <out>/.crawl-state.json with compatible options
//   --scope-config <f>   authorization allowlist (otherwise auto-discovered)
//   --i-am-authorized    explicitly override and record an active allowlist
//   --screenshots        capture a screenshot per page           (default on)
//   --no-screenshots     disable screenshots (faster)
//   --wait <ms>          extra settle time after each load        (default 0)
//   --timeout <ms>       per-navigation timeout                   (default 30000)
//   --help
//
// See docs/reference/cli.md from the project root for full CLI documentation.

import { launch, gotoSafe } from "./lib/browser.mjs";
import { instrument } from "./lib/instrument.mjs";
import { extractPageFeatures } from "./lib/extract.mjs";
import { discover as discoverSitemap, robotsMatcher } from "./lib/sitemap.mjs";
import { discoverSpaRoutes } from "./lib/spa.mjs";
import { buildReport } from "./lib/reporter.mjs";
import { createScope, installNavigationScope } from "./lib/scope.mjs";
import { checkLinks } from "./lib/links.mjs";
import { existsSync, readFileSync, rmSync } from "node:fs";
import {
  parseArgs, log, normalizeUrl, sameOrigin, isAssetUrl, slugifyUrl,
  ensureDir, writeJson, writeText, resolveOut, join, redact,
} from "./lib/util.mjs";

const HELP = `crawl.mjs — walk a site as a user and report problems, features, and forms

  node crawl.mjs <startUrl> [--depth 2] [--max-pages 40] [--out dir]
                 [--browser chromium] [--headed] [--storage-state auth.json]
                 [--device "iPhone 13"] [--spa] [--no-sitemap]
                 [--respect-robots] [--delay 0]
                 [--check-links] [--resume] [--scope-config file]
                 [--include <regex>] [--exclude <regex>] [--same-path]
                 [--no-screenshots] [--wait 0] [--timeout 30000]

Outputs into <out>/: report.md (read this first), crawl.json, screenshots/.`;

async function main() {
  const args = parseArgs();
  if (args.help || args._.length === 0) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const startUrl = normalizeUrl(args._[0]);
  if (!startUrl) {
    log.err(`Not a valid URL: ${args._[0]}`);
    process.exit(1);
  }
  const scope = createScope(args);
  scope.assertAllowed(startUrl, "Start URL");

  const config = {
    depth: args.depth ?? 2,
    maxPages: args["max-pages"] ?? 40,
    browser: args.browser || "chromium",
    screenshots: args.screenshots !== false,
    wait: args.wait ?? 0,
    timeout: args.timeout ?? 30000,
    include: args.include ? new RegExp(args.include) : null,
    exclude: args.exclude ? new RegExp(args.exclude) : null,
    samePath: !!args["same-path"],
    sitemap: args.sitemap !== false,
    device: args.device || null,
    spa: !!args.spa,
    aria: args.aria !== false,
    respectRobots: !!args["respect-robots"],
    delay: args.delay ?? 0,
    auditPageMs: args["audit-page-ms"] ?? 5000,
    auditRequestMs: args["audit-request-ms"] ?? 3000,
    checkLinks: !!args["check-links"],
    linkConcurrency: args["link-concurrency"] ?? 4,
    linkDelay: args["link-delay"] ?? 100,
    linkTimeout: args["link-timeout"] ?? 15000,
  };
  const outDir = resolveOut(args.out);
  const shotDir = ensureDir(join(outDir, "screenshots"));
  const checkpointPath = join(outDir, ".crawl-state.json");
  const checkpointEvery = Math.max(1, Number(args["checkpoint-every"] ?? 5));
  const resumeKey = JSON.stringify({
    ...config,
    include: config.include?.source || null,
    exclude: config.exclude?.source || null,
    storageState: args["storage-state"] || null,
    scope: scope.metadata(),
  });
  const startPathPrefix = new URL(startUrl).pathname.replace(/\/[^/]*$/, "/");
  // Populated after robots.txt is fetched below; used only when --respect-robots.
  let isRobotsBlocked = () => false;
  const robotsSkipped = new Map();

  const shouldVisit = (url) => {
    if (!sameOrigin(url, startUrl)) return false;
    if (isAssetUrl(url)) return false;
    const path = new URL(url).pathname + new URL(url).search;
    if (config.respectRobots && isRobotsBlocked(path)) {
      const matched = isRobotsBlocked.match?.(path);
      robotsSkipped.set(url, matched ? { url, rule: matched.rule, type: matched.type } : { url });
      return false;
    }
    if (config.samePath && !path.startsWith(startPathPrefix)) return false;
    if (config.include && !config.include.test(path)) return false;
    if (config.exclude && config.exclude.test(path)) return false;
    return true;
  };

  log.info(`Crawling ${startUrl} (depth ${config.depth}, max ${config.maxPages} pages, ${config.browser})`);
  const { browser, context } = await launch({ ...args, browser: config.browser });
  await installNavigationScope(context, scope);
  const page = await context.newPage();
  const collector = instrument(page);

  let seen = new Set([startUrl]);
  let queue = [{ url: startUrl, depth: 0 }];
  let pages = [];
  let startedAt = Date.now();

  // Fetch robots.txt + sitemap.xml before link-crawling. These surface unlinked
  // routes and the site's Disallow list. We also need robots for --respect-robots
  // even when sitemap seeding is disabled.
  let robots = { disallow: [], sitemaps: [] };
  let sitemapSeeded = 0;
  if (args.resume) {
    if (!existsSync(checkpointPath)) throw new Error(`No crawl checkpoint found at ${checkpointPath}`);
    const state = JSON.parse(readFileSync(checkpointPath, "utf8"));
    if (state.version !== 1 || state.startUrl !== startUrl || state.resumeKey !== resumeKey) {
      throw new Error(`Checkpoint is incompatible with this URL or crawl configuration: ${checkpointPath}`);
    }
    seen = new Set(state.seen);
    queue = state.queue;
    pages = state.pages;
    startedAt = state.startedAt;
    robots = state.robots || robots;
    sitemapSeeded = state.sitemapSeeded || 0;
    if (config.respectRobots) isRobotsBlocked = robotsMatcher(robots);
    for (const item of robots.skipped || []) robotsSkipped.set(item.url, item);
    log.info(`Resuming ${pages.length} completed page(s) with ${queue.length} queued.`);
  } else if (config.sitemap || config.respectRobots) {
    const found = await discoverSitemap(context, startUrl, { max: config.maxPages * 4, userAgent: args.userAgent || "PlaywrightFieldKit" });
    robots = found.robots;
    // Build the robots matcher first so it applies to the sitemap seeds too.
    if (config.respectRobots) isRobotsBlocked = robotsMatcher(robots);
    if (config.sitemap) {
      for (const url of found.urls) {
        if (seen.has(url) || !shouldVisit(url)) continue;
        seen.add(url);
        // depth 1 so they get visited but don't trigger a full-depth expansion.
        queue.push({ url, depth: 1 });
        sitemapSeeded++;
      }
    }
    if (found.sources.length) log.info(`Sitemap/robots: seeded ${sitemapSeeded} URLs, ${robots.disallow.length} Disallow paths${config.respectRobots ? " (honoring them)" : ""} (from ${found.sources.length} source[s])`);
  }

  let active = null;
  const saveCheckpoint = () => writeJson(checkpointPath, {
    version: 1, startUrl, resumeKey, startedAt, seen: [...seen], queue: active ? [active, ...queue] : queue, pages,
    robots: { ...robots, skipped: [...robotsSkipped.values()] }, sitemapSeeded,
  });
  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
    saveCheckpoint();
    log.warn(`Interrupt received; checkpoint saved to ${checkpointPath}`);
  };
  process.once("SIGINT", onSigint);

  while (queue.length && pages.length < config.maxPages && !interrupted) {
    const { url, depth } = queue.shift();
    active = { url, depth };
    collector.drain(); // clear per-page buffers
    // Rate-limit: pause between navigations to be polite to the server.
    if (config.delay && pages.length > 0) await page.waitForTimeout(config.delay);
    log.dim(`  → [${pages.length + 1}/${config.maxPages}] d${depth} ${url}`);

    const nav = await gotoSafe(page, url, { timeout: config.timeout });
    if (config.wait) await page.waitForTimeout(config.wait);
    if (interrupted) {
      collector.drain();
      break;
    }

    let features = null;
    if (nav.ok) {
      try {
        features = await extractPageFeatures(page);
      } catch (e) {
        log.warn(`  feature extraction failed: ${String(e.message || e).split("\n")[0]}`);
      }
    }

    let screenshot = null;
    if (config.screenshots && nav.ok) {
      screenshot = join("screenshots", slugifyUrl(url) + ".png");
      await page.screenshot({ path: join(outDir, screenshot), fullPage: false }).catch(() => (screenshot = null));
    }

    // The accessibility tree is a compact structural fingerprint of the page —
    // compare.mjs diffs it between runs to catch structural regressions.
    let aria = null;
    if (config.aria && nav.ok) {
      // Redact before it lands in crawl.json — the a11y tree contains visible page
      // text, which on an authenticated crawl can include the user's name/email.
      const raw = await page.locator("body").ariaSnapshot().catch(() => null);
      aria = raw ? redact(raw) : null;
    }

    const signals = collector.drain();
    pages.push({ url, depth, nav, features, signals, screenshot, aria });

    // Enqueue newly discovered same-origin links.
    if (features && depth < config.depth) {
      for (const link of features.links) {
        const norm = normalizeUrl(link.href, url);
        if (!norm || seen.has(norm) || !shouldVisit(norm)) continue;
        seen.add(norm);
        queue.push({ url: norm, depth: depth + 1 });
      }
      // In SPA mode, also click navigation-role elements to find client-rendered
      // routes that have no <a href>. Slower (re-loads between clicks), opt-in.
      if (config.spa) {
        const spaRoutes = await discoverSpaRoutes(page, url, gotoSafe).catch(() => []);
        for (const norm of spaRoutes) {
          if (seen.has(norm) || !shouldVisit(norm)) continue;
          seen.add(norm);
          queue.push({ url: norm, depth: depth + 1 });
        }
        if (spaRoutes.length) log.dim(`    spa: found ${spaRoutes.length} client-rendered route(s)`);
      }
    }
    active = null;
    if (pages.length % checkpointEvery === 0 && (queue.length || pages.length < config.maxPages)) saveCheckpoint();
  }

  if (interrupted) {
    saveCheckpoint();
    await browser.close();
    process.removeListener("SIGINT", onSigint);
    process.exit(130);
  }
  process.removeListener("SIGINT", onSigint);

  robots.skipped = [...robotsSkipped.values()];
  const linkCheck = config.checkLinks
    ? await checkLinks(context, pages, scope, { concurrency: config.linkConcurrency, delay: config.linkDelay, timeout: config.linkTimeout })
    : null;
  const finishedAt = Date.now();
  await browser.close();

  const report = buildReport({ startUrl, pages, queueSeen: seen.size, startedAt, finishedAt, config, robots, sitemapSeeded, linkCheck });
  const jsonPath = writeJson(join(outDir, "crawl.json"), {
    startUrl, config, scope: scope.metadata(), startedAt, finishedAt, pageCount: pages.length, urlsDiscovered: seen.size, sitemapSeeded, robots, linkCheck, audit: report.audit, pages,
  });
  const mdPath = writeText(join(outDir, "report.md"), report.markdown);
  rmSync(checkpointPath, { force: true });

  log.ok(`Visited ${pages.length} pages. ${report.findings.filter((f) => f.severity === "error").length} pages with errors, ${report.forms.length} forms.`);
  log.ok(`Report:  ${mdPath}`);
  log.ok(`Data:    ${jsonPath}`);
  if (config.screenshots) log.ok(`Screens: ${shotDir}/`);
  // Machine-readable one-liner on stdout for scripting.
  console.log(JSON.stringify({ report: mdPath, data: jsonPath, pages: pages.length, errors: report.findings.filter((f) => f.severity === "error").length, forms: report.forms.length, brokenLinks: linkCheck?.broken ?? null }));
}

main().catch((e) => {
  log.err(String(e.stack || e));
  process.exit(1);
});
