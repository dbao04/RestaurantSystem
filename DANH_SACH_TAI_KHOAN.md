# Danh sách tài khoản hệ thống

> Bộ tài khoản chuẩn do `config/migrations/009_tao_tai_khoan.js` tạo ra: **một
> tài khoản cho mỗi chức danh** trong cơ cấu tổ chức, cộng một tài khoản quản trị.
>
> **Toàn bộ mật khẩu: `123456`**
>
> Cập nhật: 2026-08-07

---

## Cách tạo lại bộ tài khoản này

```bat
:: Phải chạy 008 trước (tạo cơ cấu tổ chức), rồi tới 009
node config/migrations/008_co_cau_to_chuc.js
node config/migrations/009_tao_tai_khoan.js
```

⚠️ **Migration 009 XÓA toàn bộ tài khoản cũ** (nhan_vien + tb_admin) rồi tạo lại.
Dữ liệu chấm công, lịch làm việc, lương, chốt ca của nhân viên cũ bị xóa theo.
Lịch sử **đơn hàng được giữ lại** (chỉ gỡ liên kết nhân viên phụ trách).
Chạy lại nhiều lần đều cho ra đúng bộ tài khoản dưới đây.

---

## 1. Quản trị viên — `/admin/login`

Đăng nhập bằng **tên đăng nhập + mật khẩu**.

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `123456` | Quản trị hệ thống (trên mọi kiểm tra quyền) |

---

## 2. Nhân viên — `/staff/login`

Đăng nhập bằng **tên đăng nhập + mật khẩu**. Mỗi dòng là một chức danh, sắp theo
cấp bậc (1 cao nhất → 6 thấp nhất).

| # | Tên đăng nhập | Mật khẩu | Chức danh | Cấp | Bộ phận | Báo cáo cho |
|---|---|---|---|---|---|---|
| 1 | `quanly` | `123456` | Quản lý nhà hàng | 1 | Điều hành | — |
| 2 | `trolyquanly` | `123456` | Trợ lý quản lý nhà hàng | 2 | Điều hành | Quản lý nhà hàng |
| 3 | `quanlybep` | `123456` | Quản lý bếp | 2 | Bếp | Quản lý nhà hàng |
| 4 | `beptruong` | `123456` | Bếp trưởng | 2 | Bếp | Quản lý bếp |
| 5 | `ketoantruong` | `123456` | Kế toán trưởng | 2 | Kế toán | Quản lý nhà hàng |
| 6 | `truongletan` | `123456` | Trưởng lễ tân | 3 | Lễ tân | Trợ lý quản lý |
| 7 | `giamsatpv` | `123456` | Giám sát phục vụ | 3 | Phục vụ | Trợ lý quản lý |
| 8 | `beppho` | `123456` | Bếp phó | 3 | Bếp | Bếp trưởng |
| 9 | `truongbar` | `123456` | Trưởng bar | 3 | Bar | Trợ lý quản lý |
| 10 | `giamsattn` | `123456` | Giám sát thu ngân | 3 | Thu ngân | Trợ lý quản lý |
| 11 | `totruongpv` | `123456` | Tổ trưởng phục vụ | 4 | Phục vụ | Giám sát phục vụ |
| 12 | `totruongbep` | `123456` | Tổ trưởng bếp | 4 | Bếp | Bếp phó |
| 13 | `thukho` | `123456` | Thủ kho | 4 | Kho | Quản lý bếp |
| 14 | `letan` | `123456` | Lễ tân | 5 | Lễ tân | Trưởng lễ tân |
| 15 | `phucvu` | `123456` | Nhân viên phục vụ | 5 | Phục vụ | Tổ trưởng phục vụ |
| 16 | `daubep` | `123456` | Đầu bếp | 5 | Bếp | Tổ trưởng bếp |
| 17 | `phache` | `123456` | Nhân viên pha chế | 5 | Bar | Trưởng bar |
| 18 | `thungan` | `123456` | Thu ngân | 5 | Thu ngân | Giám sát thu ngân |
| 19 | `ketoan` | `123456` | Kế toán viên | 5 | Kế toán | Kế toán trưởng |
| 20 | `nhanvienkho` | `123456` | Nhân viên kho | 5 | Kho | Thủ kho |
| 21 | `phuban` | `123456` | Phụ bàn | 6 | Phục vụ | Tổ trưởng phục vụ |
| 22 | `phubep` | `123456` | Phụ bếp | 6 | Bếp | Tổ trưởng bếp |
| 23 | `tapvubep` | `123456` | Tạp vụ bếp | 6 | Bếp | Tổ trưởng bếp |

---

## 3. Tài khoản nên dùng để thử nhanh

| Muốn xem gì | Đăng nhập bằng |
|---|---|
| Toàn quyền, mọi màn hình | `quanly` |
| Quản lý cơ cấu tổ chức, phân quyền | `quanly` (hoặc `admin` ở `/admin/login`) |
| Bảng điều hành thời gian thực | `quanly`, `beptruong`, `giamsatpv`, `ketoantruong` |
| Màn hình bếp (KDS), đổi trạng thái món | `beptruong`, `beppho`, `totruongbep`, `daubep` |
| Duyệt lương | `ketoantruong` |
| Thu ngân, thanh toán | `thungan`, `giamsattn` |
| Nhân viên tuyến đầu (chỉ báo việc lên) | `phucvu`, `phuban`, `phubep` |

---

## 4. Khách hàng — `/login`

Migration 009 **không tạo tài khoản khách hàng** (khách tự đăng ký, hoặc được
tạo tự động khi đặt bàn / quét QR). Khách mới tạo tự động nhận mật khẩu mặc định
`123456`.

Nếu cần một khách mẫu để thử, đăng ký tại `/register` bằng số điện thoại bất kỳ.

---

## 5. Ghi chú bảo mật

- Mật khẩu băm bằng **MD5 không salt** — nên chuyển sang `bcrypt` trước khi chạy thật.
- Bộ tài khoản này dùng chung một mật khẩu `123456` cho tiện phát triển/demo.
  **Trước khi triển khai thật:** đổi mật khẩu `admin` và các chức danh quản lý
  (`quanly`, `beptruong`, `ketoantruong`…), hoặc xóa các tài khoản không dùng.
- Đường báo cáo (`id_quan_ly`) và tổ trưởng các tổ được nối tự động khi chạy 009.
