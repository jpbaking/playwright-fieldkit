// Browser/context setup shared by every script. Centralizes auth, viewport,
// timeouts, and the "which engine" decision so individual scripts stay simple.

import { existsSync } from "node:fs";
import { log } from "./util.mjs";

/**
 * Launch a browser and create an instrumented context.
 * @param {object} opts
 * @param {string}  [opts.browser]   chromium | firefox | webkit
 * @param {boolean} [opts.headed]    show the browser window
 * @param {string}  [opts.storageState] path to a saved auth state JSON (see docs/user-guide.md#authentication)
 * @param {number}  [opts.width]
 * @param {number}  [opts.height]
 * @param {number}  [opts.timeout]   per-action timeout in ms
 * @param {string}  [opts.userAgent]
 * @param {boolean} [opts.ignoreHttpsErrors]
 * @param {string}  [opts.device]    a Playwright device preset, e.g. "iPhone 13" or "Pixel 7"
 */
export async function launch(opts = {}) {
  const engine = String(opts.browser || "chromium").toLowerCase();
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    log.err("Playwright is not installed. From this folder run:  npm install  &&  npx playwright install chromium");
    process.exit(2);
  }
  const impl = playwright[engine];
  if (!impl) {
    log.err(`Unknown browser "${engine}". Use chromium, firefox, or webkit.`);
    process.exit(2);
  }

  if (opts.storageState && !existsSync(opts.storageState)) {
    log.err(`Auth state file not found: ${opts.storageState}. Create it first with:  node .cline/skills/playwright-fieldkit/scripts/save-auth.mjs <loginUrl> --headed --out ${opts.storageState}`);
    process.exit(2);
  }

  // A device preset supplies viewport, userAgent, deviceScaleFactor, touch, etc.
  // Explicit flags below still win over the preset's defaults.
  let device = null;
  if (opts.device) {
    device = playwright.devices[opts.device];
    if (!device) {
      const sample = Object.keys(playwright.devices).slice(0, 8).join(", ");
      log.err(`Unknown device "${opts.device}". Examples: ${sample}, … (see https://playwright.dev/docs/emulation#devices).`);
      process.exit(2);
    }
    // Firefox rejects the isMobile flag that mobile presets carry; drop it there.
    if (engine === "firefox" && device.isMobile) {
      device = { ...device, isMobile: undefined };
      log.warn(`Firefox does not support mobile emulation flags; using ${opts.device}'s viewport/UA only.`);
    }
  }

  const browser = await impl.launch({ headless: !opts.headed });
  const contextOpts = {
    ...(device || {}),
    ignoreHTTPSErrors: !!opts.ignoreHttpsErrors,
  };
  // Only override the device's viewport when the user asked for a specific size.
  if (!device || opts.width || opts.height) {
    contextOpts.viewport = { width: Number(opts.width) || device?.viewport?.width || 1280, height: Number(opts.height) || device?.viewport?.height || 800 };
  }
  if (opts.userAgent) contextOpts.userAgent = opts.userAgent;
  if (opts.storageState) contextOpts.storageState = opts.storageState;

  const context = await browser.newContext(contextOpts);
  context.setDefaultTimeout(Number(opts.timeout) || 15000);
  context.setDefaultNavigationTimeout(Number(opts.timeout) || 30000);

  return { browser, context };
}

/**
 * The URL chain the browser actually walked, oldest first, or [] if there was no
 * redirect. A chain that starts on HTTPS but contains an http:// hop left TLS
 * mid-navigation — audit.mjs reports that, so capture it on every navigation
 * rather than only when --check-links is requested.
 */
function redirectChainOf(resp) {
  if (!resp) return [];
  const chain = [];
  for (let req = resp.request(); req; req = req.redirectedFrom()) chain.unshift(req.url());
  return chain.length > 1 ? chain : [];
}

/** Best-effort navigation that resolves even on partial loads; returns status + timing. */
export async function gotoSafe(page, url, { waitUntil = "domcontentloaded", timeout = 30000 } = {}) {
  const start = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil, timeout });
    // Give client-side rendering a brief settle window without hanging forever.
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    return { ok: true, status: resp ? resp.status() : null, ms: Date.now() - start, redirectChain: redirectChainOf(resp) };
  } catch (err) {
    return { ok: false, status: null, ms: Date.now() - start, error: String(err.message || err).split("\n")[0] };
  }
}
