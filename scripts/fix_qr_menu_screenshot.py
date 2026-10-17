import asyncio
import os
from playwright.async_api import async_playwright
import docx

SCREENSHOT_DIR = r"H:\NhaHang\NhaHang\screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 412, 'height': 850}, is_mobile=True)
        page = await context.new_page()

        print("Chụp đúng màn hình Menu QR...")
        await page.goto("http://127.0.0.1:3000/qr/table/TMPM44AJJ")
        await page.wait_for_timeout(2000)
        qr_menu_path = os.path.join(SCREENSHOT_DIR, "hinh_6_8_qr_menu_mobile.png")
        await page.screenshot(path=qr_menu_path)
        print("Đã chụp xong:", qr_menu_path)
        await browser.close()

    # Cập nhật ngay vào file docx
    doc_path = r"H:\NhaHang\NhaHang\BaoCao_KLTN_HeThongQuanLyNhaHang.docx"
    doc = docx.Document(doc_path)
    if "rId44" in doc.part.rels:
        rel = doc.part.rels["rId44"]
        with open(qr_menu_path, "rb") as f:
            rel.target_part._blob = f.read()
        doc.save(doc_path)
        print(">>> ĐÃ CẬP NHẬT THÀNH CÔNG HÌNH 6.8 VÀO FILE WORD! <<<")

if __name__ == '__main__':
    asyncio.run(run())
