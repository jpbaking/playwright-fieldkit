// Convert a verified flow JSON into a Playwright test in the language selected
// by the requested output filename. There is deliberately no language default:
// .py emits Python/pytest, while JS/TS extensions emit @playwright/test.

import { extname } from "node:path";
import { flowAction } from "./flow-actions.mjs";
import { STATE_AUDIT_SOURCE } from "./state-audit.mjs";

function tsString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
}

function pyString(value) {
  // A JSON string literal is also a valid Python string literal.
  return JSON.stringify(String(value));
}

function regexText(value) {
  // Escapes `/` too: the result is embedded in a /…/ regex literal, where an
  // unescaped slash would terminate the literal (`//` even starts a comment).
  return String(value).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function screenshotName(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "-");
}

function stepToTypeScript(step, index) {
  const action = flowAction(step);
  const target = step[action];
  const value = step.value;
  switch (action) {
    case "mockResponse": {
      const body = typeof step.body === "string" ? step.body : JSON.stringify(step.body ?? {});
      const contentType = step.contentType || (typeof step.body === "string" ? "text/plain" : "application/json");
      return `  await page.route(${tsString(target)}, async route => { await route.fulfill({ status: ${Number(step.status ?? 200)}, body: ${tsString(body)}, contentType: ${tsString(contentType)}, headers: ${JSON.stringify(step.headers || {})} }); });`;
    }
    case "mockAbort":
      return `  await page.route(${tsString(target)}, async route => { await route.abort(${tsString(step.errorCode || "failed")}); });`;
    case "goto":
      return `  await page.goto(${tsString(target)});`;
    case "click":
      return `  await page.locator(${tsString(target)}).first().click();`;
    case "fill":
      return `  await page.locator(${tsString(target)}).first().fill(${tsString(value ?? "")});`;
    case "type":
      return `  await page.locator(${tsString(target)}).first().pressSequentially(${tsString(value ?? "")});`;
    case "select":
      return `  await page.locator(${tsString(target)}).first().selectOption(${tsString(value ?? "")});`;
    case "check":
      return `  await page.locator(${tsString(target)}).first().check();`;
    case "uncheck":
      return `  await page.locator(${tsString(target)}).first().uncheck();`;
    case "press":
      return step.selector
        ? `  await page.locator(${tsString(step.selector)}).first().press(${tsString(target)});`
        : `  await page.keyboard.press(${tsString(target)});`;
    case "hover":
      return `  await page.locator(${tsString(target)}).first().hover();`;
    case "scrollTo":
      return `  await page.locator(${tsString(target)}).first().scrollIntoViewIfNeeded();`;
    case "waitFor":
      return `  await expect(page.locator(${tsString(target)}).first()).toBeVisible();`;
    case "waitForUrl":
      return `  await page.waitForURL(/${regexText(target)}/);`;
    case "wait":
      return `  await page.waitForTimeout(${Number(target) || 0});`;
    case "expectText":
      return `  await expect(page.getByText(${tsString(target)}, { exact: false }).first()).toBeVisible();`;
    case "expectUrl":
      return `  await expect(page).toHaveURL(/${regexText(target)}/);`;
    case "expectVisible":
      return `  await expect(page.locator(${tsString(target)}).first()).toBeVisible();`;
    case "expectNotVisible":
      return `  await expect(page.locator(${tsString(target)}).first()).toBeHidden();`;
    case "expectValue":
      return `  await expect(page.locator(${tsString(target)}).first()).toHaveValue(${tsString(value ?? "")});`;
    case "expectCount":
      return `  await expect(page.locator(${tsString(target)})).toHaveCount(${Number(value) || 0});`;
    case "auditA11y":
      return `  const a11yIssues${index} = await page.evaluate(${STATE_AUDIT_SOURCE}, ${JSON.stringify(Array.isArray(step.allow) ? step.allow : [])});\n  expect(a11yIssues${index}, ${tsString(`accessibility state ${target}`)}).toEqual([]);`;
    case "screenshot":
      return `  await page.screenshot({ path: ${tsString(`screenshots/${screenshotName(target)}.png`)} });`;
    default:
      throw new Error(`Cannot generate TypeScript for unsupported action "${action}".`);
  }
}

function pyDict(value) {
  return `{${Object.entries(value || {}).map(([key, item]) => `${pyString(key)}: ${pyString(item)}`).join(", ")}}`;
}

function stepToPython(step, index) {
  const action = flowAction(step);
  const target = step[action];
  const value = step.value;
  switch (action) {
    case "mockResponse": {
      const body = typeof step.body === "string" ? step.body : JSON.stringify(step.body ?? {});
      const contentType = step.contentType || (typeof step.body === "string" ? "text/plain" : "application/json");
      return `    page.route(${pyString(target)}, lambda route: route.fulfill(status=${Number(step.status ?? 200)}, body=${pyString(body)}, content_type=${pyString(contentType)}, headers=${pyDict(step.headers)}))`;
    }
    case "mockAbort":
      return `    page.route(${pyString(target)}, lambda route: route.abort(${pyString(step.errorCode || "failed")}))`;
    case "goto":
      return `    page.goto(${pyString(target)})`;
    case "click":
      return `    page.locator(${pyString(target)}).first.click()`;
    case "fill":
      return `    page.locator(${pyString(target)}).first.fill(${pyString(value ?? "")})`;
    case "type":
      return `    page.locator(${pyString(target)}).first.press_sequentially(${pyString(value ?? "")})`;
    case "select":
      return `    page.locator(${pyString(target)}).first.select_option(${pyString(value ?? "")})`;
    case "check":
      return `    page.locator(${pyString(target)}).first.check()`;
    case "uncheck":
      return `    page.locator(${pyString(target)}).first.uncheck()`;
    case "press":
      return step.selector
        ? `    page.locator(${pyString(step.selector)}).first.press(${pyString(target)})`
        : `    page.keyboard.press(${pyString(target)})`;
    case "hover":
      return `    page.locator(${pyString(target)}).first.hover()`;
    case "scrollTo":
      return `    page.locator(${pyString(target)}).first.scroll_into_view_if_needed()`;
    case "waitFor":
      return `    expect(page.locator(${pyString(target)}).first).to_be_visible()`;
    case "waitForUrl":
      return `    page.wait_for_url(re.compile(re.escape(${pyString(target)})))`;
    case "wait":
      return `    page.wait_for_timeout(${Number(target) || 0})`;
    case "expectText":
      return `    expect(page.get_by_text(${pyString(target)}, exact=False).first).to_be_visible()`;
    case "expectUrl":
      return `    expect(page).to_have_url(re.compile(re.escape(${pyString(target)})))`;
    case "expectVisible":
      return `    expect(page.locator(${pyString(target)}).first).to_be_visible()`;
    case "expectNotVisible":
      return `    expect(page.locator(${pyString(target)}).first).to_be_hidden()`;
    case "expectValue":
      return `    expect(page.locator(${pyString(target)}).first).to_have_value(${pyString(value ?? "")})`;
    case "expectCount":
      return `    expect(page.locator(${pyString(target)})).to_have_count(${Number(value) || 0})`;
    case "auditA11y":
      return `    a11y_issues_${index} = page.evaluate(${pyString(`(${STATE_AUDIT_SOURCE})`)}, ${JSON.stringify(Array.isArray(step.allow) ? step.allow : [])})\n    assert a11y_issues_${index} == [], f"accessibility state ${String(target).replace(/[^a-z0-9 ]/gi, "")}: {a11y_issues_${index}}"`;
    case "screenshot":
      return `    Path("screenshots").mkdir(exist_ok=True)\n    page.screenshot(path=${pyString(`screenshots/${screenshotName(target)}.png`)})`;
    default:
      throw new Error(`Cannot generate Python for unsupported action "${action}".`);
  }
}

function pythonTestName(name) {
  let slug = String(name || "user flow").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!slug) slug = "user_flow";
  if (/^\d/.test(slug)) slug = `flow_${slug}`;
  return `test_${slug}`;
}

export function languageFromTestPath(outputPath) {
  const extension = extname(outputPath).toLowerCase();
  if (extension === ".py") return "python";
  if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(extension)) return "typescript";
  throw new Error(`Cannot infer generated-test language from "${outputPath}". Use a .py filename for Python or a .ts/.js filename for @playwright/test.`);
}

function generateTypeScript(flow) {
  const name = flow.name || "user flow";
  const base = flow.baseUrl
    ? `\n\n// Configure baseURL as ${tsString(flow.baseUrl)}, or make goto() paths absolute.`
    : "";
  const body = flow.steps.map(stepToTypeScript).join("\n");
  return `import { test, expect } from '@playwright/test';
${base}

test(${tsString(name)}, async ({ page }) => {
${body}
});
`;
}

function generatePython(flow) {
  const needsPath = flow.steps.some((step) => flowAction(step) === "screenshot");
  const imports = ["import re", needsPath ? "from pathlib import Path" : null, "", "from playwright.sync_api import Page, expect"].filter((line) => line !== null).join("\n");
  const base = flow.baseUrl
    ? `\n\n# Configure pytest-playwright's base_url as ${pyString(flow.baseUrl)}, or make page.goto() paths absolute.`
    : "";
  const body = flow.steps.map(stepToPython).join("\n");
  return `${imports}${base}\n\n\ndef ${pythonTestName(flow.name)}(page: Page) -> None:\n${body}\n`;
}

export function generateTestFromFlow(flow, outputPath) {
  return languageFromTestPath(outputPath) === "python"
    ? generatePython(flow)
    : generateTypeScript(flow);
}
