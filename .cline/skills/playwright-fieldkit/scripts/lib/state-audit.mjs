// Lightweight accessibility checks that can run at any point in an interactive
// flow. This intentionally complements, rather than replaces, axe/manual review.

export function stateAuditInPage(allowed) {
  const allow = new Set(allowed || []);
  const issues = [];
  const push = (code, element, detail) => {
    if (allow.has(code)) return;
    const selector = element
      ? element.tagName.toLowerCase() + (element.id
        ? `#${element.id}`
        : element.getAttribute("name")
          ? `[name="${element.getAttribute("name")}"]`
          : "")
      : null;
    issues.push({ code, selector, detail });
  };
  const named = (element) => {
    const labelledby = (element.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
    return Boolean(
      (element.getAttribute("aria-label") || "").trim()
      || labelledby
      || (element.getAttribute("title") || "").trim()
      || (element.textContent || "").trim()
      || (element.querySelector("img[alt]")?.getAttribute("alt") || "").trim(),
    );
  };
  const visible = (element) => {
    if (element.hidden || element.closest('[hidden],[aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const explicitlyNamed = (element) => {
    const labelledby = (element.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .some((id) => (document.getElementById(id)?.textContent || "").trim());
    return Boolean((element.getAttribute("aria-label") || "").trim() || labelledby || (element.getAttribute("title") || "").trim());
  };
  if (!(document.documentElement.getAttribute("lang") || "").trim()) push("missing-lang", document.documentElement, "Document has no language.");
  if (!document.querySelector('main,[role="main"]')) push("missing-main", document.body, "No main landmark.");
  const headings = document.querySelectorAll("h1");
  if (headings.length !== 1) push("h1-count", document.body, `Expected exactly one h1; found ${headings.length}.`);
  for (const element of document.querySelectorAll('input:not([type="hidden"]),select,textarea')) {
    if (!visible(element)) continue;
    const id = element.id;
    const hasLabel = Boolean(
      (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
      || element.closest("label")
      || element.getAttribute("aria-label")
      || element.getAttribute("aria-labelledby")
      || element.getAttribute("title"),
    );
    if (!hasLabel) push("unlabeled-control", element, "Form control has no accessible label.");
  }
  for (const element of document.querySelectorAll('button,[role="button"]')) if (visible(element) && !named(element)) push("unnamed-button", element, "Button has no accessible name.");
  for (const element of document.querySelectorAll('a[href],[role="link"]')) if (visible(element) && !named(element)) push("unnamed-link", element, "Link has no accessible name.");
  for (const element of document.querySelectorAll('dialog,[role="dialog"],[role="alertdialog"]')) if (visible(element) && !explicitlyNamed(element)) push("unnamed-dialog", element, "Dialog has no accessible name.");
  return issues;
}

export const STATE_AUDIT_SOURCE = stateAuditInPage.toString();

export async function auditPageState(page, allowed = []) {
  return page.evaluate(stateAuditInPage, allowed);
}
