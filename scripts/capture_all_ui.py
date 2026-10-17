import asyncio
import os
from playwright.async_api import async_playwright

SCREENSHOT_DIR = r"H:\NhaHang\NhaHang\screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def capture_all():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # 1. Màn hình Khách hàng Desktop
        context_desktop = await browser.new_context(viewport={'width': 1400, 'height': 900})
        page = await context_desktop.new_page()

        print("1. Trang chủ...")
        await page.goto("http://127.0.0.1:3000/")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_trang_chu.png"))

        print("2. Đặt bàn trực tuyến...")
        await page.goto("http://127.0.0.1:3000/reservation")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_dat_ban.png"))

        # Đăng nhập Quản lý
        print("Đăng nhập tài khoản Quản lý...")
        await page.goto("http://127.0.0.1:3000/staff/login")
        await page.fill('input[name="username"]', 'quanly')
        await page.fill('input[name="password"]', '123456')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)

        # 3. Sơ đồ bàn (toàn cảnh)
        print("3. Sơ đồ bàn tổng quan...")
        await page.goto("http://127.0.0.1:3000/staff/so-do-ban")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_3_so_do_ban_tong_quan.png"))

        # 4. Sơ đồ bàn với modal thao tác bàn
        print("4. Sơ đồ bàn với modal bàn...")
        try:
            ban_el = await page.query_selector('.ban-card, .table-card, [data-id], .ban-item')
            if ban_el:
                await ban_el.click()
                await page.wait_for_timeout(800)
        except Exception as e:
            print("Modal click:", e)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_2_so_do_ban_chi_tiet.png"))

        # 5. Thu ngân & Thanh toán
        print("5. Thu ngân...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_4_thu_ngan.png"))

        # 6. Màn hình chi tiết tính tiền (hóa đơn / chia bill)
        print("6. Chi tiết tính tiền...")
        try:
            bill_btn = await page.query_selector('a[href*="/staff/thanh-toan/"]')
            if bill_btn:
                await bill_btn.click()
                await page.wait_for_timeout(1500)
            else:
                await page.goto("http://127.0.0.1:3000/staff/thanh-toan")
        except:
            pass
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_5_tinh_tien.png"))

        # 7. Đối soát giao dịch ngân hàng
        print("7. Đối soát giao dịch...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan/doi-soat")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_6_doi_soat.png"))

        # 8. Lịch sử giao dịch
        print("8. Lịch sử giao dịch...")
        await page.goto("http://127.0.0.1:3000/staff/thanh-toan/lich-su")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_7_lich_su_thanh_toan.png"))

        # 9. Bếp KDS
        print("9. Màn hình bếp KDS...")
        await page.goto("http://127.0.0.1:3000/staff/kds")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_kds_bep.png"))

        # 10. Giao hàng
        print("10. Phân hệ giao hàng...")
        await page.goto("http://127.0.0.1:3000/staff/giao-hang")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_giao_hang.png"))

        # 11. Bản đồ giao hàng
        print("11. Bản đồ giao hàng...")
        await page.goto("http://127.0.0.1:3000/staff/giao-hang/ban-do")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_ban_do_giao_hang.png"))

        # 12. Cơ cấu tổ chức
        print("12. Cơ cấu tổ chức...")
        await page.goto("http://127.0.0.1:3000/staff/to-chuc")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_co_cau_to_chuc.png"))

        # 13. Bảng lương nhân viên
        print("13. Bảng lương...")
        await page.goto("http://127.0.0.1:3000/staff/accountant/salary")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_bang_luong.png"))

        # 14. Báo cáo doanh thu & kho
        print("14. Báo cáo tài chính...")
        await page.goto("http://127.0.0.1:3000/staff/accountant/reports")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_bao_cao.png"))

        # Đăng nhập Admin & Cấu hình hệ thống
        print("15. Đăng nhập Admin...")
        await page.goto("http://127.0.0.1:3000/admin/login")
        await page.fill('input[name="adminuser"]', 'admin')
        await page.fill('input[name="adminpass"]', '123456')
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(1500)
        await page.goto("http://127.0.0.1:3000/admin")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_9_cau_hinh_he_thong.png"))

        await context_desktop.close()

        # 16. Màn hình Mobile (QR Menu & Chấm công di động)
        print("16. Chụp Mobile View (QR Menu & Chấm công)...")
        context_mobile = await browser.new_context(viewport={'width': 412, 'height': 850}, is_mobile=True)
        page_m = await context_mobile.new_page()

        # QR Menu khách gọi món
        await page_m.goto("http://127.0.0.1:3000/table/1")
        await page_m.wait_for_timeout(1500)
        await page_m.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_6_8_qr_menu_mobile.png"))

        # Chấm công di động (sau khi login nv)
        await page_m.goto("http://127.0.0.1:3000/staff/login")
        await page_m.fill('input[name="username"]', 'phucvu')
        await page_m.fill('input[name="password"]', '123456')
        await page_m.click('button[type="submit"]')
        await page_m.wait_for_timeout(1500)
        await page_m.goto("http://127.0.0.1:3000/staff/cham-cong-dien-thoai")
        await page_m.wait_for_timeout(1500)
        await page_m.screenshot(path=os.path.join(SCREENSHOT_DIR, "hinh_cham_cong_di_dong.png"))

        await context_mobile.close()
        await browser.close()
        print(">>> HOÀN TẤT CHỤP TẤT CẢ GIAO DIỆN CHÍNH XÁC VÀ ĐẸP MẮT! <<<")

if __name__ == '__main__':
    asyncio.run(capture_all())
