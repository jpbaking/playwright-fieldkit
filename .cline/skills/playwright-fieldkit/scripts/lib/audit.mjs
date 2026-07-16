// Small deterministic quality checks over data already collected by crawl.mjs.
// These are intentionally explainable heuristics, not a replacement for WCAG or
// lab-grade performance tooling.

function finding(severity, category, code, page, message, observed, remediation) {
  return { severity, category, code, url: page.url, message, observed, remediation };
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

    if (page.nav?.ok && page.nav.ms > pageLoadMs) findings.push(finding("medium", "performance", "slow-page", page,
      "Navigation exceeded the configured page-load threshold.", `${page.nav.ms} ms (threshold ${pageLoadMs} ms)`, "Profile the document and critical rendering path."));
    for (const request of page.signals?.requests || []) {
      if (request.kind === "slow" && request.durationMs > slowRequestMs) findings.push(finding("medium", "performance", "slow-request", page,
        "Document or data request exceeded the configured slow-request threshold.", `${request.durationMs} ms ${request.method} ${request.url}`,
        "Profile the endpoint, payload, caching, and request waterfall."));
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.url.localeCompare(b.url));
  return findings;
}
