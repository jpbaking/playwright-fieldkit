import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function glob(pattern) {
  return new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
}

function loadPatterns(path) {
  if (path.endsWith(".json")) {
    const value = JSON.parse(readFileSync(path, "utf8"));
    const entries = value.allowedOrigins || value.allowedTargets || value.targets;
    if (!Array.isArray(entries)) throw new Error(`${path} must contain an allowedOrigins array.`);
    return entries.map(String).map((entry) => entry.trim()).filter(Boolean);
  }
  return readFileSync(path, "utf8").split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter(Boolean);
}

function matches(url, pattern) {
  const parsed = new URL(url);
  const candidates = pattern.includes("://")
    ? [parsed.origin]
    : [parsed.host, parsed.hostname];
  return candidates.some((candidate) => glob(pattern).test(candidate));
}

export function createScope(args = {}) {
  const explicit = args["scope-config"] || args.scopeConfig;
  const candidates = explicit
    ? [resolve(String(explicit))]
    : [resolve(process.cwd(), "fieldkit.config.json"), resolve(process.cwd(), "scripts", "targets.txt"), resolve(SCRIPTS_DIR, "targets.txt")];
  const configPath = candidates.find(existsSync) || null;
  if (explicit && !configPath) throw new Error(`Authorization scope config not found: ${explicit}`);
  const patterns = configPath ? loadPatterns(configPath) : [];
  const override = !!args["i-am-authorized"];

  const isAllowed = (url) => !configPath || override || patterns.some((pattern) => matches(url, pattern));
  const assertAllowed = (url, kind = "target") => {
    if (!isAllowed(url)) {
      const error = new Error(`${kind} is outside the authorization allowlist: ${url}. Update ${configPath} or pass --i-am-authorized to record an explicit override.`);
      error.code = "SCOPE_NOT_ALLOWED";
      throw error;
    }
    return url;
  };
  return {
    enabled: !!configPath,
    override,
    configPath,
    patterns,
    isAllowed,
    assertAllowed,
    metadata: () => ({ enabled: !!configPath, configPath, allowedTargets: patterns, override }),
  };
}

export async function installNavigationScope(context, scope) {
  if (!scope?.enabled || scope.override) return;
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (request.isNavigationRequest() && !scope.isAllowed(request.url())) return route.abort("blockedbyclient");
    return route.continue();
  });
}
