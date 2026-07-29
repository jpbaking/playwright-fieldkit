// Attaches listeners to a Playwright page to passively record everything a
// human tester would notice: console errors, uncaught exceptions, failed
// network requests, slow requests, and unexpected dialogs.

import { redact, truncate } from "./util.mjs";

// Resource types worth flagging when slow: the main document and data calls.
const SLOW_TYPES = new Set(["document", "xhr", "fetch"]);

/**
 * Begin recording signals on a page. Returns a collector with:
 *   .console  - console messages (warnings/errors kept in full, logs summarized)
 *   .errors   - uncaught page exceptions
 *   .requests - failed or error-status network responses
 *   .dialogs  - alert/confirm/prompt dialogs that popped up
 *   .drain()  - returns a plain object snapshot and clears per-page buffers
 */
export function instrument(page, { slowMs = 3000 } = {}) {
  const state = { console: [], errors: [], requests: [], dialogs: [] };
  const pending = new Map();

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      state.console.push({ type, text: redact(truncate(msg.text(), 500)), location: msg.location() });
    }
  });

  page.on("pageerror", (err) => {
    state.errors.push({ message: redact(truncate(String(err.message || err), 500)), stack: redact(truncate(err.stack || "", 800)) });
  });

  page.on("request", (req) => {
    pending.set(req, Date.now());
  });

  page.on("requestfailed", (req) => {
    pending.delete(req);
    const f = req.failure();
    state.requests.push({
      kind: "failed",
      method: req.method(),
      url: redact(req.url()),
      resourceType: req.resourceType(),
      error: f ? f.errorText : "unknown",
    });
  });

  page.on("response", (res) => {
    const started = pending.get(res.request());
    pending.delete(res.request());
    const status = res.status();
    const durationMs = started ? Date.now() - started : null;
    if (status >= 400) {
      state.requests.push({
        kind: "error-status",
        method: res.request().method(),
        url: redact(res.url()),
        status,
        resourceType: res.request().resourceType(),
      });
    } else if (durationMs !== null && durationMs > slowMs && SLOW_TYPES.has(res.request().resourceType())) {
      // Slow documents AND slow data calls (xhr/fetch) — the latter are what
      // usually make an app feel sluggish after it has loaded.
      state.requests.push({
        kind: "slow",
        method: res.request().method(),
        url: redact(res.url()),
        status,
        resourceType: res.request().resourceType(),
        durationMs,
      });
    }
  });

  // Auto-dismiss dialogs so an unattended crawl never hangs, but record them —
  // an unexpected confirm() is itself a finding.
  page.on("dialog", async (dialog) => {
    state.dialogs.push({ type: dialog.type(), message: redact(truncate(dialog.message(), 300)) });
    try {
      await dialog.dismiss();
    } catch {
      /* already handled */
    }
  });

  return {
    ...state,
    drain() {
      const snap = {
        console: state.console.slice(),
        errors: state.errors.slice(),
        requests: state.requests.slice(),
        dialogs: state.dialogs.slice(),
      };
      state.console.length = 0;
      state.errors.length = 0;
      state.requests.length = 0;
      state.dialogs.length = 0;
      return snap;
    },
  };
}
