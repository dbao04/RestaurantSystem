# Cơ sở dữ liệu — `gs_restaurant`

## Nguồn dữ liệu duy nhất

Toàn bộ cơ sở dữ liệu của hệ thống nằm trong **một file duy nhất**:

```
database/gs_restaurant.sql
```

File này chứa đầy đủ **66 bảng** (cấu trúc + dữ liệu) và tự chứa lệnh
`CREATE DATABASE`, nên **không cần tạo database trước bằng tay**.

> Mọi file `.sql` khác nằm rải rác trong dự án trước đây đều đã lỗi thời và
> không còn được dùng. Chỉ dùng đúng file này.

## Cài đặt (1 lệnh)

Yêu cầu: MySQL/MariaDB đang chạy, và đã có file `.env` (chép từ `.env.example`).

```bash
npm run db:setup
```

Script sẽ tự tìm chương trình `mysql` (XAMPP, Laragon, MySQL Server hoặc trong
PATH), import file trên, rồi kiểm tra lại xem đã đủ 66 bảng chưa.

⚠️ Lệnh này **ghi đè toàn bộ** dữ liệu đang có trong database `gs_restaurant`.

### Cách thủ công (nếu không dùng được npm)

```bash
# Windows + XAMPP
"C:\xampp\mysql\bin\mysql.exe" -u root < database\gs_restaurant.sql
```

Hoặc dùng phpMyAdmin: tab **Import** → chọn `database/gs_restaurant.sql` → **Go**.
(Nếu file vượt giới hạn dung lượng upload của phpMyAdmin thì dùng lệnh trên.)

## Cập nhật lại file sau khi sửa dữ liệu

Mỗi khi thay đổi cấu trúc bảng hoặc dữ liệu, chạy lệnh sau để file SQL nộp kèm
báo cáo luôn khớp với hệ thống thật:

```bash
npm run db:export
```

## Thư mục `config/migrations/`

Chứa lịch sử tiến hoá của schema qua 16 bước (chuẩn hoá schema, sinh dữ liệu
lịch sử, chấm công khuôn mặt, khuyến mãi, chatbot...).

Các script này **đã được áp dụng hết** vào `gs_restaurant.sql`, nên **không cần
chạy lại** khi cài đặt. Chúng được giữ lại làm tài liệu minh hoạ quá trình phát
triển cơ sở dữ liệu cho báo cáo.

## Ghi chú về dữ liệu

Bảng `hopdong` (chi tiết đơn hàng) có **80.557 dòng dữ liệu mô phỏng** —
đánh dấu bằng cột `la_du_lieu_mo_phong = 1` — được sinh ra bởi migration
`003_sinh_du_lieu_lich_su`. Đây là dữ liệu lịch sử cần thiết để huấn luyện và
minh hoạ các mô hình dự báo (Tầng 3 — Machine Learning). Dữ liệu phát sinh từ
thao tác thật có `la_du_lieu_mo_phong = 0`.
