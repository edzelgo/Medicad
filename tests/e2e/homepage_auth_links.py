"""End-to-end: real mouse clicks on the homepage sign-in buttons must land on
/auth with the correct role query param.

Run:  python3 tests/e2e/homepage_auth_links.py
Env:  BASE_URL (default http://localhost:8080)
"""
import asyncio
import os
import sys
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080")

CASES = [
    ("header 'Sign in' (client)", 'header a[href="/auth?role=client"]', "client"),
    ("header 'Staff sign in'",    'header a[href="/auth?role=staff"]',  "staff"),
    ("portal card Agent",         'a[href="/auth?role=agent"]',         "agent"),
    ("portal card Referral",      'a[href="/auth?role=referral"]',      "referral"),
]

async def main() -> int:
    failures = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        for name, selector, expected_role in CASES:
            page = await context.new_page()
            try:
                await page.goto(BASE, wait_until="domcontentloaded")
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass
                link = page.locator(selector).first
                await link.wait_for(state="visible", timeout=5000)
                await link.scroll_into_view_if_needed()
                await link.click()  # real trusted mouse click
                await page.wait_for_url("**/auth?**", timeout=5000)
                u = urlparse(page.url)
                role = parse_qs(u.query).get("role", [None])[0]
                assert u.path == "/auth", f"pathname={u.path}"
                assert role == expected_role, f"role={role} expected={expected_role}"
                print(f"PASS {name} -> {u.path}?role={role}")
            except Exception as e:
                failures.append((name, page.url, str(e)))
                print(f"FAIL {name}: {e} (current={page.url})")
            finally:
                await page.close()
        await browser.close()

    if failures:
        print(f"\n{len(failures)} failure(s):")
        for f in failures:
            print(" -", f)
        return 1
    print(f"\nAll {len(CASES)} homepage auth links navigate correctly.")
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))