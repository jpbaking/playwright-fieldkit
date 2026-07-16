import { redact } from "./util.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function collectTargets(pages) {
  const targets = new Map();
  const add = (raw, source, kind, label = "", declaredTarget = null) => {
    try {
      const parsed = new URL(raw, source);
      parsed.hash = "";
      const url = parsed.toString();
      if (!/^https?:/i.test(url)) return;
      if (!targets.has(url)) targets.set(url, { url, sources: [] });
      targets.get(url).sources.push({ page: source, kind, label, declaredTarget: redact(declaredTarget), resolvedTarget: redact(url) });
    } catch { /* invalid or non-URL target */ }
  };
  for (const page of pages) {
    for (const link of page.features?.links || []) add(link.href, page.url, "link", link.text || link.accessibleName || "", link.declaredHref);
    for (const link of page.features?.flags?.hiddenNav || []) add(link.href, page.url, "hidden-link", link.text || "", link.href);
    for (const asset of page.features?.assets || []) add(asset.url, page.url, "asset", asset.tag, asset.declaredUrl);
  }
  return [...targets.values()];
}

async function requestTarget(context, target, timeout, scope) {
  const redirects = [];
  let url = target;
  let method = "HEAD";
  for (let hop = 0; hop < 8; hop++) {
    if (scope?.enabled && !scope.isAllowed(url)) return { status: null, finalUrl: redact(url), redirects, method, broken: false, skipped: "redirect left authorization allowlist" };
    try {
      let response = await context.request.fetch(url, { method, timeout, failOnStatusCode: false, maxRedirects: 0 });
      if (method === "HEAD" && [405, 501].includes(response.status())) {
        await response.dispose();
        method = "GET";
        response = await context.request.fetch(url, { method, timeout, failOnStatusCode: false, maxRedirects: 0 });
      }
      const status = response.status();
      const location = response.headers().location;
      await response.dispose();
      if (status >= 300 && status < 400 && location) {
        const next = new URL(location, url).toString();
        redirects.push({ status, from: redact(url), to: redact(next) });
        url = next;
        continue;
      }
      return { status, finalUrl: redact(url), redirects, method, broken: status >= 400 };
    } catch (error) {
      return { status: null, finalUrl: redact(url), redirects, method, broken: true, error: String(error.message || error).split("\n")[0] };
    }
  }
  return { status: null, finalUrl: redact(url), redirects, method, broken: true, error: "too many redirects" };
}

export async function checkLinks(context, pages, scope, { concurrency = 4, delay = 100, timeout = 15000 } = {}) {
  const targets = collectTargets(pages);
  const results = new Array(targets.length);
  const hostNext = new Map();
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const index = cursor++;
      const target = targets[index];
      if (scope?.enabled && !scope.isAllowed(target.url)) {
        results[index] = { ...target, url: redact(target.url), skipped: "outside authorization allowlist", broken: false };
        continue;
      }
      const host = new URL(target.url).host;
      const wait = Math.max(0, (hostNext.get(host) || 0) - Date.now());
      if (wait) await sleep(wait);
      hostNext.set(host, Date.now() + delay);
      results[index] = { ...target, url: redact(target.url), ...(await requestTarget(context, target.url, timeout, scope)) };
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Number(concurrency) || 1) }, worker));
  return {
    checked: results.filter((result) => !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    broken: results.filter((result) => result.broken).length,
    redirected: results.filter((result) => result.redirects?.length).length,
    results,
  };
}
