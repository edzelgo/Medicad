// End-to-end: real mouse clicks on the homepage sign-in buttons must land on
// /auth with the correct role query param.
//
// Run with:  node tests/e2e/homepage-auth-links.spec.mjs
// Requires the dev server on http://localhost:8080 (already running in sandbox).

import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";

const CASES = [
  { name: "header 'Sign in' (client)", selector: 'header a[href="/auth?role=client"]', role: "client" },
  { name: "header 'Staff sign in'",    selector: 'header a[href="/auth?role=staff"]',  role: "staff"  },
  { name: "portal card Agent",         selector: 'a[href="/auth?role=agent"]',         role: "agent"  },
  { name: "portal card Referral",      selector: 'a[href="/auth?role=referral"]',      role: "referral" },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const failures = [];

  for (const c of CASES) {
    const page = await context.newPage();
    try {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      // Wait for hydration so the capture-phase click handler is attached.
      await page.waitForLoadState("networkidle").catch(() => {});
      const link = page.locator(c.selector).first();
      await link.waitFor({ state: "visible", timeout: 5000 });
      await link.scrollIntoViewIfNeeded();
      await link.click(); // real trusted mouse click
      await page.waitForURL(/\/auth\?/, { timeout: 5000 });
      const url = new URL(page.url());
      assert.equal(url.pathname, "/auth", `${c.name}: pathname`);
      assert.equal(url.searchParams.get("role"), c.role, `${c.name}: role param`);
      console.log(`✓ ${c.name} → ${url.pathname}?role=${url.searchParams.get("role")}`);
    } catch (err) {
      failures.push({ case: c.name, url: page.url(), error: err.message });
      console.error(`✗ ${c.name}: ${err.message} (current=${page.url()})`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`, failures);
    process.exit(1);
  }
  console.log(`\nAll ${CASES.length} homepage auth links navigate correctly.`);
}

run().catch((e) => { console.error(e); process.exit(1); });