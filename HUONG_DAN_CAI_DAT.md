# HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN NHÀ HÀNG BẢO ĐOÀN

Dự án đã được đóng gói đầy đủ bao gồm **Mã nguồn (Source Code)** và **Cơ sở dữ liệu (Database)** mới nhất. Bất kỳ ai nhận được file ZIP này đều có thể chạy dự án ngay lập tức bằng cách thực hiện theo các bước đơn giản sau:

---

## 🛠️ YÊU CẦU HỆ THỐNG
* **Node.js** (khuyên dùng bản LTS mới nhất) — chạy máy chủ web.
* **MySQL / MariaDB** (XAMPP, Laragon, hoặc MySQL bản cài riêng) — cơ sở dữ liệu.
* **Python 3.10+** *(tuỳ chọn)* — chỉ cần khi muốn chạy phân hệ AI/Machine Learning.
  Website vẫn hoạt động đầy đủ khi không có Python.

---

## ⚡ CÀI ĐẶT NHANH (4 lệnh)

Mở terminal (CMD / PowerShell) tại thư mục dự án, bảo đảm **MySQL đang chạy**, rồi gõ:

```bash
copy .env.example .env     # 1. Tạo file cấu hình (Linux/macOS: cp .env.example .env)
npm install                # 2. Cài thư viện Node.js
npm run db:setup           # 3. Tạo & nạp toàn bộ cơ sở dữ liệu 
npm start                  # 4. Khởi động website
```

Xong. Mở trình duyệt vào **http://localhost:3000**.

> Nếu MySQL của bạn có mật khẩu hoặc chạy ở cổng khác 3306, hãy mở file `.env`
> vừa tạo và sửa `DB_PASS` / `DB_PORT` **trước khi** chạy lệnh số 3.

---

## 🚀 CÁC BƯỚC CÀI ĐẶT CHI TIẾT

### Bước 1: Giải nén dự án
Giải nén file `restaurant.zip` vào thư mục làm việc của bạn (ví dụ `D:\NhaHang\RestaurantSystem`).

### Bước 2: Tạo file cấu hình `.env`
1. Chép file mẫu `.env.example` thành `.env`:
   ```bash
   copy .env.example .env
   ```
2. Mở `.env` bằng Notepad / VS Code và sửa cho khớp với máy bạn:
   ```env
   DB_HOST=localhost
   DB_PORT=3306      # Cổng MySQL (XAMPP mặc định 3306, đôi khi là 3307)
   DB_USER=root
   DB_PASS=          # Mật khẩu MySQL của bạn (để trống nếu không có)
   DB_NAME=gs_restaurant

   PORT=3000         # Cổng website (HTTP)
   HTTPS_PORT=3443   # Cổng HTTPS — cần cho camera chấm công khuôn mặt
   BAT_HTTPS=1       # Đặt 0 để tắt hẳn HTTPS
   ```

> `HTTPS_PORT` và `BAT_HTTPS` có thể bỏ trống — hệ thống tự dùng 3443 và tự bật.

### Bước 3: Cài đặt thư viện Node.js
```bash
npm install
```

### Bước 4: Nạp cơ sở dữ liệu
Bảo đảm MySQL đang chạy (bật XAMPP Control Panel → Start MySQL), rồi:

```bash
npm run db:setup
```

Lệnh này tự tạo database `gs_restaurant`, nạp toàn bộ **66 bảng** kèm dữ liệu từ
file nguồn duy nhất `database/gs_restaurant.sql`, rồi kiểm tra lại kết quả.
Bạn **không cần** tạo database trước, cũng không cần mở phpMyAdmin.

<details>
<summary>Cách thủ công, nếu không dùng được lệnh trên</summary>

```bash
"C:\xampp\mysql\bin\mysql.exe" -u root < database\gs_restaurant.sql
```

Hoặc dùng phpMyAdmin: tab **Import** → chọn `database/gs_restaurant.sql` → **Go**.
(File nặng ~18 MB, có thể vượt giới hạn upload của phpMyAdmin — khi đó dùng lệnh trên.)
</details>

> ⚠️ `npm run db:setup` **ghi đè toàn bộ** database `gs_restaurant` đang có.

### Bước 5: Chạy dự án
```bash
npm start
```

Terminal sẽ in ra bảng địa chỉ. Nếu thấy bảng đó thì dự án đã chạy thành công:
   ```
   ╔══════════════════════════════════════════════════════════╗
   ║  Hệ thống nhà hàng đã khởi động                          ║
   ╚══════════════════════════════════════════════════════════╝
     Máy tại chỗ:      http://localhost:3000
     Máy tại chỗ (bảo mật): https://localhost:3443

     Điện thoại trong cùng mạng Wi-Fi — CHẤM CÔNG KHUÔN MẶT
     phải dùng địa chỉ https:// dưới đây, http:// sẽ không mở được camera:
        https://192.168.1.50:3443/cham-cong/
   ```

### Bước 6 *(tuỳ chọn)*: Bật phân hệ AI / Machine Learning

Phân hệ dự báo, gợi ý món và trợ lý ảo chạy bằng một tiến trình Python riêng.
Website vẫn hoạt động bình thường khi không bật — các trang dự báo sẽ đọc kết quả
đã lưu sẵn trong cơ sở dữ liệu.

```bash
pip install -r ml_service/requirements.txt   # chỉ cần chạy một lần
npm run ml                                   # mở ở CỬA SỔ TERMINAL RIÊNG
```

Kiểm tra: mở http://127.0.0.1:8000/docs — nếu thấy trang tài liệu API là đã chạy.

---

## 🖥️ KHỞI ĐỘNG TOÀN BỘ HỆ THỐNG

### Cách 1 — Nhấp đúp `start_all.bat` (khuyên dùng)

File này tự kiểm tra và làm hết mọi thứ: bật MySQL nếu chưa chạy, tạo `.env` nếu
thiếu, cài thư viện nếu chưa có, nạp cơ sở dữ liệu nếu database còn trống, rồi mở
ML service và web server ở hai cửa sổ riêng.

### Cách 2 — Gõ lệnh thủ công

Cần **ba tiến trình**, mỗi tiến trình một cửa sổ terminal:

```bash
# Cửa sổ 1 — MySQL (hoặc bật bằng XAMPP Control Panel)
"C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone

# Cửa sổ 2 — Máy chủ web (Node.js, cổng 3000)
npm start

# Cửa sổ 3 — Dịch vụ AI/ML (Python, cổng 8000) — tuỳ chọn
npm run ml
```

### Bảng tra cứu lệnh

| Lệnh | Công dụng |
| :--- | :--- |
| `npm install` | Cài thư viện Node.js (chạy một lần sau khi giải nén) |
| `npm run db:setup` | Tạo & nạp toàn bộ cơ sở dữ liệu từ `database/gs_restaurant.sql` |
| `npm run db:export` | Xuất cơ sở dữ liệu hiện tại đè lên file nguồn (chạy sau khi sửa dữ liệu) |
| `npm start` | Khởi động máy chủ web (cổng 3000 / 3443) |
| `npm run ml` | Khởi động dịch vụ AI/ML (cổng 8000) |
| `start_all.bat` | Khởi động tất cả bằng một cú nhấp đúp |

### Các địa chỉ chính

| Trang | Địa chỉ |
| :--- | :--- |
| Trang khách hàng | http://localhost:3000 |
| Đăng nhập quản trị | http://localhost:3000/admin |
| Dashboard phân tích | http://localhost:3000/analytics |
| Dự báo AI / ML | http://localhost:3000/du-bao |
| Trợ lý ảo (chatbot) | http://localhost:3000/admin/chatbot |
| Màn hình bếp (KDS) | http://localhost:3000/kds |
| Sơ đồ bàn | http://localhost:3000/so-do-ban |
| Tài liệu API của ML | http://127.0.0.1:8000/docs |
| Chấm công bằng điện thoại | https://\<ip-máy-chủ\>:3443/cham-cong/ |

---

## 📱 DÙNG TRÊN ĐIỆN THOẠI

Nhân viên chấm công bằng điện thoại của mình tại **`/cham-cong/`**. Bắt buộc phải
mở bằng `https://` — trình duyệt chỉ cho dùng camera và định vị trong ngữ cảnh
bảo mật, mở bằng `http://` thì `navigator.mediaDevices` không tồn tại và không có
cách nào lách. Các trang khác (đơn hàng, thực đơn, báo cáo) vẫn chạy trên `http://`.

Hai đường vào:

* **Trong mạng Wi-Fi:** `https://<ip-máy-chủ>:3443/cham-cong/` — lần đầu mỗi máy
  phải bấm qua cảnh báo chứng chỉ tự ký một lần.
* **Mạng nào cũng được:** chạy `npm run qr:online`, dùng địa chỉ
  `https://….trycloudflare.com/cham-cong/` — chứng chỉ thật, không có cảnh báo.

Trang `/staff/attendance` trên máy tính có sẵn **mã QR** dẫn tới địa chỉ này để
nhân viên quét, khỏi gõ tay.

👉 Chi tiết, ràng buộc GPS và bảng lỗi thường gặp: **`HUONG_DAN_CHAM_CONG_DIEN_THOAI.md`**

---

## 📧 GỬI EMAIL

Hai chỗ trong hệ thống cần gửi thư: **quên mật khẩu** của khách, và trang
**Gửi Email** của nhân viên (`/staff/emails/send`).

Hệ thống gửi qua Gmail. Cần một tài khoản Google và một **mật khẩu ứng dụng** —
Google đã chặn đăng nhập SMTP bằng mật khẩu thường, nên **mật khẩu Gmail hằng
ngày sẽ không dùng được**.

### Lấy mật khẩu ứng dụng

1. Vào `myaccount.google.com` → **Bảo mật**.
2. Bật **Xác minh 2 bước** (bắt buộc, không bật thì không có bước sau).
3. Vẫn trong trang Bảo mật, tìm ô **Mật khẩu ứng dụng** — hoặc vào thẳng
   `myaccount.google.com/apppasswords`.
4. Đặt tên bất kỳ (ví dụ `NhaHang`) → **Tạo**.
5. Google hiện một chuỗi **16 chữ cái** dạng `abcd efgh ijkl mnop`. Chép lại
   ngay, đóng cửa sổ là không xem lại được nữa.

### Điền vào `.env`

```
EMAIL_USER=dia-chi-cua-ban@gmail.com
EMAIL_PASS=abcdefghijklmnop
```

Dán cả dấu cách cũng chạy, nhưng bỏ đi cho gọn. Sửa xong phải **khởi động lại
server** thì mới có tác dụng.

### Kiểm tra

```bash
npm run mail:test                        # chỉ kiểm tra đăng nhập
npm run mail:test -- ban@gmail.com       # gửi thử một thư thật
```

Lệnh này nói thẳng cái gì đang sai, thay vì để bạn đoán qua thông báo "lỗi khi
gửi email" trên giao diện.

### Những lỗi hay gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Chưa cấu hình tài khoản gửi email` | `.env` còn để trống hai khoá | Điền như trên rồi khởi động lại server |
| `Gmail từ chối đăng nhập` | Dán nhầm mật khẩu Gmail thay vì mật khẩu ứng dụng | Mật khẩu ứng dụng luôn đúng 16 ký tự |
| `Không kết nối được tới máy chủ Gmail` | Mạng chặn cổng 465/587 (hay gặp ở mạng trường, cơ quan) | Phát 4G từ điện thoại rồi thử lại |
| Gửi được nhưng thư vào Spam | Bình thường với thư tự động | Người nhận đánh dấu "Không phải spam" một lần |

> **Khi lập trình, muốn thử mà không gửi thật:** đặt `EMAIL_THU_NGHIEM=1` trong
> `.env`. Hệ thống dùng hộp thư ảo Ethereal và in link xem thư ra console — thư
> **không** tới người nhận thật. Đừng bật khoá này khi chạy thật.

---

## 🔑 DANH SÁCH TÀI KHOẢN ĐỂ DÙNG THỬ

| Nhóm quyền | Đường dẫn đăng nhập | Tên đăng nhập (Username) | Mật khẩu (Password) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `http://localhost:3000/admin` | `admin` | `123456` | Toàn quyền cấu hình |
| **Kế toán** | `http://localhost:3000/login` | `ketoan` | `123456` | Quản lý lương, thu chi |
| **Phục vụ** | `http://localhost:3000/login` | `phucvu` | `123456` | Gán bàn, gọi món |
| **Nhà bếp (Đầu bếp)** | `http://localhost:3000/login` | `bep` | `123456` | Điều phối chế biến món |
| **Khách hàng đặt bàn** | `http://localhost:3000/login` | `0388328423` | `123456` | Đặt bàn online |

---
*Chúc bạn có trải nghiệm tuyệt vời với hệ thống Quản lý nhà hàng Bảo Đoàn!*
