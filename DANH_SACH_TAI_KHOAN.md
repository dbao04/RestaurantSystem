# Danh sách tài khoản hệ thống

> **75 tài khoản nhân viên + 1 tài khoản quản trị.**
>
> Hai lớp: migration `009` tạo **một tài khoản cho mỗi chức danh** (27 người, đủ
> để đăng nhập thử từng vai trò), migration `026` tuyển tiếp cho **đủ định biên**
> khai trong `chuc_danh.dinh_bien` (thêm 48 người, để xếp ca và tổ nhóm chạy
> được như một nhà hàng thật).
>
> **Toàn bộ mật khẩu: `123456`**
>
> Cập nhật: 2026-08-19

---

## Cách tạo lại bộ tài khoản này

```bat
:: Đúng thứ tự: 008 dựng cơ cấu tổ chức -> 009 tạo tài khoản mẫu -> 026 tuyển đủ
node config/migrations/008_co_cau_to_chuc.js
node config/migrations/009_tao_tai_khoan.js
node config/migrations/026_tuyen_du_nhan_su.js
```

⚠️ **Migration 009 XÓA toàn bộ tài khoản cũ** (nhan_vien + tb_admin) rồi tạo lại.
Dữ liệu chấm công, lịch làm việc, lương, chốt ca của nhân viên cũ bị xóa theo.
Lịch sử **đơn hàng được giữ lại** (chỉ gỡ liên kết nhân viên phụ trách).
Chạy lại nhiều lần đều cho ra đúng bộ tài khoản dưới đây.

**Migration 026 thì không xóa gì** — nó đọc `chuc_danh.dinh_bien`, đếm xem mỗi
chức danh còn thiếu bao nhiêu người rồi tuyển đúng phần thiếu. Chạy lại khi đã
đủ thì tạo 0 người. Muốn nhà hàng đông/vắng hơn thì **sửa `dinh_bien` rồi chạy
lại**, không sửa script.

---

## 1. Quản trị viên — `/admin/login`

Đăng nhập bằng **tên đăng nhập + mật khẩu**.

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `123456` | Quản trị hệ thống (trên mọi kiểm tra quyền) |

---

## 2. Nhân viên — `/staff/login`

Đăng nhập bằng **tên đăng nhập + mật khẩu**. Bảng gộp theo chức danh, sắp theo
bộ phận rồi cấp bậc (1 cao nhất → 6 thấp nhất).

**Quy tắc tên đăng nhập:** người đầu của mỗi chức danh giữ tên gốc không số
(`phucvu`), những người sau đánh số tiếp (`phucvu2` … `phucvu12`). Riêng nhân
viên giao hàng đã có sẵn `shipper1`–`shipper3` nên người mới là `shipper4`.
Dấu `…` trong bảng nghĩa là các số ở giữa đều có.

| # | Chức danh | Cấp | Bộ phận | Số người | Tên đăng nhập | Báo cáo cho |
|---|---|---|---|---|---|---|
| 1 | Quản lý nhà hàng | 1 | Điều hành | **1** | `quanly` | — |
| 2 | Trợ lý quản lý nhà hàng | 2 | Điều hành | **1** | `trolyquanly` | Quản lý nhà hàng |
| 3 | Trưởng lễ tân | 3 | Lễ tân | **1** | `truongletan` | Trợ lý quản lý nhà hàng |
| 4 | Lễ tân | 5 | Lễ tân | **4** | `letan` … `letan4` | Trưởng lễ tân |
| 5 | Giám sát phục vụ | 3 | Phục vụ | **2** | `giamsatpv`, `giamsatpv2` | Trợ lý quản lý nhà hàng |
| 6 | Tổ trưởng phục vụ | 4 | Phục vụ | **4** | `totruongpv` … `totruongpv4` | Giám sát phục vụ |
| 7 | Nhân viên phục vụ | 5 | Phục vụ | **12** | `phucvu` … `phucvu12` | Tổ trưởng phục vụ |
| 8 | Phụ bàn | 6 | Phục vụ | **6** | `phuban` … `phuban6` | Tổ trưởng phục vụ |
| 9 | Quản lý bếp | 2 | Bếp | **1** | `quanlybep` | Quản lý nhà hàng |
| 10 | Bếp trưởng | 2 | Bếp | **1** | `beptruong` | Quản lý bếp |
| 11 | Bếp phó | 3 | Bếp | **2** | `beppho`, `beppho2` | Bếp trưởng |
| 12 | Tổ trưởng bếp | 4 | Bếp | **3** | `totruongbep` … `totruongbep3` | Bếp phó |
| 13 | Đầu bếp | 5 | Bếp | **8** | `daubep` … `daubep8` | Tổ trưởng bếp |
| 14 | Phụ bếp | 6 | Bếp | **6** | `phubep` … `phubep6` | Tổ trưởng bếp |
| 15 | Tạp vụ bếp | 6 | Bếp | **3** | `tapvubep` … `tapvubep3` | Tổ trưởng bếp |
| 16 | Trưởng bar | 3 | Bar - Pha chế | **1** | `truongbar` | Trợ lý quản lý nhà hàng |
| 17 | Nhân viên pha chế | 5 | Bar - Pha chế | **3** | `phache` … `phache3` | Trưởng bar |
| 18 | Giám sát thu ngân | 3 | Thu ngân | **1** | `giamsattn` | Trợ lý quản lý nhà hàng |
| 19 | Thu ngân | 5 | Thu ngân | **4** | `thungan` … `thungan4` | Giám sát thu ngân |
| 20 | Kế toán trưởng | 2 | Kế toán | **1** | `ketoantruong` | Quản lý nhà hàng |
| 21 | Kế toán viên | 5 | Kế toán | **2** | `ketoan`, `ketoan2` | Kế toán trưởng |
| 22 | Thủ kho | 4 | Kho - Mua hàng | **1** | `thukho` | Quản lý bếp |
| 23 | Nhân viên kho | 5 | Kho - Mua hàng | **2** | `nhanvienkho`, `nhanvienkho2` | Thủ kho |
| 24 | Điều phối giao hàng | 4 | Giao hàng | **1** | `dieuphoi` | Trợ lý quản lý nhà hàng |
| 25 | Nhân viên giao hàng | 5 | Giao hàng | **4** | `shipper1` … `shipper4` | Điều phối giao hàng |

**Họ tên:** 27 người của migration 009 mang tên đúng bằng chức danh ("Nhân viên
phục vụ", "Tổ trưởng bếp") cho dễ nhận khi đăng nhập thử. 48 người của migration
026 mang **tên Việt thật** (Ngô Mỹ Duyên, Nguyễn Thanh Tùng…) — vì màn hình KDS,
chấm công và xếp ca sẽ không phân biệt nổi 12 người nếu ai cũng tên "Nhân viên
phục vụ". Xem đủ danh sách ở `/admin/stafflist`.

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
- Đường báo cáo (`id_quan_ly`) và tổ trưởng các tổ được nối tự động, ở cả 009 lẫn
  026. Khác nhau ở chỗ: 009 ánh xạ 1-1 vì mỗi chức danh chỉ có đúng một người,
  còn 026 phải chọn **người có `id_nv` nhỏ nhất** của chức danh cha làm cấp trên,
  vì một chức danh giờ có nhiều người.
- 026 còn chia 75 người vào **7 tổ làm việc** và tạo hồ sơ trong bảng `shipper`
  cho nhân viên giao hàng — thiếu dòng đó thì điều phối không thấy shipper, vì
  `vanChuyen.js` phân đơn theo bảng `shipper` chứ không theo `nhan_vien`.
