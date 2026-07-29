// Small deterministic quality checks over data already collected by crawl.mjs.
// These are intentionally explainable heuristics, not a replacement for WCAG or
// lab-grade performance tooling.

function finding(severity, category, code, page, message, observed, remediation) {
  return { severity, category, code, url: page.url, message, observed, remediation };
}

const RANK = { high: 0, medium: 1, low: 2 };

const INSECURE_REDIRECT_FIX =
  "Keep every redirect hop on the public HTTPS origin. A plaintext hop usually means the origin builds Location from its own host and port; check its X-Forwarded-Proto and X-Forwarded-Host handling.";

/**
 * Hops that leave TLS. A chain beginning on HTTPS but routing through http://
 * exposes the request in cleartext even when it lands back on HTTPS, so the
 * final status alone (often a healthy 200) hides the problem.
 * @param {string[]} chain URLs oldest first
 */
export function insecureHops(chain = []) {
  if (chain.length < 2 || !/^https:/i.test(chain[0])) return [];
  return chain.filter((url) => /^http:/i.test(url));
}

/** Combine finding lists, drop repeats of the same issue, and rank by severity. */
export function mergeFindings(...lists) {
  const unique = new Map();
  for (const item of lists.flat()) {
    const key = `${item.code}|${item.url}|${item.observed}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.url.localeCompare(b.url));
}

/** Insecure redirect hops among the links checked by --check-links. */
export function auditLinkCheck(linkCheck) {
  const findings = [];
  for (const item of linkCheck?.results || []) {
    if (!item.redirects?.length) continue;
    const chain = [item.url, ...item.redirects.map((hop) => hop.to)];
    if (!insecureHops(chain).length) continue;
    findings.push({
      severity: "high",
      category: "security",
      code: "insecure-redirect",
      url: item.url,
      message: "Link redirected through a plaintext HTTP hop.",
      observed: chain.join(" -> "),
      remediation: INSECURE_REDIRECT_FIX,
    });
  }
  return findings;
}

export function auditPages(pages, { pageLoadMs = 5000, slowRequestMs = 3000 } = {}) {
  const findings = [];
  for (const page of pages) {
    const features = page.features;
    if (!features) continue;

    if (!features.lang) findings.push(finding("medium", "accessibility", "missing-lang", page,
      "Document has no language declaration.", "html[lang] is empty", "Set a valid lang attribute on the html element."));

    const h1s = (features.headings || []).filter((heading) => heading.level === 1);
    if (h1s.length === 0) findings.push(finding("medium", "accessibility", "missing-h1", page,
      "Page has no visible h1 heading.", "0 visible h1 elements", "Add one descriptive primary heading."));
    else if (h1s.length > 1) findings.push(finding("low", "accessibility", "multiple-h1", page,
      "Page has multiple visible h1 headings.", `${h1s.length} visible h1 elements`, "Review the heading hierarchy and keep one primary page heading where appropriate."));

    const hasMain = (features.landmarks || []).some((landmark) => landmark.tag === "main" || landmark.role === "main");
    if (!hasMain) findings.push(finding("medium", "accessibility", "missing-main", page,
      "Page has no visible main landmark.", "no main element or role=main", "Wrap the primary content in <main> or add role=main."));

    for (const field of features.controls || []) {
      if (!field.visible) continue;
      if (["hidden", "submit", "button", "reset", "image"].includes(field.type)) continue;
      if (!field.hasAccessibleLabel) findings.push(finding("high", "accessibility", "unlabeled-control", page,
        "Form control has no associated label or accessible name.", field.selectorHint || field.name || field.type || field.tag,
        "Associate a <label>, aria-label, or aria-labelledby value with the control."));
    }

    for (const button of features.buttons || []) {
      if (!button.accessibleName) findings.push(finding("high", "accessibility", "unnamed-button", page,
        "Visible button has no accessible name.", button.selectorHint || "unnamed button", "Add visible text or an accessible name."));
    }
    for (const link of features.links || []) {
      if (!link.accessibleName) findings.push(finding("high", "accessibility", "unnamed-link", page,
        "Visible link has no accessible name.", link.selectorHint || link.href, "Add descriptive link text or an accessible name."));
    }

    const chain = page.nav?.redirectChain || [];
    if (insecureHops(chain).length) findings.push(finding("high", "security", "insecure-redirect", page,
      "Navigation redirected through a plaintext HTTP hop.", chain.join(" -> "), INSECURE_REDIRECT_FIX));

    if (page.nav?.ok && page.nav.ms > pageLoadMs) findings.push(finding("medium", "performance", "slow-page", page,
      "Navigation exceeded the configured page-load threshold.", `${page.nav.ms} ms (threshold ${pageLoadMs} ms)`, "Profile the document and critical rendering path."));
    for (const request of page.signals?.requests || []) {
      if (request.kind === "slow" && request.durationMs > slowRequestMs) findings.push(finding("medium", "performance", "slow-request", page,
        "Document or data request exceeded the configured slow-request threshold.", `${request.durationMs} ms ${request.method} ${request.url}`,
        "Profile the endpoint, payload, caching, and request waterfall."));
    }
  }
  return mergeFindings(findings);
}
