import asyncio
import os
from playwright.async_api import async_playwright

SCREENSHOT_DIR = r"H:\NhaHang\NhaHang\screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def capture_all():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1366, 'height': 768})
        page = await context.new_page()

        # 1. Trang chủ / Khách hàng
        print("1. Chụp Trang chủ...")
        await page.goto("http://127.0.0.1:3000/")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_trang_chu.png"))

        # 2. Đặt bàn online
        print("2. Chụp Đặt bàn...")
        await page.goto("http://127.0.0.1:3000/reservation")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_dat_ban.png"))

        # 3. Menu gọi món QR tại bàn
        print("3. Chụp QR Menu...")
        await page.goto("http://127.0.0.1:3000/table/1")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03_qr_menu.png"))

        # Đăng nhập Quản lý để chụp các màn hình nhân viên & quản trị
        print("Đăng nhập tài khoản Quản lý...")
        await page.goto("http://127.0.0.1:3000/staff/login")
        await page.fill('input[name="username"]', 'quanly')
        await page.fill('input[name="password"]', '123456')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)

        # 4. Sơ đồ bàn thời gian thực
        print("4. Chụp Sơ đồ bàn...")
        await page.goto("http://127.0.0.1:3000/staff/so-do-ban")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "04_so_do_ban.png"))

        # 5. Màn hình Bếp KDS
        print("5. Chụp KDS Bếp...")
        await page.goto("http://127.0.0.1:3000/staff/kds")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "05_kds_bep.png"))

        # 6. Thu ngân / Thanh toán
        print("6. Chụp Thu ngân / Thanh toán...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "06_thanh_toan.png"))

        # 7. Đối soát giao dịch
        print("7. Chụp Đối soát thanh toán...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan/doi-soat")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "07_doi_soat.png"))

        # 8. Lịch sử giao dịch
        print("8. Chụp Lịch sử thanh toán...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan/lich-su")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "08_lich_su_thanh_toan.png"))

        # 9. Giao hàng / Bản đồ shipper
        print("9. Chụp Phân hệ giao hàng...")
        await page.goto("http://127.0.0.1:3000/staff/giao-hang")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "09_giao_hang.png"))

        # 10. Bản đồ giao hàng
        print("10. Chụp Bản đồ giao hàng...")
        await page.goto("http://127.0.0.1:3000/staff/giao-hang/ban-do")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "10_ban_do_giao_hang.png"))

        # 11. Chấm công quản lý
        print("11. Chụp Chấm công quản lý...")
        await page.goto("http://127.0.0.1:3000/staff/cham-cong-quan-ly")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "11_cham_cong_quan_ly.png"))

        # 12. Chấm công di động
        print("12. Chụp Chấm công di động...")
        await page.goto("http://127.0.0.1:3000/staff/cham-cong-dien-thoai")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "12_cham_cong_dien_thoai.png"))

        # 13. Chấm công Kiosk AI
        print("13. Chụp Chấm công Kiosk AI...")
        await page.goto("http://127.0.0.1:3000/staff/khuon-mat/kiosk")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "13_kiosk_khuon_mat.png"))

        # 14. Cơ cấu tổ chức
        print("14. Chụp Cơ cấu tổ chức...")
        await page.goto("http://127.0.0.1:3000/staff/to-chuc")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "14_co_cau_to_chuc.png"))

        # 15. Bảng lương nhân viên
        print("15. Chụp Bảng lương...")
        await page.goto("http://127.0.0.1:3000/staff/accountant/salary")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "15_bang_luong.png"))

        # 16. Báo cáo doanh thu & kho
        print("16. Chụp Báo cáo tài chính...")
        await page.goto("http://127.0.0.1:3000/staff/accountant/reports")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "16_bao_cao.png"))

        # Đăng nhập Admin
        print("Đăng nhập Admin...")
        await page.goto("http://127.0.0.1:3000/admin/login")
        await page.fill('input[name="username"]', 'admin')
        await page.fill('input[name="password"]', '123456')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)

        # 17. Quản trị hệ thống
        print("17. Chụp Quản trị...")
        await page.goto("http://127.0.0.1:3000/admin")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "17_admin_dashboard.png"))

        await browser.close()
        print("Hoàn tất chụp ảnh màn hình!")

if __name__ == '__main__':
    asyncio.run(capture_all())
