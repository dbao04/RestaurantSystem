# Hướng dẫn đưa hệ thống lên Internet (VPS + tên miền)

Toàn bộ việc cài đặt đã được viết thành script trong thư mục `deploy/`. Bạn chỉ cần
thuê VPS, mua tên miền và chạy 3 lệnh.

## 1. Thuê VPS và mua tên miền

| Cần | Gợi ý | Chi phí tham khảo |
|---|---|---|
| VPS Ubuntu 22.04 / 24.04, **tối thiểu 2 GB RAM**, 2 CPU, 25 GB SSD | Vietnix, AZDIGI, BizFly Cloud, DigitalOcean, Vultr | 120–250 nghìn/tháng |
| Tên miền | Mắt Bão, PA Việt Nam, Tenten (.vn) · Namecheap, Cloudflare (.com) | .com ~300 nghìn/năm · .vn ~750 nghìn/năm |

Sau khi mua, vào trang quản lý tên miền, tạo **2 bản ghi DNS** trỏ về IP của VPS:

| Loại | Tên | Giá trị |
|---|---|---|
| A | `@` | IP của VPS |
| A | `www` | IP của VPS |

Đợi 5–30 phút cho DNS cập nhật (kiểm tra: `ping tenmien.vn` ra đúng IP VPS).

## 2. Đóng gói dữ liệu thật (trên máy Windows đang có XAMPP)

MySQL trong XAMPP phải đang bật. Mở PowerShell tại thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\dong-goi-du-lieu.ps1
```

Kết quả: `deploy\goi\deploy-goi.zip` gồm CSDL, ảnh khuôn mặt, mô hình AI, cấu hình
email/VietQR. **File này chứa dữ liệu khách hàng — không gửi lên GitHub** (đã có sẵn
trong `.gitignore`).

## 3. Gửi gói lên VPS và chạy cài đặt

```powershell
scp deploy\goi\deploy-goi.zip root@IP_VPS:/root/
scp deploy\cai-dat-vps.sh root@IP_VPS:/root/
ssh root@IP_VPS
```

Trên VPS:

```bash
bash /root/cai-dat-vps.sh tenmien.vn email-cua-ban@gmail.com
```

Script tự làm: cài Node 24, MariaDB, nginx, Python + dịch vụ AI, pm2; tạo tài khoản
CSDL riêng với mật khẩu ngẫu nhiên; nạp dữ liệu; tạo `.env` production
(`NODE_ENV=production`, `SESSION_SECRET` ngẫu nhiên, tắt thanh toán giả lập); xin
chứng chỉ HTTPS miễn phí; bật tường lửa; sao lưu CSDL mỗi đêm lúc 2:00 (giữ 14 ngày,
tại `/var/backups/nhahang`). Mất khoảng 10–15 phút.

Xong thì mở `https://tenmien.vn`.

## 4. Việc phải làm ngay sau khi lên

1. **Đổi mật khẩu các tài khoản nhân viên đang dùng `123456`.**
2. Kiểm tra cấu hình tài khoản ngân hàng nhận tiền VietQR.
3. In lại mã QR dán bàn (địa chỉ đã đổi sang tên miền mới).
4. Thử gửi email quên mật khẩu.

## Vận hành hằng ngày

| Việc | Lệnh (trên VPS, quyền root) |
|---|---|
| Cập nhật code mới từ GitHub | `bash /home/nhahang/app/deploy/cap-nhat.sh` |
| Xem log web | `sudo -u nhahang pm2 logs nhahang` |
| Khởi động lại web | `sudo -u nhahang pm2 restart nhahang` |
| Sao lưu ngay | `/usr/local/bin/nhahang-sao-luu` |
| Mật khẩu CSDL | `cat /root/.nhahang_db_pass` |

## Ghi chú kỹ thuật

- Web chạy cổng 3000 (chỉ nội bộ), nginx nhận 80/443 và chuyển vào. `TRUST_PROXY`
  để trống vì nginx chạy cùng máy.
- Cookie phiên tự gắn `Secure` qua HTTPS; phiên lưu trong bảng `phien_dang_nhap`.
- Web chỉ chạy **1 tiến trình** (Socket.IO và các tác vụ nền giữ trạng thái trong bộ
  nhớ) — muốn chịu tải lớn hơn thì nâng cấu hình VPS, không bật cluster.
- Nhánh được deploy mặc định là `doan`; đổi bằng `NHANH=main bash cai-dat-vps.sh ...`.
