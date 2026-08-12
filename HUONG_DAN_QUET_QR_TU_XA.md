# Cho khách quét mã QR từ mạng bất kỳ

Tài liệu này giải thích vì sao mã QR dán ở bàn chỉ chạy trong quán, và cách mở
hệ thống ra Internet để điện thoại ở mạng nào cũng quét được.

---

## 1. Vì sao địa chỉ `192.168.100.12:3000` không dùng được từ ngoài

Địa chỉ đó là **địa chỉ nội bộ** do router trong quán cấp cho máy chủ. Nó chỉ có
ý nghĩa bên trong mạng đó. Điện thoại đang dùng 4G, hay máy tính của thầy cô ở
nhà, khi gõ địa chỉ này sẽ hỏi router **của họ** xem `192.168.100.12` là máy nào
— và không có máy nào cả.

Vì vậy **gõ tay cũng vô ích**. Không phải sai chính tả, mà là không có đường đi
tới. Muốn người ngoài vào được thì hệ thống phải có một địa chỉ công khai trên
Internet.

Cách thông thường là mua IP tĩnh và mở cổng trên router — vừa tốn tiền, vừa phơi
máy chủ ra Internet. Hệ thống này dùng cách khác: **tunnel**.

---

## 2. Tunnel hoạt động thế nào

```
   Điện thoại khách  ──https──▶  Cloudflare  ──đường đã mở sẵn──▶  Máy chủ quán
       (4G, wifi bất kỳ)                                            (cổng 3000)
```

`cloudflared` chạy trên máy chủ và **tự gọi ra** Cloudflare, rồi giữ kết nối đó.
Khách vào tên miền Cloudflare cấp thì Cloudflare đẩy yêu cầu ngược về theo đường
đã mở sẵn.

Hệ quả:

- **Không phải sửa router**, không cần IP tĩnh, không cần quyền quản trị mạng.
- **Tường lửa Windows không chặn** — đây là kết nối đi ra, không phải đi vào.
- Địa chỉ nhận được là **https với chứng chỉ thật**, nên điện thoại không hiện
  cảnh báo "Kết nối không an toàn" như địa chỉ https tự ký của hệ thống. Nhờ đó
  **chấm công khuôn mặt cũng chạy được** qua đường này, điều mà địa chỉ LAN
  `http://192.168...` không làm được.

---

## 3. Cách dùng

**Bước 1.** Chạy `start_all.bat` như thường lệ, đợi server lên.

**Bước 2.** Nhấp đúp **`_mo_qr_online.bat`** (hoặc `npm run qr:online`).

Lần chạy đầu tiên nó sẽ tự tải `cloudflared` về thư mục `bin/` — khoảng 70 MB,
chỉ một lần duy nhất. Những lần sau vào thẳng.

Sau vài giây cửa sổ hiện ra:

```
╔══════════════════════════════════════════════════════════╗
║  Đã mở ra Internet — điện thoại mạng nào cũng vào được   ║
╚══════════════════════════════════════════════════════════╝
  Địa chỉ: https://sunset-brown-alpha-cash.trycloudflare.com
  Thực đơn: https://sunset-brown-alpha-cash.trycloudflare.com/qr-menu
  Quản trị: https://sunset-brown-alpha-cash.trycloudflare.com/admin
```

**Bước 3.** Vào trang quản trị → mã QR, **in lại** mã và dán lên bàn.

Không cần khởi động lại server. Mã QR tự đổi sang địa chỉ Internet trong vòng 2
giây kể từ khi tunnel lên.

**Giữ cửa sổ đó mở suốt buổi.** Đóng nó là mất địa chỉ.

---

## 4. Điều quan trọng nhất phải nhớ

Tên miền `trycloudflare.com` là **tên miền tạm**: mỗi lần chạy lại sẽ ra một tên
khác. Tờ giấy đã in và dán lên bàn thì không tự đổi theo được.

Nên quy trình đúng luôn là: **mở tunnel trước → rồi mới in mã QR**.

Nếu chỉ để demo hay bảo vệ đồ án thì như vậy là đủ. Còn muốn dán mã QR cố định
lâu dài thì xem mục 6.

---

## 5. Nó nối vào hệ thống ở chỗ nào

| Việc | File |
|---|---|
| Chạy cloudflared, đọc địa chỉ, tự tải về nếu máy chưa có | `scripts/moOnline.js` |
| Ghi địa chỉ ra để server đọc được | `.qr-tunnel` (tự tạo, tự xoá) |
| Chọn địa chỉ nhúng vào mã QR | `utils/diaChiQR.js` — hàm `goc()` |
| Nút nhấp đúp | `_mo_qr_online.bat` |

Thứ tự ưu tiên khi chọn địa chỉ cho mã QR, trong `utils/diaChiQR.js`:

1. `QR_BASE_URL` trong `.env` — đặt khoá này là thắng tất cả.
2. Địa chỉ tunnel trong `.qr-tunnel` nếu đang mở.
3. Tên máy trong request, nếu không phải `localhost`.
4. Địa chỉ LAN đo được bằng socket UDP.

Tắt tunnel là tệp `.qr-tunnel` bị xoá, mã QR tự quay về địa chỉ LAN như cũ.

Nếu tunnel bị đứt giữa chừng (mạng chập chờn, Cloudflare cắt kết nối tạm),
script tự mở lại sau 5 giây — nhưng **địa chỉ mới sẽ khác địa chỉ cũ**, nên phải
in lại mã QR.

---

## 6. Muốn địa chỉ cố định, in mã QR một lần dùng mãi

Ba lựa chọn, từ rẻ tới đắt:

### a. ngrok — miễn phí, một tên miền cố định

Tài khoản ngrok miễn phí được cấp sẵn **một tên miền cố định**, không đổi qua các
lần chạy.

1. Đăng ký tại `ngrok.com`, lấy authtoken và tên miền tĩnh được cấp.
2. Cài: `winget install ngrok.ngrok`
3. `ngrok config add-authtoken <mã của bạn>`
4. Chạy: `ngrok http --url=<tên-miền-của-bạn>.ngrok-free.app 3000`
5. Ghi vào `.env`:
   ```
   QR_BASE_URL=https://<tên-miền-của-bạn>.ngrok-free.app
   ```
   rồi khởi động lại server. Khoá này ưu tiên cao nhất nên mã QR luôn dùng địa
   chỉ đó, bất kể tunnel Cloudflare có mở hay không.

Nhược điểm: bản miễn phí chèn một trang cảnh báo, khách phải bấm "Visit Site"
một lần trước khi vào thực đơn.

### b. Cloudflare Tunnel có tên — cần tên miền riêng

Mua một tên miền (khoảng 200–300 nghìn/năm), trỏ về Cloudflare, rồi tạo tunnel
có tên thay vì tunnel tạm. Địa chỉ cố định, không có trang cảnh báo, đây là cách
dùng thật khi triển khai cho quán. Đặt `QR_BASE_URL` như trên.

### c. Thuê máy chủ

Đưa hệ thống lên VPS. Ổn định nhất nhưng tốn tiền hàng tháng và phải chuyển cả
MySQL lẫn dịch vụ ML lên theo.

---

## 7. Khi có trục trặc

| Hiện tượng | Nguyên nhân |
|---|---|
| Khách vào thấy lỗi **502 Bad Gateway** | Server chưa chạy hoặc đã tắt. Bật `start_all.bat` lên. |
| Chạy `_mo_qr_online.bat` báo không tải được | Máy đang chặn GitHub. Tải `cloudflared-windows-amd64.exe` bằng tay từ trang phát hành của cloudflared, đổi tên thành `cloudflared.exe`, bỏ vào thư mục `bin/`. |
| Mã QR vẫn ra `192.168...` dù tunnel đang mở | Trong `.env` còn khoá `QR_BASE_URL` đang được đặt — khoá đó ưu tiên cao hơn tunnel. Xoá nó đi hoặc để trống. |
| Điện thoại quét ra `localhost` | Mã QR in từ lần trước. In lại từ trang quản trị. |
| Vào được thực đơn nhưng gọi món không cập nhật | Tunnel có hỗ trợ websocket sẵn, thường là do server vừa khởi động lại. Tải lại trang. |

---

## 8. Về bảo mật

Khi tunnel đang mở, **toàn bộ hệ thống ở trên Internet**, kể cả `/admin`. Bảo vệ
duy nhất là mật khẩu đăng nhập.

- Chỉ mở tunnel khi cần, đóng cửa sổ khi xong buổi.
- Đổi các mật khẩu mặc định trong `DANH_SACH_TAI_KHOAN.md` trước khi mở ra ngoài.
- Địa chỉ `trycloudflare.com` là tên ngẫu nhiên, không ai đoán được và không bị
  công cụ tìm kiếm lập chỉ mục — nhưng đó không phải là bảo mật, chỉ là ít bị để
  ý.
