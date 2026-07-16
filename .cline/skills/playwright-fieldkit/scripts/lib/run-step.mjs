// Executes one flow step against a live page. Shared by flow.mjs (journey
// runner) and save-auth.mjs (scripted login) so both interpret the flow
// vocabulary identically. The expect* steps wait and retry with the same
// semantics as the auto-retrying assertions gen-test.mjs emits, so a verified
// flow and the test generated from it agree on timing.

import { gotoSafe } from "./browser.mjs";
import { flowAction } from "./flow-actions.mjs";
import { auditPageState } from "./state-audit.mjs";
import { join, truncate } from "./util.mjs";

const EXPECT_TIMEOUT = 10000;

async function pollFor(page, probe, timeout = EXPECT_TIMEOUT) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const result = await probe();
    if (result.ok || Date.now() >= deadline) return result;
    await page.waitForTimeout(100);
  }
}

export async function runStep(page, step, ctx) {
  const action = flowAction(step);
  const target = step[action];
  const value = step.value;
  switch (action) {
    case "mockResponse": {
      const status = Number(step.status ?? 200);
      if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error(`invalid mock status: ${step.status}`);
      const body = typeof step.body === "string" ? step.body : JSON.stringify(step.body ?? {});
      await page.route(target, (route) => route.fulfill({
        status,
        body,
        contentType: step.contentType || (typeof step.body === "string" ? "text/plain" : "application/json"),
        headers: step.headers || {},
      }));
      return `mocked ${target} with HTTP ${status}`;
    }
    case "mockAbort":
      await page.route(target, (route) => route.abort(step.errorCode || "failed"));
      return `aborted requests matching ${target}`;
    case "goto": {
      const url = /^https?:/.test(target) ? target : (ctx.baseUrl || "") + target;
      ctx.scope.assertAllowed(url, "Flow navigation");
      const nav = await gotoSafe(page, url, { timeout: 30000 });
      if (!nav.ok) throw new Error(`goto failed: ${nav.error}`);
      return `navigated to ${url} (${nav.status})`;
    }
    case "click":
      await page.locator(target).first().click({ timeout: 10000 });
      return `clicked ${target}`;
    case "fill":
      await page.locator(target).first().fill(String(value ?? ""), { timeout: 10000 });
      return `filled ${target}`;
    case "type":
      await page.locator(target).first().pressSequentially(String(value ?? ""), { timeout: 10000 });
      return `typed into ${target}`;
    case "select":
      await page.locator(target).first().selectOption(String(value ?? ""), { timeout: 10000 });
      return `selected ${value} in ${target}`;
    case "check":
      await page.locator(target).first().check({ timeout: 10000 });
      return `checked ${target}`;
    case "uncheck":
      await page.locator(target).first().uncheck({ timeout: 10000 });
      return `unchecked ${target}`;
    case "press":
      if (step.selector) await page.locator(step.selector).first().press(target, { timeout: 10000 });
      else await page.keyboard.press(target);
      return `pressed ${target}`;
    case "hover":
      await page.locator(target).first().hover({ timeout: 10000 });
      return `hovered ${target}`;
    case "scrollTo":
      await page.locator(target).first().scrollIntoViewIfNeeded({ timeout: 10000 });
      return `scrolled to ${target}`;
    case "waitFor":
      await page.locator(target).first().waitFor({ state: "visible", timeout: 15000 });
      return `saw ${target}`;
    case "waitForUrl":
      await page.waitForURL((u) => u.toString().includes(target), { timeout: 15000 });
      return `url reached ${target}`;
    case "wait":
      await page.waitForTimeout(Number(target) || 0);
      return `waited ${target}ms`;
    case "expectText": {
      const found = await page.getByText(target, { exact: false }).first()
        .waitFor({ state: "visible", timeout: EXPECT_TIMEOUT }).then(() => true).catch(() => false);
      if (!found) throw new Error(`expected text not visible: "${target}"`);
      return `verified text "${truncate(target, 40)}"`;
    }
    case "expectUrl": {
      const reached = await page.waitForURL((u) => u.toString().includes(target), { timeout: EXPECT_TIMEOUT })
        .then(() => true).catch(() => false);
      if (!reached) throw new Error(`expected url to include "${target}" but was ${page.url()}`);
      return `verified url contains "${target}"`;
    }
    case "expectVisible": {
      const vis = await page.locator(target).first()
        .waitFor({ state: "visible", timeout: EXPECT_TIMEOUT }).then(() => true).catch(() => false);
      if (!vis) throw new Error(`expected visible: ${target}`);
      return `verified ${target} visible`;
    }
    case "expectNotVisible": {
      // Passes if the element is absent or hidden — waits for it to disappear.
      try {
        await page.locator(target).first().waitFor({ state: "hidden", timeout: EXPECT_TIMEOUT });
      } catch {
        throw new Error(`expected NOT visible, but it is: ${target}`);
      }
      return `verified ${target} not visible`;
    }
    case "expectValue": {
      const expected = String(value ?? "");
      const last = await pollFor(page, async () => {
        const actual = await page.locator(target).first().inputValue({ timeout: 1000 }).catch(() => null);
        return { ok: actual === expected, actual };
      });
      if (!last.ok) throw new Error(`expected value "${value}" in ${target} but got "${last.actual}"`);
      return `verified value of ${target}`;
    }
    case "expectCount": {
      const expected = Number(value);
      const last = await pollFor(page, async () => {
        const n = await page.locator(target).count();
        return { ok: n === expected, n };
      });
      if (!last.ok) throw new Error(`expected ${value} matches for ${target} but found ${last.n}`);
      return `verified count ${last.n} for ${target}`;
    }
    case "auditA11y": {
      const issues = await auditPageState(page, Array.isArray(step.allow) ? step.allow : []);
      if (issues.length) throw new Error(`accessibility audit "${target}" found: ${issues.map((issue) => `${issue.code}${issue.selector ? `@${issue.selector}` : ""}`).join(", ")}`);
      return `audited accessibility state "${target}"`;
    }
    case "screenshot": {
      const file = `${String(ctx.index).padStart(2, "0")}-${String(target).replace(/[^a-z0-9]+/gi, "-")}.png`;
      await page.screenshot({ path: join(ctx.outDir, file) }).catch(() => {});
      return `screenshot ${file}`;
    }
    default:
      throw new Error(`unknown action "${action}" in step ${JSON.stringify(step)}`);
  }
}
