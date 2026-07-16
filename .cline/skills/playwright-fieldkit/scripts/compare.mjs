#!/usr/bin/env node
// compare.mjs — Diff two crawl.json runs. Answers "what changed?" between two
// crawls, which powers three big use cases:
//   1. Regression detection  — crawl before and after a deploy; catch new errors,
//      status regressions, disappeared pages, and structural changes.
//   2. Role/feature discovery — crawl logged-out vs logged-in (or user vs admin);
//      the routes/forms that appear only in one run are the gated features.
// Both crawls must use the same origin because pages are matched by absolute URL.
//
// Usage:
//   node compare.mjs <baseline/crawl.json> <current/crawl.json> [--out dir]
//
// A directory may be given instead of the file; compare.mjs will look for
// crawl.json inside it. Reads two crawl.json files; writes compare.md + compare.json.

import { readFileSync } from "node:fs";
import { statSync } from "node:fs";
import { join as pjoin } from "node:path";
import { parseArgs, log, writeJson, writeText, resolveOut, join, truncate } from "./lib/util.mjs";

const HELP = `compare.mjs — diff two same-origin crawl runs (regressions, gated features)

  node compare.mjs <baselineCrawl.json> <currentCrawl.json> [--out dir]
  (you may pass the run's directory instead of the crawl.json file)`;

function loadCrawl(pathArg) {
  let path = pathArg;
  try {
    if (statSync(path).isDirectory()) path = pjoin(path, "crawl.json");
  } catch {
    log.err(`Not found: ${pathArg}`);
    process.exit(1);
  }
  try {
    return { path, data: JSON.parse(readFileSync(path, "utf8")) };
  } catch (e) {
    log.err(`Could not read crawl JSON at ${path}: ${e.message}`);
    process.exit(1);
  }
}

// Index a crawl's pages by URL for O(1) lookup, with the fields we diff on.
function indexPages(crawl) {
  const map = new Map();
  for (const p of crawl.pages || []) {
    map.set(p.url, {
      url: p.url,
      status: p.nav?.ok ? p.nav.status : "FAIL",
      ok: !!p.nav?.ok,
      title: p.features?.title || "",
      forms: (p.features?.forms || []).map(formKey),
      errorCount: (p.signals?.errors?.length || 0) + (p.signals?.requests?.filter((r) => r.kind !== "slow").length || 0) + (p.signals?.console?.filter((c) => c.type === "error").length || 0),
      aria: p.aria || null,
    });
  }
  return map;
}

function formKey(f) {
  return `${(f.method || "get").toUpperCase()} ${f.action || "(no-action)"} [${(f.fields || []).map((x) => x.name || x.type).filter(Boolean).join(",")}]`;
}

// A small structural diff of two ariaSnapshot YAML blobs: count of added/removed
// tree nodes. Uses a multiset (line -> count) rather than a Set, so changes in
// *repeated* content — added table rows, list items, cards — are counted too,
// not collapsed away. Cheap, dependency-free, good enough to flag shape changes.
function tally(text) {
  const m = new Map();
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (l) m.set(l, (m.get(l) || 0) + 1);
  }
  return m;
}
function ariaDiff(a, b) {
  if (!a || !b) return null;
  const A = tally(a);
  const B = tally(b);
  let added = 0;
  let removed = 0;
  for (const [l, nb] of B) added += Math.max(0, nb - (A.get(l) || 0));
  for (const [l, na] of A) removed += Math.max(0, na - (B.get(l) || 0));
  return { added, removed };
}

function main() {
  const args = parseArgs();
  if (args.help || args._.length < 2) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  const base = loadCrawl(args._[0]);
  const cur = loadCrawl(args._[1]);
  const originOf = (crawl) => { try { return new URL(crawl.data.startUrl).origin; } catch { return null; } };
  if (originOf(base) && originOf(cur) && originOf(base) !== originOf(cur)) {
    log.warn(`Crawl origins differ (${originOf(base)} vs ${originOf(cur)}). Pages are matched by absolute URL, so every page will be reported as new or removed.`);
  }
  const A = indexPages(base.data);
  const B = indexPages(cur.data);

  const onlyInBase = [...A.keys()].filter((u) => !B.has(u)); // removed pages
  const onlyInCur = [...B.keys()].filter((u) => !A.has(u)); // new pages
  const shared = [...B.keys()].filter((u) => A.has(u));

  const statusChanges = [];
  const errorRegressions = [];
  const formChanges = [];
  const structuralChanges = [];
  for (const u of shared) {
    const a = A.get(u);
    const b = B.get(u);
    if (String(a.status) !== String(b.status)) statusChanges.push({ url: u, from: a.status, to: b.status });
    if (b.errorCount > a.errorCount) errorRegressions.push({ url: u, from: a.errorCount, to: b.errorCount });
    const addedForms = b.forms.filter((f) => !a.forms.includes(f));
    const removedForms = a.forms.filter((f) => !b.forms.includes(f));
    if (addedForms.length || removedForms.length) formChanges.push({ url: u, addedForms, removedForms });
    const d = ariaDiff(a.aria, b.aria);
    if (d && d.added + d.removed > 0) structuralChanges.push({ url: u, ...d });
  }
  structuralChanges.sort((x, y) => y.added + y.removed - (x.added + x.removed));

  // New forms are the headline for gated-feature discovery.
  const newForms = onlyInCur.flatMap((u) => B.get(u).forms.map((f) => ({ url: u, form: f })));

  const L = [];
  L.push(`# Crawl comparison`);
  L.push("");
  L.push(`- **Baseline (A):** ${base.data.startUrl} — ${A.size} pages  \`${base.path}\``);
  L.push(`- **Current  (B):** ${cur.data.startUrl} — ${B.size} pages  \`${cur.path}\``);
  L.push(`- **Summary:** ${onlyInCur.length} new page(s), ${onlyInBase.length} removed, ${statusChanges.length} status change(s), ${errorRegressions.length} error regression(s), ${structuralChanges.length} structural change(s).`);
  L.push("");

  section(L, "🆕 New pages in B (not in A)", onlyInCur, (u) => `- \`${B.get(u).status}\` ${u}${B.get(u).forms.length ? ` — ${B.get(u).forms.length} form(s)` : ""}`);
  section(L, "🗑️ Pages removed (in A, gone in B)", onlyInBase, (u) => `- \`${A.get(u).status}\` ${u}`);

  L.push(`## ⚠️ Status changes`);
  if (!statusChanges.length) L.push(`_None._`);
  for (const c of statusChanges) L.push(`- ${c.url}: \`${c.from}\` → \`${c.to}\`${worse(c.from, c.to) ? "  **(regression)**" : ""}`);
  L.push("");

  L.push(`## 🐞 Increased error signals on shared pages`);
  if (!errorRegressions.length) L.push(`_None._`);
  for (const c of errorRegressions) L.push(`- ${c.url}: ${c.from} → ${c.to} error signal(s)`);
  L.push("");

  L.push(`## 📝 Form changes`);
  if (!formChanges.length && !newForms.length) L.push(`_None._`);
  for (const f of newForms) L.push(`- **new form** on ${f.url}: \`${truncate(f.form, 100)}\``);
  for (const c of formChanges) {
    for (const af of c.addedForms) L.push(`- **added** on ${c.url}: \`${truncate(af, 100)}\``);
    for (const rf of c.removedForms) L.push(`- **removed** on ${c.url}: \`${truncate(rf, 100)}\``);
  }
  L.push("");

  L.push(`## 🔧 Structural changes (accessibility-tree diff)`);
  if (!structuralChanges.length) L.push(`_No structural changes detected (or --no-aria was used)._`);
  for (const c of structuralChanges.slice(0, 25)) L.push(`- ${c.url}: +${c.added} / −${c.removed} tree node(s)`);
  L.push("");

  const outDir = resolveOut(args.out || "playwright-report-compare");
  const mdPath = writeText(join(outDir, "compare.md"), L.join("\n"));
  const jsonPath = writeJson(join(outDir, "compare.json"), {
    baseline: base.path, current: cur.path, onlyInBase, onlyInCur, statusChanges, errorRegressions, formChanges, newForms, structuralChanges,
  });

  log.ok(`New: ${onlyInCur.length}  Removed: ${onlyInBase.length}  Status Δ: ${statusChanges.length}  Error regressions: ${errorRegressions.length}`);
  log.ok(`Report: ${mdPath}`);
  console.log(JSON.stringify({ report: mdPath, data: jsonPath, newPages: onlyInCur.length, removedPages: onlyInBase.length, statusChanges: statusChanges.length, errorRegressions: errorRegressions.length }));
}

function section(L, title, items, fmt) {
  L.push(`## ${title}`);
  if (!items.length) L.push(`_None._`);
  for (const it of items.slice(0, 60)) L.push(fmt(it));
  L.push("");
}

// Is a status transition a regression? (2xx/3xx → 4xx/5xx/FAIL)
function worse(from, to) {
  const bad = (s) => s === "FAIL" || (typeof s === "number" && s >= 400);
  return !bad(from) && bad(to);
}

main();
