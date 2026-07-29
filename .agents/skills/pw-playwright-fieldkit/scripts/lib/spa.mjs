// SPA route discovery. Single-page apps often navigate via onClick + history
// pushState instead of real <a href> links, so a link-only crawler sees one
// page. This probes navigation-role elements, clicks them, and watches for a
// URL change (pushState/hashchange), enqueueing any new same-origin routes.
//
// SAFETY: this is deliberately conservative. It only clicks elements that are
// *navigational* (role=link/tab/menuitem or data-href/-to/-route attributes and
// javascript:-style anchors) and never anything inside a <form> or a submit
// button — so it won't post, delete, or purchase. Even so it's opt-in (--spa)
// and slower, because it re-loads the page between clicks to stay deterministic.

import { normalizeUrl, sameOrigin } from "./util.mjs";

// Elements that represent navigation without necessarily being an <a href>.
const CANDIDATE_SELECTOR = [
  '[role=link]',
  '[role=tab]',
  '[role=menuitem]',
  '[data-href]',
  '[data-to]',
  '[data-route]',
  'a[href="#"]',
  'a[href^="javascript:"]',
].join(",");

// Tag every visible, safe-to-click candidate with data-spa-probe="<i>" and
// return the count. Re-running after a re-render re-establishes stable indices.
function tagCandidates(page) {
  return page.evaluate((sel) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const els = [...document.querySelectorAll(sel)].filter((el) => visible(el) && !el.closest("form"));
    els.forEach((el, i) => el.setAttribute("data-spa-probe", String(i)));
    return els.length;
  }, CANDIDATE_SELECTOR);
}

/**
 * Probe a page for client-rendered routes.
 * @returns {Promise<string[]>} new normalized same-origin URLs discovered
 */
export async function discoverSpaRoutes(page, url, gotoSafe, { cap = 12, wait = 400 } = {}) {
  const found = new Set();
  let total;
  try {
    total = await tagCandidates(page);
  } catch {
    return [];
  }
  const n = Math.min(total, cap);

  for (let i = 0; i < n; i++) {
    // Reset to a clean, freshly-tagged state before every click except the first
    // (which is already tagged above). A previous click may have navigated away
    // OR mutated the DOM in place (opening a menu, swapping content) without
    // changing the URL — either way the earlier tags are stale, so always reload
    // and re-tag to keep candidate indices stable. Slower, but correct.
    if (i > 0) {
      const nav = await gotoSafe(page, url, { timeout: 20000 });
      if (!nav.ok) break;
      const count = await tagCandidates(page).catch(() => 0);
      if (i >= count) continue; // candidate no longer present after re-render
    }
    try {
      const before = page.url();
      await page.locator(`[data-spa-probe="${i}"]`).first().click({ timeout: 5000, noWaitAfter: true });
      await page.waitForTimeout(wait);
      const after = page.url();
      if (after !== before) {
        const norm = normalizeUrl(after, url);
        if (norm && sameOrigin(norm, url)) found.add(norm);
      }
    } catch {
      /* not clickable / detached / opened a popup — skip */
    }
    // Close any popup tabs the click may have spawned.
    for (const p of page.context().pages()) {
      if (p !== page) await p.close().catch(() => {});
    }
  }

  // Leave the page back on the original URL for the caller.
  if (page.url() !== url) await gotoSafe(page, url, { timeout: 20000 }).catch(() => {});
  return [...found];
}
