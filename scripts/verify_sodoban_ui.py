import asyncio
import os
from playwright.async_api import async_playwright

async def capture_sodoban_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1400, 'height': 900})
        page = await context.new_page()

        # Login
        await page.goto("http://127.0.0.1:3000/staff/login")
        await page.fill('input[name="username"]', 'quanly')
        await page.fill('input[name="password"]', '123456')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)

        # Vào sơ đồ bàn
        await page.goto("http://127.0.0.1:3000/staff/so-do-ban")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=r"H:\NhaHang\NhaHang\screenshots\test_sodoban_homnay.png")
        print("Đã chụp sơ đồ bàn hôm nay!")

        # Đổi sang ngày mai
        await page.fill('#chonNgaySDB', '2026-10-10')
        await page.evaluate("() => doiNgayXem('2026-10-10')")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=r"H:\NhaHang\NhaHang\screenshots\test_sodoban_ngaymai.png")
        print("Đã chụp sơ đồ bàn ngày mai!")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(capture_sodoban_test())
