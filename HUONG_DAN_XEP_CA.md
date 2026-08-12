# Xếp ca tự động

Tài liệu này mô tả phân hệ xếp ca: bài toán nó giải, thuật toán, cách vận hành,
và những chỗ dễ hiểu nhầm.

---

## 1. Trước và sau

Hệ thống vốn chỉ có **một chiều**: nhân viên vào `/staff/schedule` đăng ký ca
mình muốn làm, quản trị vào `/admin/schedule` bấm duyệt hoặc từ chối từng dòng.
Cách đó đi **từ người lên**, và không chỗ nào nói được *"tối thứ Bảy tôi cần 2
phục vụ"*. Hệ quả là không ai biết thứ Bảy thiếu người cho tới lúc thứ Bảy đến.

Phân hệ mới đi **ngược lại — từ nhu cầu của nhà hàng xuống con người**: khai
trước mỗi ca cần bao nhiêu người ở chức vụ nào, rồi để hệ thống tìm người lấp
vào.

Hai màn hình **bổ sung cho nhau**, không thay thế nhau. Ca nhân viên đã tự đăng
ký được thuật toán ưu tiên giữ nguyên.

| Thành phần | File |
|---|---|
| Thuật toán xếp ca (hàm thuần, không chạm CSDL) | `services/xepCa.js` |
| Nghiệp vụ: đọc CSDL, lưu nháp, chốt | `services/lichLamViecService.js` |
| Router + 2 màn hình | `routes/xepCa.js` |
| Lưới tuần / Bảng định mức | `views/admin/xep-ca.ejs`, `views/admin/xep-ca-dinh-muc.ejs` |
| Bảng `ca_lam_viec`, `dinh_muc_ca`, cột `nguon` | `config/migrations/018_xep_ca.js` |
| 22 phép kiểm thử thuật toán | `scripts/kiemTraXepCa.js` |

---

## 2. Cài đặt

Chạy một lần:

```bash
node config/migrations/018_xep_ca.js
```

Migration tạo 3 ca mặc định (sáng 7–12, chiều 12–17, tối 17–21 — đúng giờ mà mã
nguồn cũ gán cứng), nạp một bảng định mức mẫu, thêm cột `lich_lam_viec.nguon`
và khoá chống trùng. **Chạy lại nhiều lần không hỏng gì** — đã kiểm tra.

---

## 3. Dùng hằng ngày

Vào **Quản trị → Xếp ca tự động** (`/admin/xep-ca`).

### Bước 1 — Khai định mức (chỉ làm một lần)

Bấm **Định mức nhân sự**. Bảng khai theo **thứ trong tuần**, không theo ngày cụ
thể, nên khai một lần dùng cho mọi tuần. Cuối tuần đông khách thì để số lớn hơn.

Cột cuối bảng hiện **số người hiện có** của từng chức vụ và **trần** `số người ×
6 ca`. Tổng định mức vượt trần thì ô đó chuyển đỏ — dấu hiệu chắc chắn sẽ báo
thiếu người.

### Bước 2 — Xếp

Chọn tuần rồi bấm **Xếp tự động**. Kết quả là **bản nháp**, hiện màu vàng.

### Bước 3 — Sửa tay

Mỗi ô có nút `×` để bỏ người, và ô chọn `+ thêm…` để thêm người. Chỉ sửa được
dòng đang là nháp — dòng đã chốt không bấm nhầm mà mất được.

### Bước 4 — Chốt

Bấm **Chốt lịch**. Toàn bộ nháp thành lịch chính thức và nhân viên nhìn thấy
ngay ở `/staff/schedule`.

Chưa chốt thì **nhân viên không thấy gì cả** — cố ý như vậy: để họ thấy ca chưa
chốt rồi sắp xếp cuộc sống theo, đến lúc quản lý đổi lại thì thành thất hứa.

---

## 4. Thuật toán

### Ràng buộc cứng — vi phạm là loại thẳng

1. **Đúng chức vụ.** Bếp không dùng thay phục vụ.
2. **Không xếp người đang nghỉ phép** đã duyệt.
3. **Mỗi người một ca mỗi ngày** (đổi được qua tuỳ chọn).
4. **Nghỉ tối thiểu 11 tiếng giữa hai ca.** Ca tối kết thúc 21h, ca sáng hôm sau
   bắt đầu 7h — mới được 10 tiếng kể cả đi đường và ngủ, nên cặp đó bị cấm.
5. **Tối đa 6 ca/tuần và 6 ngày liên tiếp.**

### Điểm mềm — quyết định ai trong số những người hợp lệ

| Điểm | Lý do |
|---:|---|
| **+1000** | Người này **đã tự đăng ký** đúng ca này |
| **−100 × số ca đã có** | Trục chính để chia đều |
| **+50** | Chưa được xếp ca nào trong tuần — kéo người bị bỏ quên lên |
| **−30** | Hôm qua cũng ca này và đã làm ≥2 ngày liên tiếp |
| **+20** | Cùng ca với hôm qua — giữ nhịp sinh học ổn định |

Điểm `+1000` áp đảo mọi tiêu chí khác: nhân viên đã nói họ muốn ca này thì tôn
trọng, xếp họ chỗ khác vừa vô ích vừa gây ác cảm.

### Ba điều thuật toán cố ý **không** làm

**Không tự hạ định mức.** Thiếu người thì báo thiếu, ghi rõ ngày nào ca nào
thiếu mấy người của chức vụ gì. Một bảng lịch nhìn thì đầy nhưng thực tế không
ai đứng ca còn tệ hơn là báo thiếu.

**Không dùng số ngẫu nhiên.** Cùng dữ liệu vào luôn cho cùng kết quả. Bấm hai
lần ra hai bảng khác nhau sẽ khiến người dùng mất lòng tin, và cũng không kiểm
thử được. Các trường hợp điểm bằng nhau được phá bằng id nhân viên.

**Không lấy đại người đầu danh sách.** Cách đó khiến người có id nhỏ lãnh gần
hết ca còn người cuối bảng gần như không bao giờ được xếp — chia việc không đều
là khiếu nại nặng nhất trong nhà hàng thật.

---

## 5. Kiểm thử

```bash
npm run xepca:test
```

22 phép thử, chạy bằng dữ liệu tự đặt ra, **không cần CSDL**. Mỗi ràng buộc có
một phép thử riêng: chia đều, nghỉ phép, nghỉ giữa ca, chuỗi ngày liên tiếp,
không lẫn chức vụ, báo thiếu, tính lặp lại, và nối tiếp qua ranh giới tuần.

> **Một cái bẫy đã gặp khi viết bộ kiểm thử này:** phép thử lúc đầu dùng
> `toISOString()` để lùi một ngày. Hàm đó trả giờ **UTC**, mà `new Date('2026-08-17T00:00:00')`
> là giờ **địa phương** — ở múi giờ +07 thì nửa đêm 17/08 thành 16/08. Phép thử
> so sánh nhầm ngày và báo ĐẠT trong khi không kiểm tra đúng thứ cần kiểm tra.
> Vì vậy trong cả phân hệ này, mọi phép tính ngày đều đi qua `ngayISO()`, và
> trong `.ejs` luôn viết `new Date(ngay + 'T00:00:00')`.

---

## 6. Dữ liệu

### `ca_lam_viec`

| Cột | Ý nghĩa |
|---|---|
| `ma_ca` | `sang` / `chieu` / `toi` — giữ nguyên giá trị cũ để không phá dữ liệu sẵn có |
| `gio_bat_dau`, `gio_ket_thuc` | Trước đây gán cứng trong `personnelService.registerSchedule`; giờ sửa được không cần đụng mã nguồn |

### `dinh_muc_ca`

`(thu, ma_ca, chucvu) → so_luong`. `thu` theo `getDay()`: **0 = Chủ nhật … 6 =
Thứ Bảy**.

### `lich_lam_viec.nguon`

| Giá trị | Nghĩa |
|---|---|
| `dang_ky` | Nhân viên tự đăng ký (mặc định, luồng cũ) |
| `tu_dong` | Máy xếp |
| `thu_cong` | Quản lý thêm tay trên lưới |

Cần phân biệt vì khi xoá bản nháp để xếp lại, **chỉ được xoá dòng máy sinh ra** —
xoá nhầm đơn đăng ký của nhân viên là mất dữ liệu của họ.

### `lich_lam_viec.trangthai`

| Giá trị | Nghĩa |
|---|---|
| 0 | Chờ duyệt |
| 1 | Đã duyệt (lịch chính thức) |
| 2 | Từ chối |
| **3** | **Bản nháp** — mới |

Trạng thái 3 bị lọc khỏi `getSchedule` và `getAllSchedules`, nên không lọt sang
màn hình nhân viên hay trang duyệt đơn.

---

## 7. Hai lỗ hổng đã vá cùng đợt này

**Nhân viên tự xoá được ca quản lý phân cho mình.** `cancelSchedule` trước đây
chỉ lọc theo `id_nv`, nghĩa là vào `/staff/schedule` bấm Huỷ là xoá được bất kỳ
dòng nào của mình — kể cả ca quản lý đã phân và đã chốt. Lịch cả nhà hàng thủng
một lỗ mà không ai hay, vì thao tác đó không ghi lại ở đâu. Nay chỉ huỷ được
dòng **chính họ đăng ký** và **chưa duyệt**; ca đã được phân thì phải đi đường
đơn nghỉ phép.

**Xếp hai lần là nhân đôi lịch.** Đã thêm khoá `UNIQUE(id_nv, ngay, ca)`.

---

## 8. Giới hạn hiện tại

- Định mức khai theo **thứ**, chưa khai được ngoại lệ cho ngày cụ thể (lễ, tiệc
  đặt trước). Muốn tăng người hôm đó thì thêm tay trên lưới.
- Chưa xét **nguyện vọng nghỉ** kiểu "tôi không làm được sáng thứ Ba". Hiện chỉ
  có đơn nghỉ phép nguyên ngày.
- Xếp theo **tuần**, chưa xếp cả tháng một lần.
- Thuật toán là **tham lam có chấm điểm**, không phải tối ưu toàn cục. Với quy mô
  vài chục nhân viên thì kết quả chia đều tốt (đã đo: chênh lệch ≤ 1 ca giữa
  người nhiều nhất và ít nhất) và chạy tức thì; đổi sang quy hoạch ràng buộc chỉ
  đáng khi quy mô lớn hơn nhiều.
