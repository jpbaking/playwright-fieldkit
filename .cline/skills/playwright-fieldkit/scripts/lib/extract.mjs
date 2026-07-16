// In-page feature extraction. `extractPageFeatures` runs inside the browser and
// returns a structured description of everything a user could see or interact
// with on the current page — the raw material for feature discovery and tests.

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<object>} structured page features
 */
export function extractPageFeatures(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    // A stable-ish selector hint so a downstream test has something to target.
    const selectorHint = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const testId = el.getAttribute("data-testid") || el.getAttribute("data-test") || el.getAttribute("data-cy");
      if (testId) return `[data-testid="${testId}"]`;
      const label = el.getAttribute("aria-label");
      if (label) return `${el.tagName.toLowerCase()}[aria-label="${label}"]`;
      const name = el.getAttribute("name");
      if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
      if (el.tagName === "A" && el.getAttribute("href")) {
        const href = el.getAttribute("href").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `a[href="${href}"]`;
      }
      const t = text(el);
      if (t && el.tagName === "BUTTON") return `role=button >> text=${t}`;
      return null;
    };

    // Links (same-doc navigation targets)
    const links = [...document.querySelectorAll("a[href]")]
      .filter((a) => visible(a))
      .map((a) => ({
        href: a.href,
        declaredHref: a.getAttribute("href"),
        text: text(a),
        accessibleName: text(a) || a.getAttribute("aria-label") || a.getAttribute("aria-labelledby") || a.getAttribute("title") || a.querySelector("img[alt]")?.alt || "",
        rel: a.rel || null,
        target: a.target || null,
        selectorHint: selectorHint(a),
      }));

    const assets = [...document.querySelectorAll("img[src],script[src],link[href],source[src],video[src],audio[src]")]
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        url: el.src || el.href,
        declaredUrl: el.getAttribute("src") || el.getAttribute("href"),
      }))
      .filter((asset) => /^https?:/i.test(asset.url));

    // Forms + fields
    const fieldInfo = (el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      name: el.name || null,
      id: el.id || null,
      required: el.required || false,
      visible: visible(el),
      placeholder: el.placeholder || null,
      label:
        (el.labels && el.labels[0] && text(el.labels[0])) ||
        el.getAttribute("aria-label") ||
        el.placeholder ||
        null,
      hasAccessibleLabel: !!(
        (el.labels && [...el.labels].some((label) => text(label))) ||
        el.getAttribute("aria-label")?.trim() ||
        el.getAttribute("aria-labelledby")
      ),
      selectorHint: selectorHint(el),
    });
    const controls = [...document.querySelectorAll("input,select,textarea")].map(fieldInfo);
    const forms = [...document.querySelectorAll("form")].map((f, i) => ({
      index: i,
      action: f.action || null,
      method: (f.method || "get").toLowerCase(),
      name: f.getAttribute("name") || f.id || null,
      selectorHint: selectorHint(f),
      fields: [...f.querySelectorAll("input,select,textarea")].map(fieldInfo),
      submit: (() => {
        const btn = f.querySelector('[type=submit],button:not([type=button])');
        return btn ? { text: text(btn), selectorHint: selectorHint(btn) } : null;
      })(),
    }));

    // Buttons and role=button elements not inside a form's submit
    const buttons = [...document.querySelectorAll('button,[role=button],input[type=button],input[type=submit]')]
      .filter((b) => visible(b))
      .map((b) => ({
        text: text(b) || b.value || b.getAttribute("aria-label") || "",
        accessibleName: text(b) || b.value || b.getAttribute("aria-label") || b.getAttribute("aria-labelledby") || "",
        disabled: b.disabled || b.getAttribute("aria-disabled") === "true",
        selectorHint: selectorHint(b),
      }));

    // Interactive "feature" signals a human would notice: tabs, menus, dialogs,
    // accordions, toggles, search boxes, and things that toggle expansion.
    const interactive = [...document.querySelectorAll(
      '[role=tab],[role=menuitem],[role=menu],[role=dialog],[aria-haspopup],[aria-expanded],[role=switch],[role=search],details,[contenteditable=true]'
    )]
      .filter((el) => visible(el))
      .map((el) => ({
        role: el.getAttribute("role") || el.tagName.toLowerCase(),
        text: text(el),
        ariaExpanded: el.getAttribute("aria-expanded"),
        ariaHasPopup: el.getAttribute("aria-haspopup"),
        selectorHint: selectorHint(el),
      }))
      .slice(0, 60);

    // Landmarks / structure
    const landmarks = [...document.querySelectorAll("header,nav,main,aside,footer,[role]")]
      .filter((el) => visible(el))
      .map((el) => ({ tag: el.tagName.toLowerCase(), role: el.getAttribute("role") || null, label: el.getAttribute("aria-label") || null }))
      .slice(0, 40);

    const headings = [...document.querySelectorAll("h1,h2,h3")]
      .filter((h) => visible(h))
      .map((h) => ({ level: Number(h.tagName[1]), text: text(h) }))
      .slice(0, 40);

    // Signals that often mark undocumented / gated features.
    const flags = {
      hasLoginForm: forms.some((f) => f.fields.some((x) => x.type === "password")),
      hasSearch: !!document.querySelector('[type=search],[role=search],input[name*=search i],input[placeholder*=search i]'),
      hasFileUpload: !!document.querySelector('input[type=file]'),
      hasIframe: document.querySelectorAll("iframe").length,
      featureFlagHints: [...document.querySelectorAll("[class*=beta i],[class*=experimental i],[data-feature],[data-flag]")]
        .slice(0, 20)
        .map((el) => ({ text: text(el), cls: el.className?.toString().slice(0, 80) || null })),
      // Elements hidden now but present in the DOM often reveal gated features.
      // Excluded as noise: same-page #anchors (skip links), and non-navigational
      // hrefs (javascript:/mailto:/tel:) like close buttons and contact links.
      hiddenNav: [...document.querySelectorAll("a[href]")]
        .filter((a) => {
          if (visible(a) || !(a.textContent || "").trim()) return false;
          const href = a.getAttribute("href") || "";
          if (href.startsWith("#") || /^(javascript:|mailto:|tel:)/i.test(href)) return false;
          return /^https?:/i.test(a.href);
        })
        .slice(0, 30)
        .map((a) => ({ href: a.href, text: text(a) })),
    };

    return {
      title: document.title,
      url: location.href,
      lang: document.documentElement.lang || null,
      counts: {
        links: links.length,
        forms: forms.length,
        buttons: buttons.length,
        interactive: interactive.length,
        iframes: flags.hasIframe,
      },
      headings,
      landmarks,
      links,
      assets,
      forms,
      controls,
      buttons,
      interactive,
      flags,
    };
  });
}
