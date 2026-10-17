import asyncio
import os
from playwright.async_api import async_playwright
import docx

SCREENSHOT_DIR = r"H:\NhaHang\NhaHang\screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1400, 'height': 900})
        page = await context.new_page()

        # Đăng nhập Quản lý
        print("1. Đăng nhập Quản lý...")
        await page.goto("http://127.0.0.1:3000/staff/login")
        await page.fill('input[name="username"]', 'quanly')
        await page.fill('input[name="password"]', '123456')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)

        # Chụp Màn hình Tính tiền & Chia hóa đơn (Hình 6.5)
        print("2. Chụp Màn hình Tính tiền (Hình 6.5)...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan/1wcjn8bcl5q4sd1jz")
        await page.wait_for_timeout(2000)
        hinh_6_5_path = os.path.join(SCREENSHOT_DIR, "hinh_6_5_tinh_tien.png")
        await page.screenshot(path=hinh_6_5_path)
        print("-> Đã chụp xong Hình 6.5:", hinh_6_5_path)

        # Chụp Màn hình Đối soát giao dịch ngân hàng (Hình 6.6)
        print("3. Chụp Màn hình Đối soát (Hình 6.6)...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan/doi-soat")
        await page.wait_for_timeout(2000)
        hinh_6_6_path = os.path.join(SCREENSHOT_DIR, "hinh_6_6_doi_soat.png")
        await page.screenshot(path=hinh_6_6_path)
        print("-> Đã chụp xong Hình 6.6:", hinh_6_6_path)

        await browser.close()

    # Cập nhật trực tiếp vào file Word
    doc_path = r"H:\NhaHang\NhaHang\BaoCao_KLTN_HeThongQuanLyNhaHang.docx"
    doc = docx.Document(doc_path)

    # rId41 là Hình 6.5 (Tính tiền)
    if "rId41" in doc.part.rels:
        with open(hinh_6_5_path, "rb") as f:
            doc.part.rels["rId41"].target_part._blob = f.read()
        print("-> Cập nhật rId41 (Hình 6.5) thành công!")

    # rId42 là Hình 6.6 (Đối soát)
    if "rId42" in doc.part.rels:
        with open(hinh_6_6_path, "rb") as f:
            doc.part.rels["rId42"].target_part._blob = f.read()
        print("-> Cập nhật rId42 (Hình 6.6) thành công!")

    doc.save(doc_path)
    print(">>> ĐÃ CẬP NHẬT CHÍNH XÁC CẢ HÌNH 6.5 VÀ 6.6 VÀO FILE WORD! <<<")

if __name__ == '__main__':
    asyncio.run(run())
