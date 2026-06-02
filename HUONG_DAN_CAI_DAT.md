# HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN NHÀ HÀNG BD

Dự án đã được đóng gói đầy đủ bao gồm **Mã nguồn (Source Code)** và **Cơ sở dữ liệu (Database)** mới nhất. Bất kỳ ai nhận được file ZIP này đều có thể chạy dự án ngay lập tức bằng cách thực hiện theo các bước đơn giản sau:

---

## 🛠️ YÊU CẦU HỆ THỐNG
* Máy tính đã cài đặt **Node.js** (Khuyên dùng bản LTS mới nhất).
* Hệ thống máy chủ cơ sở dữ liệu **MySQL** (Ví dụ dùng XAMPP, Laragon, hoặc MySQL Standalone).

---

## 🚀 CÁC BƯỚC CÀI ĐẶT CHI TIẾT

### Bước 1: Giải nén dự án
1. Giải nén file `restaurant.zip` vào thư mục làm việc của bạn (Ví dụ: `C:\xampp\htdocs\restaurant`).

### Bước 2: Cấu hình Cơ sở dữ liệu (Database)
1. Mở phần mềm quản lý MySQL (XAMPP Control Panel, phpMyAdmin, Navicat, DBeaver...).
2. Tạo mới một cơ sở dữ liệu trống có tên: `gs_restaurant` với bảng mã (Collation) là `utf8mb4_general_ci`.
3. Nhập (Import) file dữ liệu **`gs_restaurant.sql`** (nằm ở thư mục gốc của dự án sau khi giải nén) vào cơ sở dữ liệu `gs_restaurant` vừa tạo.

### Bước 3: Cấu hình cổng kết nối (File `.env`)
1. Mở file `.env` ở thư mục gốc của dự án bằng trình soạn thảo văn bản (Notepad, VS Code...).
2. Kiểm tra các thông số kết nối MySQL cho phù hợp với máy của bạn:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=          # Mật khẩu database của bạn (nếu có)
   DB_NAME=gs_restaurant
   DB_PORT=3307      # Cổng MySQL (Mặc định XAMPP là 3306 hoặc 3307)
   PORT=3000         # Cổng chạy website
   ```
3. Lưu file `.env` lại.

### Bước 4: Cài đặt thư viện Node.js
1. Mở terminal (CMD, PowerShell, Git Bash) tại thư mục dự án vừa giải nén.
2. Chạy lệnh sau để tải các thư viện cần thiết:
   ```bash
   npm install
   ```

### Bước 5: Chạy dự án
1. Sau khi cài đặt xong thư viện, chạy lệnh sau để khởi động Website:
   ```bash
   node server.js
   ```
2. Nếu terminal hiện dòng: `Server is running on http://localhost:3000` thì dự án đã chạy thành công!

---

## 🔑 DANH SÁCH TÀI KHOẢN ĐỂ DÙNG THỬ

| Nhóm quyền | Đường dẫn đăng nhập | Tên đăng nhập (Username) | Mật khẩu (Password) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `http://localhost:3000/admin` | `admin` | `123456` | Toàn quyền cấu hình |
| **Kế toán** | `http://localhost:3000/login` | `ketoan` | `123` | Quản lý lương, thu chi |
| **Phục vụ** | `http://localhost:3000/login` | `nv001` | `123456` | Gán bàn, gọi món |
| **Nhà bếp (Đầu bếp)** | `http://localhost:3000/login` | `nv003` | `123456` | Điều phối chế biến món |
| **Khách hàng đặt bàn** | `http://localhost:3000/login` | `0918484042` | `123456` | Đặt bàn online |

---
*Chúc bạn có trải nghiệm tuyệt vời với hệ thống Quản lý nhà hàng BD!*
