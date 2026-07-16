// Shared helpers: argument parsing, URL logic, filesystem/report output, logging.
// Kept dependency-free so the scripts run with only `playwright` installed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Minimal CLI parser. Supports:
 *   --key value      -> { key: "value" }
 *   --key=value      -> { key: "value" }
 *   --flag           -> { flag: true }
 *   --no-flag        -> { flag: false }
 *   bare positionals -> collected into `_`
 * Values that look like numbers are coerced to numbers.
 * A flag given more than once accumulates into an array (e.g. --click a --click b).
 * Kebab-case keys are also exposed as camelCase aliases ("storage-state" -> storageState).
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  const set = (key, value) => {
    if (key in out) {
      out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    } else {
      out[key] = value;
    }
    const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (camel !== key) out[camel] = out[key];
  };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) {
      out._.push(tok);
      continue;
    }
    let key = tok.slice(2);
    let value;
    if (key.includes("=")) {
      const idx = key.indexOf("=");
      value = key.slice(idx + 1);
      key = key.slice(0, idx);
    } else if (key.startsWith("no-")) {
      key = key.slice(3);
      value = false;
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      value = argv[++i];
    } else {
      value = true;
    }
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      value = Number(value);
    }
    set(key, value);
  }
  return out;
}

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export const log = {
  info: (m) => process.stderr.write(`${COLORS.cyan}i${COLORS.reset} ${m}\n`),
  ok: (m) => process.stderr.write(`${COLORS.green}✓${COLORS.reset} ${m}\n`),
  warn: (m) => process.stderr.write(`${COLORS.yellow}!${COLORS.reset} ${m}\n`),
  err: (m) => process.stderr.write(`${COLORS.red}✗${COLORS.reset} ${m}\n`),
  dim: (m) => process.stderr.write(`${COLORS.dim}${m}${COLORS.reset}\n`),
};

/** Normalize a URL for de-duplication: drop hash, sort query, strip trailing slash. */
export function normalizeUrl(raw, base) {
  try {
    const u = new URL(raw, base);
    u.hash = "";
    u.searchParams.sort();
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** True if a URL points at a downloadable/asset resource we should not treat as a page. */
export function isAssetUrl(url) {
  return /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|map|pdf|zip|gz|tar|mp4|webm|mp3|wav|woff2?|ttf|eot|xml|rss|txt|csv|xlsx?|docx?)(\?|#|$)/i.test(
    url,
  );
}

/** Turn a URL into a filesystem-safe slug for screenshot filenames. */
export function slugifyUrl(url) {
  try {
    const u = new URL(url);
    const path = (u.pathname + u.search).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    return (u.hostname + (path ? "-" + path : "-home")).slice(0, 120);
  } catch {
    return "page-" + Math.random().toString(36).slice(2, 8);
  }
}

/** Redact obvious secrets before anything is written to disk or shown to a model. */
export function redact(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/([?&](?:token|key|apikey|api_key|access_token|password|secret)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/g, "$1[REDACTED]")
    .replace(/([\w.-]+@[\w.-]+\.\w+)/g, (m) => (m.length > 40 ? "[REDACTED]" : m));
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

export function writeText(path, text) {
  ensureDir(dirname(path));
  writeFileSync(path, text);
  return path;
}

export function resolveOut(outDir) {
  return resolve(process.cwd(), outDir || "playwright-report-explore");
}

export { join };

export function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function truncate(s, n = 300) {
  if (typeof s !== "string") return s;
  return s.length > n ? s.slice(0, n) + "…" : s;
}
