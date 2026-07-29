// Turns raw crawl/inspect data into a compact Markdown report that a model can
// read back in one pass. The goal: a weaker model should not need to parse the
// big JSON — the Markdown surfaces the findings that matter, ranked.

import { truncate } from "./util.mjs";
import { auditPages, auditLinkCheck, mergeFindings } from "./audit.mjs";

function severityOf(page) {
  if (page.nav && !page.nav.ok) return "error";
  if (page.signals?.errors?.length) return "error";
  if (page.signals?.requests?.some((r) => r.kind !== "slow")) return "error";
  if (page.nav?.status >= 400) return "error";
  if (page.signals?.console?.some((c) => c.type === "error")) return "error";
  if (page.signals?.console?.length || page.signals?.dialogs?.length) return "warn";
  return "ok";
}

export function summarizeFindings(pages) {
  const findings = [];
  for (const p of pages) {
    const sev = severityOf(p);
    if (sev === "ok") continue;
    const reasons = [];
    if (p.nav && !p.nav.ok) reasons.push(`navigation failed: ${p.nav.error}`);
    if (p.nav?.status >= 400) reasons.push(`HTTP ${p.nav.status}`);
    for (const e of p.signals?.errors || []) reasons.push(`JS error: ${truncate(e.message, 140)}`);
    for (const c of p.signals?.console || []) if (c.type === "error") reasons.push(`console.error: ${truncate(c.text, 140)}`);
    for (const r of p.signals?.requests || []) {
      if (r.kind === "failed") reasons.push(`request failed (${r.error}): ${truncate(r.url, 120)}`);
      else if (r.kind === "error-status") reasons.push(`HTTP ${r.status} on ${r.resourceType}: ${truncate(r.url, 120)}`);
    }
    for (const d of p.signals?.dialogs || []) reasons.push(`dialog(${d.type}): ${truncate(d.message, 120)}`);
    if (reasons.length) findings.push({ url: p.url, severity: sev, reasons });
  }
  findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  return findings;
}

export function buildReport({ startUrl, pages, queueSeen, startedAt, finishedAt, config, robots, sitemapSeeded = 0, linkCheck = null }) {
  const findings = summarizeFindings(pages);
  const errorPages = findings.filter((f) => f.severity === "error");
  const forms = pages.flatMap((p) => (p.features?.forms || []).map((f) => ({ url: p.url, ...f })));
  const featureFlagHints = pages.flatMap((p) =>
    (p.features?.flags?.featureFlagHints || []).map((h) => ({ url: p.url, ...h })),
  );
  const hiddenNav = pages.flatMap((p) => (p.features?.flags?.hiddenNav || []).map((h) => ({ url: p.url, ...h })));
  const gated = pages.filter((p) => p.features?.flags?.hasLoginForm).map((p) => p.url);
  const audit = mergeFindings(
    auditPages(pages, { pageLoadMs: config.auditPageMs, slowRequestMs: config.auditRequestMs }),
    auditLinkCheck(linkCheck),
  );

  const L = [];
  L.push(`# Site exploration report`);
  L.push("");
  L.push(`- **Start URL:** ${startUrl}`);
  L.push(`- **Pages visited:** ${pages.length}  (URLs discovered: ${queueSeen})`);
  L.push(`- **Pages with errors:** ${errorPages.length}`);
  L.push(`- **Forms found:** ${forms.length}`);
  L.push(`- **Duration:** ${((finishedAt - startedAt) / 1000).toFixed(1)}s`);
  L.push(`- **Config:** depth ${config.depth}, max ${config.maxPages} pages, browser ${config.browser}${config.device ? `, device ${config.device}` : ""}${config.spa ? ", SPA mode" : ""}`);
  if (sitemapSeeded) L.push(`- **Sitemap:** seeded ${sitemapSeeded} URL(s) from robots.txt/sitemap.xml`);
  L.push("");

  L.push(`## 1. Problems found (fix these)`);
  if (!findings.length) L.push(`_No console errors, failed requests, or bad status codes observed._`);
  for (const f of findings.slice(0, 40)) {
    L.push(`- **[${f.severity.toUpperCase()}]** ${f.url}`);
    for (const r of f.reasons.slice(0, 6)) L.push(`  - ${r}`);
  }
  L.push("");

  L.push(`## 2. Site map (pages visited)`);
  for (const p of pages) {
    const status = p.nav?.ok ? p.nav.status : `FAIL`;
    L.push(`- \`${status}\` [${truncate(p.features?.title || "(no title)", 60)}](${p.url}) — ${p.features?.counts?.links ?? 0} links, ${p.features?.counts?.forms ?? 0} forms, ${p.features?.counts?.interactive ?? 0} interactive`);
  }
  L.push("");

  L.push(`## 3. Interactive features & forms`);
  if (gated.length) {
    L.push(`**Login/auth walls detected on:** ${gated.slice(0, 10).map((u) => `\`${u}\``).join(", ")}`);
    L.push("");
  }
  if (forms.length) {
    L.push(`**Forms** (candidates for integration tests):`);
    for (const f of forms.slice(0, 25)) {
      const fields = f.fields.map((x) => x.name || x.type).filter(Boolean).slice(0, 8).join(", ");
      L.push(`- \`${f.method.toUpperCase()}\` ${f.action || "(no action)"} on ${f.url}`);
      L.push(`  - fields: ${fields || "none"}${f.submit ? ` — submit: "${truncate(f.submit.text, 30)}"` : ""}`);
    }
  } else {
    L.push(`_No forms found._`);
  }
  L.push("");

  L.push(`## 4. Possibly undocumented / gated features`);
  const disallow = robots?.disallow || [];
  const anyHint = featureFlagHints.length || hiddenNav.length || disallow.length;
  if (!anyHint) L.push(`_No obvious beta/experimental markers, hidden navigation, or robots Disallow paths found._`);
  if (disallow.length) {
    L.push(`**robots.txt Disallow paths** (the site owner keeps crawlers out of these — often admin/internal/gated areas worth probing with auth):`);
    for (const d of disallow.slice(0, 25)) L.push(`- \`${truncate(d, 80)}\``);
  }
  if (featureFlagHints.length) {
    L.push(`**Beta/experimental markers:**`);
    for (const h of featureFlagHints.slice(0, 15)) L.push(`- "${truncate(h.text, 50)}" (${truncate(h.cls || "", 40)}) on ${h.url}`);
  }
  if (hiddenNav.length) {
    L.push(`**Links present in DOM but not visible** (may be gated/undocumented routes):`);
    for (const h of hiddenNav.slice(0, 20)) L.push(`- [${truncate(h.text, 40)}](${h.href}) on ${h.url}`);
  }
  L.push("");

  // ── Performance ──────────────────────────────────────────────────────────
  L.push(`## 5. Performance`);
  const timed = pages.filter((p) => p.nav?.ok && typeof p.nav.ms === "number");
  const slowRequests = pages.flatMap((p) =>
    (p.signals?.requests || []).filter((r) => r.kind === "slow").map((r) => ({ page: p.url, ...r })),
  );
  if (!timed.length) {
    L.push(`_No timing captured._`);
  } else {
    const avg = Math.round(timed.reduce((s, p) => s + p.nav.ms, 0) / timed.length);
    const slowest = [...timed].sort((a, b) => b.nav.ms - a.nav.ms).slice(0, 5);
    L.push(`- **Average page load:** ${avg} ms across ${timed.length} pages.`);
    L.push(`- **Slowest pages:**`);
    for (const p of slowest) L.push(`  - ${p.nav.ms} ms — ${truncate(p.url, 90)}`);
    if (slowRequests.length) {
      L.push(`- **Slow requests (>3s):**`);
      for (const r of slowRequests.slice(0, 15)) L.push(`  - ${r.durationMs} ms \`${r.resourceType}\` ${truncate(r.url, 90)} (on ${truncate(r.page, 50)})`);
    }
  }
  L.push("");

  L.push(`## 6. Link check`);
  if (!linkCheck) L.push(`_Not run. Add \`--check-links\` to check discovered HTTP(S) links and assets._`);
  else {
    L.push(`- **Checked:** ${linkCheck.checked}; **broken:** ${linkCheck.broken}; **redirected:** ${linkCheck.redirected}; **scope-skipped:** ${linkCheck.skipped}.`);
    const noteworthy = linkCheck.results.filter((item) => item.broken || item.redirects?.length || item.skipped);
    for (const item of noteworthy.slice(0, 60)) {
      const state = item.skipped ? `SKIPPED (${item.skipped})` : item.error ? `FAILED (${item.error})` : `HTTP ${item.status}`;
      L.push(`- **${state}** ${truncate(item.url, 140)}`);
      for (const source of item.sources.slice(0, 5)) {
        const declared = source.declaredTarget && source.declaredTarget !== source.resolvedTarget ? `; declared ${truncate(source.declaredTarget, 80)}` : "";
        L.push(`  - from ${source.page}${source.label ? ` — "${truncate(source.label, 50)}"` : ""}${declared}`);
      }
      if (item.redirects?.length) L.push(`  - redirects: ${item.redirects.map((hop) => `${hop.status} ${hop.from} → ${hop.to}`).join("; ")}`);
    }
  }
  L.push("");

  L.push(`## 7. Deterministic quality audit`);
  if (!audit.length) L.push(`_No findings from the lightweight accessibility and performance checks._`);
  for (const item of audit.slice(0, 60)) {
    L.push(`- **[${item.severity.toUpperCase()}] ${item.category}:** ${item.message} — ${item.url}`);
    L.push(`  - observed: ${truncate(item.observed, 180)}`);
    L.push(`  - remediation: ${item.remediation}`);
  }
  L.push("");

  L.push(`## 8. Suggested next steps`);
  L.push(`- Reproduce each ERROR above with \`inspect.mjs <url>\` for a full console/network dump and screenshot.`);
  L.push(`- Turn the forms in section 3 into verified integration tests with \`flow.mjs --gen-test\`; match the consuming project's existing Python or Node convention.`);
  L.push(`- Probe the hidden/gated routes and robots Disallow paths in section 4 with an authenticated \`--storage-state\` session.`);
  L.push(`- Re-crawl after a change and diff with \`compare.mjs\` to catch regressions and new/removed routes.`);
  L.push("");
  return { markdown: L.join("\n"), findings, forms, featureFlagHints, hiddenNav, slowRequests, audit };
}
