// Same-origin discovery from /robots.txt and /sitemap.xml. These are the single
// best source of routes a link-crawl can't reach: unlinked pages listed in the
// sitemap, and the Disallow list in robots.txt (a map of what the site owner
// considers sensitive — prime candidates for the "gated features" report).
//
// Uses the browser context's request API, so cookies/auth from --storage-state
// apply. XML is parsed with regex to stay dependency-free; gzipped sitemaps
// (.xml.gz) are skipped with a note.

import { normalizeUrl, sameOrigin } from "./util.mjs";

const LOC_RE = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;

async function fetchText(context, url, timeout = 15000) {
  try {
    const res = await context.request.get(url, { timeout, failOnStatusCode: false });
    if (!res.ok()) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function parseRobots(text, origin, effectiveUserAgent = "PlaywrightFieldKit") {
  const sitemaps = [];
  const groups = [];
  let group = null;
  let sawRule = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "sitemap" && value) sitemaps.push(value);
    else if (field === "user-agent" && value) {
      if (!group || sawRule) {
        group = { agents: [], allow: [], disallow: [] };
        groups.push(group);
        sawRule = false;
      }
      group.agents.push(value);
    } else if ((field === "allow" || field === "disallow") && group) {
      sawRule = true;
      if (value) group[field].push(value);
    }
  }

  const ua = String(effectiveUserAgent || "PlaywrightFieldKit").toLowerCase();
  const scored = groups.map((entry) => {
    const matches = entry.agents
      .map((agent) => agent.toLowerCase())
      .filter((agent) => agent === "*" || ua.includes(agent));
    const score = matches.reduce((best, agent) => Math.max(best, agent === "*" ? 0 : agent.length), -1);
    return { entry, score };
  });
  const best = scored.reduce((value, item) => Math.max(value, item.score), -1);
  const selected = scored.filter((item) => item.score === best && best >= 0).map((item) => item.entry);
  return {
    allow: [...new Set(selected.flatMap((entry) => entry.allow))],
    disallow: [...new Set(selected.flatMap((entry) => entry.disallow))],
    sitemaps: [...new Set(sitemaps)],
    origin,
    effectiveUserAgent,
    selectedAgents: [...new Set(selected.flatMap((entry) => entry.agents))],
  };
}

function extractLocs(xml) {
  const out = [];
  let m;
  LOC_RE.lastIndex = 0;
  while ((m = LOC_RE.exec(xml))) out.push(m[1].replace(/&amp;/g, "&"));
  return out;
}

/**
 * Build a matcher for robots.txt Disallow patterns. Supports the `*` wildcard
 * and the `$` end-anchor per the robots spec; a rule matches by path prefix
 * otherwise. Returns (pathWithQuery) => boolean (true = blocked).
 */
export function robotsMatcher(input = []) {
  const allow = Array.isArray(input) ? [] : (input.allow || []);
  const disallow = Array.isArray(input) ? input : (input.disallow || []);
  const compile = (rule, type) => {
    const anchored = rule.endsWith("$");
    const body = anchored ? rule.slice(0, -1) : rule;
    // Escape regex metachars except our wildcard, then turn * into .*
    const escaped = body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return { type, rule, specificity: body.replace(/\*/g, "").length, regex: new RegExp("^" + escaped + (anchored ? "$" : "")) };
  };
  const rules = [
    ...allow.map((rule) => compile(rule, "allow")),
    ...disallow.map((rule) => compile(rule, "disallow")),
  ];
  const match = (path) => {
    const matches = rules.filter((entry) => entry.regex.test(path));
    matches.sort((a, b) => b.specificity - a.specificity || (a.type === "allow" ? -1 : 1));
    return matches[0] || null;
  };
  const matcher = (path) => match(path)?.type === "disallow";
  matcher.match = match;
  return matcher;
}

/**
 * @returns {Promise<{urls:string[], robots:{disallow:string[],sitemaps:string[]}, sources:string[], skipped:string[]}>}
 */
export async function discover(context, startUrl, { max = 300, userAgent = "PlaywrightFieldKit" } = {}) {
  const origin = new URL(startUrl).origin;
  const sources = [];
  const skipped = [];
  const urls = new Set();

  // 1. robots.txt — for Disallow paths and any Sitemap: pointers.
  const robotsText = await fetchText(context, origin + "/robots.txt");
  const robots = robotsText ? parseRobots(robotsText, origin, userAgent) : { allow: [], disallow: [], sitemaps: [], effectiveUserAgent: userAgent, selectedAgents: [] };
  if (robotsText) sources.push(origin + "/robots.txt");

  // 2. Sitemaps: those named in robots plus the conventional /sitemap.xml.
  const sitemapQueue = [...new Set([...robots.sitemaps, origin + "/sitemap.xml"])];
  const visitedSitemaps = new Set();
  while (sitemapQueue.length && urls.size < max) {
    const sm = sitemapQueue.shift();
    if (visitedSitemaps.has(sm)) continue;
    visitedSitemaps.add(sm);
    if (/\.gz(\?|$)/i.test(sm)) {
      skipped.push(sm + " (gzip not supported)");
      continue;
    }
    const xml = await fetchText(context, sm);
    if (!xml) continue;
    sources.push(sm);
    const isIndex = /<sitemapindex/i.test(xml);
    for (const loc of extractLocs(xml)) {
      if (isIndex) {
        // Nested sitemap — queue it (bounded by visitedSitemaps + max).
        if (sameOrigin(loc, startUrl) && visitedSitemaps.size < 50) sitemapQueue.push(loc);
      } else {
        const norm = normalizeUrl(loc, origin);
        if (norm && sameOrigin(norm, startUrl)) urls.add(norm);
        if (urls.size >= max) break;
      }
    }
  }

  return { urls: [...urls], robots, sources, skipped };
}
