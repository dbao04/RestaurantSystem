# Cơ cấu tổ chức & vận hành thời gian thực

Tài liệu này mô tả phân hệ tổ chức nhân sự: chức danh, cấp bậc, đường báo cáo,
phân quyền chi tiết và toàn bộ lớp thời gian thực đi kèm.

---

## 1. Vấn đề của hệ thống cũ

`nhan_vien.chucvu` là một **ENUM phẳng** gồm 6 giá trị: `Phuc vu`, `Bep`,
`Ke toan`, `Quay`, `Thu ngan`, `Nhan vien chung`.

Hệ quả:

- Không có cấp bậc. Bếp trưởng và phụ bếp đều là `'Bep'` và **quyền y hệt nhau**.
- Không có đường báo cáo. Không biết ai duyệt nghỉ phép cho ai.
- Phân quyền là so sánh chuỗi rải rác trong **178 route**: `requireRole(['Bep'])`.
  Thêm một chức danh mới nghĩa là sửa hàng chục dòng.
- Socket.IO chỉ có 2 phòng (`kitchen_room`, `staff_room`) nên không thể gửi
  riêng cho tổ trưởng bếp hay cho cấp giám sát trở lên.
- Client tự khai vai trò: `socket.emit('join-room', { role: 'Bep' })` — ai cũng
  tự xưng là bếp để nghe đơn.

---

## 2. Mô hình dữ liệu

```
bo_phan (8)          Điều hành · Lễ tân · Phục vụ · Bếp · Bar · Thu ngân · Kế toán · Kho
   │
chuc_danh (23)       có cap_bac 1–6 và id_cd_cha = báo cáo cho ai
   │
chuc_danh_quyen ──▶ quyen (65)      mã dạng 'bep.mon.che_bien'
   │
nhan_vien.id_cd

to_lam_viec / thanh_vien_to     tổ + tổ trưởng, thứ mà cấp bậc không diễn tả được
uy_quyen                        ủy quyền tạm thời, tự hết hiệu lực
quyen_nhan_vien                 cấp / cắt quyền riêng cho một cá nhân
hien_dien_nv                    ai đang trực, đang ở trang nào
viec_can_xu_ly                  việc báo lên cấp trên
nhat_ky_to_chuc                 mọi thay đổi bổ nhiệm / phân quyền
```

### Sáu cấp bậc

| Cấp | Nghĩa | Chức danh |
|---|---|---|
| 1 | Quản lý nhà hàng | Quản lý nhà hàng |
| 2 | Trưởng bộ phận | Trợ lý QL, Quản lý bếp, Bếp trưởng, Kế toán trưởng |
| 3 | Giám sát | Giám sát phục vụ, Bếp phó, Trưởng lễ tân, Trưởng bar, Giám sát thu ngân |
| 4 | Tổ trưởng | Tổ trưởng phục vụ, Tổ trưởng bếp, Thủ kho |
| 5 | Nhân viên chính thức | Phục vụ, Đầu bếp, Lễ tân, Thu ngân, Pha chế, Kế toán viên, NV kho |
| 6 | Phụ việc / thử việc | Phụ bàn, Phụ bếp, Tạp vụ bếp |

**Số càng nhỏ càng cao.** `canCapBac(3)` nghĩa là "giám sát trở lên".

### Đường báo cáo bếp

```
Quản lý nhà hàng
   └─ Quản lý bếp
        └─ Bếp trưởng
             └─ Bếp phó
                  └─ Tổ trưởng bếp ─┬─ Đầu bếp
                                    ├─ Phụ bếp
                                    └─ Tạp vụ bếp
```

`cap_bac` và `id_cd_cha` là **hai thứ khác nhau**: cấp bậc dùng để so sánh thẩm
quyền, đường cha–con dùng để dựng sơ đồ và định tuyến phê duyệt.

---

## 3. Tương thích ngược — điểm quan trọng nhất

**Không sửa dòng nào trong 178 route cũ.** Cầu nối là hai cột trong `chuc_danh`,
mỗi cột làm một việc khác nhau:

| Cột | Dùng để | Ví dụ |
|---|---|---|
| `vai_tro_tuong_duong` | Quyết định **vào được route cũ hay không** | Bếp trưởng có `Bep` → vào được mọi trang của bếp |
| `chucvu_legacy` | Giá trị ghi vào `nhan_vien.chucvu` để **hiển thị đúng** ở màn hình cũ | Quản lý nhà hàng → `Quan ly` |

Nếu dùng chung một cột, Quản lý nhà hàng sẽ bị ghi `chucvu = 'Phuc vu'` — đúng về
quyền nhưng đọc thì sai hoàn toàn. Vì vậy migration bổ sung giá trị `'Quan ly'`
vào ENUM cũ (thêm vào cuối, không đổi dữ liệu đang có).

`requireRole` trong `server.js` nay trỏ tới `middleware/phanQuyen.js → canVaiTroCu`,
kiểm tra **hai lớp**:

1. `session.staffRole` khớp chính xác — hành vi cũ, người **chưa được bổ nhiệm
   vẫn giữ nguyên quyền đang có**.
2. Chức danh mới có `vai_tro_tuong_duong` phù hợp không.

Đã kiểm chứng: nhân viên có `id_cd = NULL`, 0 quyền, cấp 9 vẫn vào được
`/staff/bookings` và `/staff/kitchen` như trước, chỉ bị chặn ở màn hình quản lý mới.

---

## 4. Phân quyền

65 quyền chia 11 nhóm: Đơn hàng · Bếp · Bàn · Thực đơn · Kho · Nhân sự · Lương ·
Tổ chức · Điều hành · Khách hàng · Báo cáo · Hệ thống.

Quyền hiệu lực = hợp của ba nguồn, ưu tiên từ dưới lên:

1. `chuc_danh_quyen` — quyền mặc định của chức danh
2. `uy_quyen` — quyền mượn tạm, còn trong hạn
3. `quyen_nhan_vien` — cấp/cắt riêng cho cá nhân (`duoc_cap = 0` là **cắt**)

### Dùng trong route mới

```js
const { canQuyen, canCapBac, canBoPhan, canLaCapTren } = require('./middleware/phanQuyen');

router.post('/bep/bao-het/:id', canQuyen('bep.mon.bao_het'), ...)
router.get('/bao-cao/luong',    canQuyen(['luong.xem', 'luong.duyet']), ...)  // hoặc
router.get('/dieu-hanh',        canCapBac(3), ...)                            // giám sát ↑
router.post('/nghi-phep/:id/duyet', canLaCapTren(req => req.params.id), ...)  // chỉ nhánh của mình
```

### Dùng trong EJS

```ejs
<% if (coQuyen('luong.duyet')) { %> <button>Duyệt bảng lương</button> <% } %>
<% if (tuCapBac(2)) { %> ... <% } %>
```

Quyền được **đệm 60 giây** theo `id_nv`. Mọi thao tác đổi tổ chức đều tự xoá đệm
và bắn sự kiện `quyen:thay-doi` để người bị ảnh hưởng biết mà tải lại trang.

---

## 5. Thời gian thực

### Hệ thống phòng

| Phòng | Ai ở trong |
|---|---|
| `nv:<id>` | mọi thiết bị của một người |
| `cd:<ma_cd>` | tất cả người giữ một chức danh |
| `bp:<ma_bp>` | tất cả người thuộc một bộ phận |
| `cap:<n>` | tất cả người có cấp bậc n |
| `bpcap:<bp>:<cap>` | **giao** của bộ phận và cấp bậc |
| `to:<id>` | một tổ làm việc |
| `nhan_su` / `quan_ly` | mọi nhân viên / mọi vị trí quản lý |

`bpcap` tồn tại vì phòng Socket.IO chỉ **hợp** được, không giao được. Gửi vào cả
`bp:PV` lẫn `cap:3` thì mọi người bộ phận phục vụ đều nhận, kể cả phụ bàn cấp 6 —
sai với ý "báo lên cấp 3 trở lên của bộ phận phục vụ".

### Danh tính là tin cậy

`io.engine.use(sessionMiddleware)` cho socket đọc thẳng phiên đăng nhập. Server tự
xếp phòng, client không khai báo gì. Không còn giả mạo vai trò được.

### Hiện diện

Đếm **số kết nối** thay vì cờ online/offline. Một người mở máy quầy và điện thoại
là 2 kết nối; đóng một cái không làm họ biến mất khỏi bảng điều hành. Khi server
khởi động lại, bảng hiện diện được dọn về 0.

### Sự kiện

| Sự kiện | Khi nào |
|---|---|
| `realtime:san-sang` | socket vào phòng xong, kèm hồ sơ |
| `hien-dien:thay-doi` | ai đó vào/rời ca |
| `to-chuc:cap-nhat` | bổ nhiệm, đổi chức danh, đổi trạng thái |
| `to-chuc:quyen-doi` | quyền của một chức danh thay đổi |
| `to-chuc:to-doi` | tổ / thành viên tổ thay đổi |
| `quyen:thay-doi` | quyền **của chính bạn** đổi → gợi ý tải lại |
| `viec:moi` / `viec:cap-nhat` | việc báo lên / được xử lý |
| `thong-bao:moi` | quản lý gửi thông báo |

### Client

`js/realtime-to-chuc.js` nạp sẵn ở mọi trang nhân viên:

```js
RT.khi('viec:moi', d => { ... });                       // nghe sự kiện
RT.dongBo('/api/...', ve, ['viec:moi', 'viec:cap-nhat']); // tự tải lại khi dữ liệu cũ
RT.thongBao('Đã lưu', 'thanh-cong');                     // toast
RT.gui('/api/...', { ... });                             // POST kèm xử lý lỗi
```

`RT.dongBo` gom nhiều sự kiện đến liên tiếp trong 250 ms thành **một** lần gọi API —
lúc cao điểm bếp có thể bắn vài chục sự kiện mỗi giây.

---

## 6. Màn hình

| Đường dẫn | Ai vào được | Nội dung |
|---|---|---|
| `/to-chuc` | mọi nhân viên | Sơ đồ tổ chức sống: ai giữ chức gì, ai đang trực, vị trí của bạn, báo cáo cho ai |
| `/dieu-hanh` | có `dieu_hanh.bang_dieu_khien` | Nhân sự theo bộ phận, hàng đợi việc, gửi thông báo, danh sách tổ |
| `/to-chuc/quan-ly` | có quyền tổ chức | Bổ nhiệm, chức danh & phân quyền, tổ, ủy quyền, nhật ký |

Nút **Báo việc** nổi ở góc phải màn hình xuất hiện trên **mọi trang nhân viên**
cho ai có quyền `dieu_hanh.viec.tao` — nhân viên tuyến đầu là người phát hiện sự
cố sớm nhất nhưng lại không vào được `/dieu-hanh`.

### Luồng báo việc

```
Phục vụ báo "món ra chậm", chọn bộ phận xử lý = Bếp, cấp 3 trở lên
   │
   ├─▶ Bếp trưởng (BEP, cấp 2)      NHẬN   đúng bộ phận + đủ cấp
   ├─▶ Quản lý nhà hàng (cấp 1)     NHẬN   luôn nhận mọi việc
   └─▶ Phụ bếp (BEP, cấp 6)         không  đúng bộ phận nhưng chưa đủ cấp
       Tổ trưởng phục vụ (PV, cấp 4) không  đủ cấp nhưng khác bộ phận

Bếp trưởng bấm "Nhận" ──▶ người báo được thông báo ngược ngay
```

Bộ lọc của API `/api/to-chuc/viec` dùng **đúng hai điều kiện đó**, nên không xảy
ra cảnh "nhận được thông báo nhưng mở danh sách lại không thấy".

---

## 7. Chạy migration

```bat
node config/migrations/008_co_cau_to_chuc.js
```

Chạy lại được nhiều lần. Lần chạy sau **không ghi đè** kết quả bổ nhiệm thủ công
đã làm trên giao diện — chỉ nhân viên có `id_cd` rỗng mới được gán.

Migration làm:

1. Tạo 11 bảng mới
2. Thêm cột `ma_nv`, `id_cd`, `id_bp`, `id_quan_ly`, `ngay_bo_nhiem`,
   `trang_thai_lam_viec` vào `nhan_vien` — **không xoá cột nào**
3. Thêm giá trị `'Quan ly'` vào ENUM `nhan_vien.chucvu`
4. Nạp 8 bộ phận, 23 chức danh, 65 quyền, 436 lượt gán quyền, 7 tổ
5. Chuyển nhân viên cũ sang chức danh mới theo bảng ánh xạ:

   | `chucvu` cũ | Chức danh mới |
   |---|---|
   | `Phuc vu`, `Nhan vien chung` | Nhân viên phục vụ |
   | `Bep` | Đầu bếp |
   | `Ke toan` | Kế toán viên |
   | `Thu ngan` | Thu ngân |
   | `Quay` | Lễ tân |

   Người có `chucvu` rỗng **không bị đoán bừa** — migration in danh sách ra màn
   hình để quản lý tự bổ nhiệm tại `/to-chuc/quan-ly`.

### Sau khi chạy — hai việc cần làm bằng tay

1. **Bổ nhiệm người giữ các chức danh quản lý.** Toàn bộ nhân viên cũ đều được
   ánh xạ về cấp 5, nên ban đầu chưa ai có quyền vào `/to-chuc/quan-ly`. Lần đầu
   phải dùng **tài khoản quản trị** (`/admin/login`) để bổ nhiệm — tài khoản này
   đứng trên hệ thống chức danh và luôn đi qua mọi kiểm tra quyền.

2. **Rà lại các ánh xạ máy móc.** Ví dụ nhân viên tên "Kế toán trưởng" có
   `chucvu = 'Ke toan'` nên bị ánh xạ thành *Kế toán viên*. Ánh xạ chỉ dựa vào
   ENUM cũ, không đọc tên.

Đường báo cáo (`id_quan_ly`) ban đầu để trống vì chưa ai giữ chức danh cấp trên.
Khi bổ nhiệm một người vào chức danh cha, cấp dưới **chưa có quản lý** sẽ tự được
nối vào — sơ đồ tự liền lại.

---

## 8. Kiểm chứng đã thực hiện

Chạy trên MySQL 8 tạm (Docker) với đúng bản dump `gs_restaurant.sql`:

- Migration chạy sạch, chạy lại lần hai không đổi dữ liệu (0 lượt gán mới)
- Ma trận truy cập theo 4 chức danh:

  | Đường dẫn | QL nhà hàng | Bếp trưởng | Kế toán trưởng | NV phục vụ |
  |---|---|---|---|---|
  | `/to-chuc` | 200 | 200 | 200 | 200 |
  | `/dieu-hanh` | 200 | 200 | 200 | **403** |
  | `/to-chuc/quan-ly` | 200 | **403** | **403** | **403** |
  | `/staff/kitchen` | 200 | 200 | 200 | 200 |
  | `/staff/accountant/salary` | 200 | **403** | 200 | **403** |
  | `/staff/bookings` | 200 | **403** | — | 200 |

- Socket vào đúng phòng theo chức danh, định tuyến việc đúng giao bộ phận × cấp bậc
- Thông báo gửi riêng bộ phận Bếp: bếp nhận, phục vụ không nhận
- Ngắt kết nối → bảng hiện diện tự cập nhật
- Nhân viên chưa bổ nhiệm giữ nguyên quyền cũ
- Hồi quy: 15 trang nhân viên, 7 trang khách, 3 trang admin đều 200

---

## 9. Hai lỗi cũ được sửa kèm

1. **Thiếu `views/error.ejs`.** `middleware/auth.js` và `middleware/errorHandler.js`
   đều gọi `res.render('error', ...)` nhưng file không tồn tại — mọi lỗi 403/404
   đi qua đó sẽ ném tiếp "Failed to lookup view". Đã tạo file.

2. **`errorHandler` chưa bao giờ được mount.** Nay `notFoundHandler` và
   `errorHandler` được gắn ở cuối `server.js`. Đồng thời sửa
   `req.headers.accept.indexOf(...)` — sẽ ném lỗi khi client không gửi header
   `Accept` (curl, một số webhook).
