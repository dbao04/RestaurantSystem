# Module đặt bàn

Tài liệu này giải thích **module đặt bàn hoạt động thế nào và vì sao lại làm như
vậy**. Phần cài đặt chung xem `HUONG_DAN_CAI_DAT.md`, kiến trúc tổng thể xem
`README.md`.

---

## 1. Cài đặt

```bat
npm run datban:setup     :: chạy migration 030 (sau 028 và 029)
npm run datban:check     :: kiểm tra module — 81 phép thử (33 logic + 48 CSDL)
```

Migration 030 chạy lại được nhiều lần mà không mất dữ liệu. Nó dựng thêm 8 bảng,
bổ sung cột cho `reservations`, `ban`, `vitri`, nạp danh mục, rồi **dựng lại lưới ô
thời gian** cho các lượt đặt đang có.

Nếu dữ liệu cũ có hai lượt đặt trùng bàn cùng giờ (tạo trước khi có hàng rào
chống trùng), script sẽ **in ra danh sách và không tự xoá** — sửa tay, vì xoá một
lượt đặt thật của khách không phải việc script được quyền tự quyết.

Migration cũng **suy ra thuộc tính bàn từ tên khu vực** để hệ thống dùng được ngay
(Phòng VIP → phòng riêng + yên tĩnh; Sân vườn → ngoài trời + gần cửa sổ). Một cái
bẫy ở đây đáng ghi lại: `ban` và `vitri` dùng collation `utf8_general_ci` — collation
này **bỏ dấu khi so sánh**, nên `Name_vitri LIKE '%Sân%'` khớp cả **"Sảnh chính"**
(cả hai đều rút về `san`). Bản đầu tiên vì thế đánh dấu toàn bộ 14 bàn của Sảnh
chính là "gần cửa sổ", và thuật toán xếp bàn ưu tiên nhầm chúng cho khách xin bàn
cạnh cửa sổ — một lỗi hoàn toàn im lặng. Điều kiện hiện chỉ còn `'%vườn%'`.

Suy ra tự động chỉ là điểm khởi đầu. Kiểm lại ở `/admin/dat-ban` mục **Thuộc tính
bàn** và sửa cho khớp mặt bằng thật.

Các đường dẫn sau khi cài:

| Đường dẫn | Dành cho | Cần đăng nhập |
|---|---|---|
| `/datban` | **Chọn hình thức đặt bàn** — cửa vào chính | Không |
| `/dat-ban` | Chỉ đặt bàn (trợ lý 4 bước có sơ đồ) | Không |
| `/datban/goi-mon` | Đặt bàn kèm gọi món trước | Có, và phải có món trong giỏ |
| `/dat-ban/tra-cuu` | Khách đổi giờ / hủy | Không (mã + SĐT) |
| `/huong-dan-dat-ban` | Hướng dẫn cho khách | Không |
| `/staff/dat-ban` | Nhân viên vận hành | Phục vụ, Quầy, Thu ngân, Kế toán, Quản lý |
| `/staff/dat-ban/phan-tich` | Quản lý xem báo cáo | Quản lý |
| `/admin/dat-ban` | Cấu hình, chính sách | Quản trị hoặc Quản lý |

---

## 2. Điểm thiết kế quan trọng nhất: chống đặt trùng bằng chính CSDL

### Vấn đề

Cách làm thông thường là đọc rồi ghi:

```sql
SELECT ... WHERE NOT EXISTS (reservation nào overlap)   -- (1)
INSERT INTO reservations ...                            -- (2)
```

Giữa (1) và (2) luôn có một khe thời gian. Hai người bấm "Đặt bàn" trong cùng một
giây đều thấy bàn trống ở bước (1), rồi cả hai cùng ghi ở bước (2). Kết quả: hai
khách, một bàn, 19:00 tối thứ Bảy.

`SELECT ... FOR UPDATE` trên bảng `ban` có thu hẹp khe đó, nhưng nó khoá **nhầm
đối tượng**: thứ cần bảo vệ là *cặp (bàn, khung giờ)*, không phải cái bàn. Và bất
kỳ đoạn mã mới nào quên lấy khoá đều phá được.

### Cách giải

MySQL/MariaDB không có `EXCLUDE` constraint trên khoảng thời gian như PostgreSQL.
Nên hệ thống **băm khoảng thời gian thành lưới ô 15 phút** và đặt khoá chính lên đó:

```sql
CREATE TABLE reservation_slot_locks (
  table_id   INT      NOT NULL,
  slot_start DATETIME NOT NULL,
  reservation_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (table_id, slot_start)      -- ← hàng rào
);
```

Một lượt đặt 19:00–21:00 trên bàn B05 (kèm 15 phút dọn bàn) chiếm 9 dòng:
19:00, 19:15, … 21:00.

Lượt thứ hai muốn B05 lúc 20:00 sẽ đâm vào dòng `(B05, 20:00)` đã có chủ →
MySQL trả lỗi `ER_DUP_ENTRY` **ngay trong transaction**. Không có khe thời gian
nào lọt qua được, kể cả khi tầng ứng dụng viết sai.

Hai hệ quả tốt đi kèm:

- **Câu hỏi "bàn nào trống" và ràng buộc chống trùng dùng chung một bảng.** Khi
  hàm `banKhaDung()` nói "B05 còn trống" thì lệnh `INSERT` ngay sau đó chắc chắn
  thành công — không thể có chuyện hệ thống báo còn bàn rồi báo lỗi ngay sau.
- **Thời gian dọn bàn được tính vào lưới.** Bàn 19:00–21:00 không thể giao ngay
  cho khách 21:00; ô 21:00 vẫn thuộc lượt trước.

Kích thước ô 15 phút được khai ở **hai nơi và phải khớp nhau**:
`RESERVATION_SLOT_MINUTES` trong `services/reservationRules.js` và `SLOT_MINUTES`
trong migration 030. Đổi một bên mà quên bên kia thì các ô cũ và ô mới không còn
xếp chồng lên nhau, và hàng rào thủng đúng bằng độ lệch đó.

**Giờ được làm tròn xuống đầu ô.** Không làm tròn thì lượt 19:07–20:07 và lượt
19:14–20:14 sinh ra hai dãy ô lệch hoàn toàn, và cùng đặt được một bàn.

**Ô cũ được dọn mỗi ngày lúc 03:00**, giữ lại 7 ngày. Lịch sử nằm ở bảng
`reservations`, không ở lưới ô.

---

## 3. Bố cục mã nguồn

```
config/migrations/030_dat_ban_chuyen_nghiep.js   lược đồ + danh mục + backfill

services/
  reservationRules.js      LUẬT   thuần túy: giờ, thời lượng, cọc, hoàn tiền,
                                  máy trạng thái. Không đụng bàn, không ghi.
  reservationTables.js     BÀN    tìm bàn trống, ghép bàn, chấm điểm, sơ đồ,
                                  chiếm/nhả ô lưới.
  reservationService.js    ĐIỀU PHỐI  vòng đời một lượt đặt, transaction, nhật ký.
  reservationConfig.js     GHI CẤU HÌNH  chỉ dành cho màn hình quản lý.
  reservationJobs.js       NỀN    vòng quét 60 giây: no-show, nhắc lịch, cọc quá hạn.

routes/datBan.js           REST API + các trang

views/
  dat-ban-chon.ejs             khách — trang chọn hình thức (/datban)
  huong-dan-dat-ban.ejs        khách — hướng dẫn, đọc cấu hình đang chạy
  reservation.ejs              khách — trợ lý 4 bước có sơ đồ bàn
  reservation-xong.ejs         khách — trang xác nhận
  reservation-tra-cuu.ejs      khách — tự đổi giờ / hủy
  staff/reservations.ejs       nhân viên — danh sách + sơ đồ + timeline
  staff/dat-ban-phan-tich.ejs  quản lý — biểu đồ
  admin/dat-ban.ejs            quản trị — cấu hình
  partials/so-do-dat-ban.ejs   thành phần sơ đồ bàn dùng chung
```

**Vì sao tách `reservationRules` khỏi `reservationService`:** trang cấu hình của
quản lý và tầng tạo lượt đặt phải dùng **chung một cách tính**. Nếu mỗi bên tự
tính, số tiền cọc báo trước cho khách sẽ khác số tiền thu thật. Ngoài ra toàn bộ
`reservationRules` là hàm thuần — test được không cần CSDL (`npm run datban:check`
phần A chạy được ngay cả khi MySQL tắt).

**Vì sao sơ đồ bàn là một partial dùng chung:** khách nhìn sơ đồ để *chọn* bàn,
nhân viên nhìn để *biết chuyện gì đang xảy ra* — hai mục đích khác nhau, nhưng
cái vẽ ra phải giống hệt nhau. Viết hai bản thì sớm muộn một bản được sửa màu
"đang dọn" còn bản kia thì không.

---

## 4. Sơ đồ bàn

Một thành phần duy nhất — `views/partials/so-do-dat-ban.ejs` — vẽ **cả ba** sơ đồ
trong hệ thống:

| Nơi dùng | Chế độ |
|---|---|
| `/dat-ban` bước 2 | khách bấm chọn bàn |
| `/staff/dat-ban` tab Sơ đồ + ngăn đổi bàn | nhân viên xem / gán bàn |
| `/so-do-ban` | thời gian thực, kèm kéo thả sắp xếp |

Viết một bản chứ không ba: khách nhìn sơ đồ để *chọn* bàn, nhân viên nhìn để *biết
chuyện gì đang xảy ra* — hai mục đích khác nhau, nhưng cái vẽ ra phải giống hệt
nhau. Ba bản thì sớm muộn một bản được sửa màu "đang dọn" còn hai bản kia thì
không, và lúc đó nhân viên với khách nhìn thấy hai nhà hàng khác nhau.

### Vẽ bàn như một cái bàn, không phải một ô màu

Mỗi bàn là một khối SVG: **mặt bàn ở giữa và ghế xếp quanh, đúng bằng số chỗ**.
Bàn từ 4 chỗ trở xuống vẽ hình tròn, từ 5 chỗ trở lên vẽ chữ nhật — đúng như cách
kê bàn ngoài đời.

Bản đầu tiên vẽ mỗi bàn thành một hình tròn tô màu kèm dòng chữ "6 chỗ". Cách đó
đọc được, nhưng phải **đọc** — mắt phải dừng lại, tìm dòng chữ, rồi mới biết bàn
đó bao nhiêu chỗ. Với 40 bàn trên một màn hình, đó là 40 lần dừng lại. Vẽ ghế ra
thì sức chứa thành thứ **nhìn là thấy**: bàn 2 chỗ và bàn 12 chỗ khác nhau ngay từ
cái liếc đầu tiên.

### Toạ độ: ngang giữ thật, dọc nắn về hàng

`toa_do_x/y` là toạ độ quản lý kéo thả ở `/so-do-ban`.

**Chiều ngang giữ nguyên** — đó là thứ tả mặt bằng: bàn nào cạnh cửa, bàn nào gần
bếp.

**Chiều dọc được nắn về hàng**: gom các giá trị y thành cụm rồi đặt mỗi cụm vào một
hàng chia đều chiều cao khu. Toạ độ y trong CSDL nằm rải rác (20, 148, 341…) và khi
đổi sang phần trăm thì hai hàng bàn cách nhau nửa màn hình, để lại một mảng trống ở
giữa. Nắn về hàng giữ được điều thực sự có nghĩa — bàn nào cùng hàng với bàn nào —
mà bỏ đi khoảng thừa.

Bàn chưa bao giờ được kéo thả (toạ độ đều bằng nhau) thì không còn thông tin nào để
giữ: xếp đều thành lưới.

### Mỗi khu vực một dải riêng

Khi xem nhiều khu cùng lúc, **mỗi khu được một dải riêng** thay vì vẽ chung một mặt
bằng. Bắt buộc phải thế: `toa_do_x/y` là toạ độ **trong từng khu**, nên vẽ chung thì
bàn của Sảnh chính đè lên bàn của Phòng VIP. Bản đầu tiên vẽ chung và cho ra đúng
kết quả đó — một đống hình chồng nhau ở nửa trên, nửa dưới bỏ trống.

Tỷ lệ thu nhỏ lấy **giá trị nhỏ nhất trong các khu**, không phải tỷ lệ riêng từng
khu: các khu phải cùng một cỡ bàn, nếu không bàn 4 chỗ ở khu này lại to hơn bàn 6
chỗ ở khu bên cạnh — và sơ đồ nói dối về sức chứa.

Tỷ lệ được **tính lại khi khung đổi bề ngang** (`ResizeObserver`). Nó suy ra từ bề
ngang thực tế lúc vẽ, nên xoay điện thoại hay kéo cửa sổ đều làm nó sai và bàn đè
lên nhau.

### Điện thoại: cuộn ngang, không thu nhỏ đến mức không đọc được

Dưới 760px, mặt bằng giữ `min-width: 620px` và **cuộn ngang**, đúng cách mọi bản đồ
giấy vẫn làm. Ép 7 bàn một hàng vào 340px thì tên bàn chỉ còn vài pixel.

### Màu không phải là thông tin duy nhất

Khoảng 8% nam giới khó phân biệt đỏ với xanh. Mỗi trạng thái vì vậy mang **bốn** tín
hiệu: màu mặt bàn, màu ghế, một **huy hiệu hình học** ở góc bàn (dấu tích, đồng hồ,
người ngồi, hai vạch chéo, dấu X), và nhãn chữ đầy đủ trong `title` + `aria-label`:

> `B05 · 6 chỗ · Đã có khách đặt · Sảnh chính · gần cửa sổ`

Huy hiệu được **vẽ bằng đường thẳng, không dùng phông chữ biểu tượng**: phông có thể
chưa tải xong (hoặc bị chặn) đúng lúc sơ đồ hiện ra, và lúc đó cả mặt bằng chỉ còn
màu sắc để phân biệt — đúng cái mà huy hiệu sinh ra để tránh.

Chú thích cũng do chính thành phần đó vẽ (`SoDoDatBan.chuThich`), dùng cùng hàm vẽ
bàn thu nhỏ. Một bảng màu viết tay sẽ lệch khỏi sơ đồ ngay lần đầu ai đó đổi một màu.

### Khách không thấy thông tin của khách khác

API công khai `/api/dat-ban/so-do` gọi `soDoBan({ choKhach: true })`, và ở chế độ
đó hàm **không truy vấn** tên khách, số điện thoại hay mã đặt bàn của người khác.
Đây là lớp chặn ở tầng dữ liệu, không phải ở tầng hiển thị — một sơ đồ trên trang
công khai mà hiện tên người đặt là rò rỉ dữ liệu cá nhân, dù nó chỉ nằm trong một
thẻ `div`.

Ranh giới đó được viết thẳng vào đường dẫn:

| Tiền tố | Phân quyền |
|---|---|
| `/api/dat-ban/*` | Công khai. Không bao giờ trả về dữ liệu của khách khác hay số liệu kinh doanh. |
| `/api/reservations/*` | Bắt buộc đăng nhập nhân viên. |

Một API duy nhất rồi "ẩn bớt trường theo quyền" nghe gọn hơn, nhưng nó biến mỗi
lần thêm trường trả về thành một câu hỏi bảo mật dễ quên. Tách đôi thì viết một
trường nhạy cảm vào nhánh công khai là việc **phải có ý**, không phải việc làm
được do sơ ý.

---

## 5. Thuật toán xếp bàn

Đầu vào: số khách, ngày giờ, thời lượng, khu vực, thẻ yêu cầu đặc biệt, loại khách.
Đầu ra: các tổ hợp bàn, sắp theo điểm tăng dần (**điểm thấp = tốt**).

```
điểm = 60 × số bàn
     +  1 × số ghế thừa
     + 40   nếu ghép khác khu vực
     − 25   mỗi sở thích được đáp ứng (cửa sổ / yên tĩnh / phòng riêng / xe lăn)
     − 35   khách VIP được xếp bàn VIP
     + 30   khách thường chiếm bàn VIP
```

Trọng số `số bàn` lớn hơn nhiều so với `ghế thừa` là có chủ đích: một bàn 6 chỗ
cho 4 khách (thừa 2 ghế → 62 điểm) luôn phải thắng hai bàn 2 chỗ vừa khít
(120 điểm). Người thật thích ngồi một bàn hơn là ngồi ghép, và ghép bàn tốn công
nhân viên kê bàn, đổi khăn.

Đúng ví dụ trong yêu cầu: **15 khách → bàn 6 + bàn 6 + bàn 4 = 16 ghế.**

Ràng buộc cứng:

- Tổng chỗ ≥ số khách (BR-002).
- Không quá `max_tables_per_reservation` bàn (mặc định 4).
- Bàn có `co_the_ghep = 0` chỉ được dùng một mình.
- Chỉ ghép các bàn cùng `nhom_ghep`. Mặc định `nhom_ghep = 'KV<id khu vực>'`, nên
  mặc định là "chỉ ghép trong cùng khu". Đặt nhóm riêng cho trường hợp hai bàn kề
  nhau về số hiệu nhưng bị lối đi / cột nhà chia cắt — ghép được trên giấy mà
  không ghép được ngoài đời.

Thuật toán là duyệt sâu trên danh sách bàn sắp giảm dần theo số chỗ, cắt nhánh
khi đủ chỗ, và có trần 40.000 nút làm chặn cuối. Đo thật với 40 bàn: **18 ms cho
bốn lần tìm** (2, 8, 15, 30 khách).

### Sở thích đến từ danh mục, không viết cứng trong mã

Bảng `reservation_tag_catalog` có cột `table_hint`: thẻ `WINDOW` trỏ tới cột
`gan_cua_so`, `PRIVATE` trỏ tới `phong_rieng`. Quản lý thêm một thẻ mới kèm gợi ý
bàn mà không phải sửa mã nguồn.

---

## 6. Trạng thái thái bàn vật lý — ai được ghi vào `ban.trangthai`

`ban.trangthai` mô tả cái bàn **ngay lúc này**, và nó thuộc luồng gọi món /
thanh toán:

| Mã | Nghĩa | Ai đặt |
|---|---|---|
| 0 | Trống | cả hai |
| 1 | Đang phục vụ | luồng gọi món; đặt bàn đặt khi `SEATED` |
| 2 | Đã đặt trước | **chỉ** module đặt bàn |
| 3 | Đang dọn | luồng thanh toán; đặt bàn đặt khi `COMPLETED` |
| 4 | Bảo trì | chỉ quản trị, ở `/admin/dat-ban` |

Module đặt bàn **chỉ đổi qua lại giữa 0 và 2**, cộng hai trường hợp có thật là
`SEATED → 1` và `COMPLETED → 3`. Nó không bao giờ ghi đè một bàn đang ở trạng thái
1 hay 3 do luồng khác đặt — làm thế sẽ khiến một bàn đang có khách biến mất khỏi
màn hình thu ngân.

Ngược lại, **trạng thái vật lý không chặn mọi lượt đặt trong tương lai**:

- Bảo trì (4): chặn mọi lượt, mọi ngày.
- Đang phục vụ (1) / đang dọn (3): chỉ chặn các lượt bắt đầu trong
  `occupied_hold_minutes` (mặc định 90 phút) tới, vì không ai biết chắc khách hiện
  tại rời bàn lúc nào.
- Xa hơn mốc đó: không chặn — lưới ô lo phần còn lại.

Bản đầu tiên của module này lọc `trangthai = 0`, nghĩa là một nhà hàng đông khách
sẽ **không đặt trước được bàn nào**. Lỗi đó âm thầm: hệ thống chỉ báo "hết bàn".

---

## 7. Máy trạng thái lượt đặt

```
                    ┌──────────┐
        online ────▶│ PENDING  │────▶ CANCELLED / REJECTED
                    └────┬─────┘
                         │  hết bàn
                    ┌────▼─────┐
                    │ WAITLIST │────▶ CANCELLED / REJECTED
                    └────┬─────┘
                         │  có bàn trống
                    ┌────▼──────┐
  nhân viên tạo ───▶│ CONFIRMED │────▶ CANCELLED / NO_SHOW
                    └────┬──────┘
                         │
                    ┌────▼────┐
      walk-in ─────▶│ ARRIVED │────▶ CANCELLED / NO_SHOW
                    └────┬────┘
                    ┌────▼────┐
                    │ SEATED  │────▶ CANCELLED
                    └────┬────┘
                    ┌────▼──────┐
                    │ COMPLETED │   (một chiều)
                    └───────────┘
```

`doiTrangThai()` là **cửa duy nhất** để đổi cột `status`. Không route nào được
`UPDATE` thẳng. Lý do: mỗi bước chuyển kéo theo những việc **không được phép
quên** — ghi mốc thời gian, nhả ô lưới, đồng bộ `ban.trangthai`, tính hoàn tiền,
cập nhật bộ đếm no-show của khách, ghi nhật ký. Rải các việc đó ra từng route thì
sớm muộn có một lối ra quên nhả ô, và bàn đó bị khoá vĩnh viễn.

Vài quyết định đáng chú ý:

- `SEATED → NO_SHOW` **không được phép**: khách đang ngồi ngay đó.
- `COMPLETED` một chiều: muốn "mở lại" thì tạo lượt mới, vì lịch sử phải giữ được
  dấu vết thật.
- `DELETE /api/reservations/:id` **ánh xạ sang CANCELLED, không xoá**. Một lượt đặt
  đã tồn tại là một sự thật lịch sử: nó ảnh hưởng bộ đếm no-show của khách, báo cáo
  tháng, và đôi khi cả một khoản tiền cọc.
- `COMPLETED` **giữ nguyên ô lưới**. Nhả ra sẽ cho phép đặt đè lên chính khung giờ
  vừa phục vụ, bỏ qua cả thời gian dọn bàn. Chỉ CANCELLED / REJECTED / NO_SHOW mới
  nhả ô — và nhả ngay, vì một bàn bị giữ bởi lượt đã hủy là lỗi tốn tiền nhất
  module này có thể gây ra.

---

## 8. Vòng quét nền

`services/reservationJobs.js` chạy mỗi 60 giây trong chính tiến trình web. Năm
việc, mỗi việc bọc `try` riêng để một việc hỏng không làm các việc còn lại ngừng:

| Việc | Làm gì |
|---|---|
| `quetNoShow` | Quá `hold_until` → **cảnh báo** (một lần). Quá thêm `auto_no_show_minutes` → tự đóng NO_SHOW. |
| `quetCocQuaHan` | `PENDING` + cọc chưa trả + quá `deposit_due_at` → tự hủy, trả bàn (BR-005). |
| `quetNhacLich` | Nhắc khách trước `reminder_lead_minutes` (mặc định 120 phút). |
| `dongBoTrangThaiBan` | Đánh dấu bàn sắp có khách là "Đã đặt trước", trả lại khi lượt qua đi. |
| `phatThongBao` | Đẩy hàng đợi `reservation_notifications` ra socket + email. |

**`dongBoTrangThaiBan` chỉ đụng vào bàn của chính nó.** Màn hình `/staff/so-do-ban`
có nút cho nhân viên đánh dấu tay một bàn là "Đã đặt trước" (khách gọi điện giữ
chỗ, chưa kịp nhập đơn). Vòng quét vì thế chỉ trả về Trống những bàn **đã từng có
lượt đặt trong ngày hôm nay** — tức những bàn chắc chắn do nó đặt nhãn. Bản đầu
tiên hỏi rộng hơn ("bàn nào đang ở trạng thái 2 mà không có lượt sắp tới") và xoá
sạch nhãn đánh dấu tay của cả nhà hàng trong vòng 60 giây. `npm run datban:check`
mục B9 giữ cho lỗi đó không quay lại.

**Hai mốc cho no-show, không phải một.** Tự đóng ngay tại mốc đầu là sai — khách
kẹt xe 10 phút không phải khách bỏ bữa. Nhưng không bao giờ tự đóng cũng sai —
22h đêm không còn ai ngồi dọn mà bàn thì vẫn bị giữ. Đặt `auto_no_show_minutes = 0`
để tắt hẳn phần tự động.

**Thông báo được xếp hàng chứ không gửi ngay.** Gửi email trong transaction thì
(1) chậm và có thể lỗi, làm hỏng một giao dịch đặt bàn đã thành công; (2) nếu
rollback, khách đã nhận mail xác nhận cho một lượt đặt không tồn tại. Bảng
`reservation_notifications` giải hai vấn đề đó cùng lúc; gửi hỏng thì đánh dấu
`FAILED` chứ không xoá, để còn biết mà gọi điện bù.

**Vì sao không dùng cron riêng:** thêm một tiến trình là thêm một thứ phải nhớ
bật, phải giám sát, phải chia sẻ kết nối CSDL — và nó không phát được socket ngay
cho màn hình nhân viên. Đánh đổi: chạy nhiều bản sao web thì mỗi bản cùng quét;
mọi thao tác đều đi qua `doiTrangThai` (có `FOR UPDATE` + kiểm tra máy trạng thái)
nên bản thứ hai chỉ nhận lỗi "không thể chuyển NO_SHOW → NO_SHOW" và bỏ qua.

---

## 9. Tiền cọc và chính sách hủy

### Cọc — chọn **một** quy tắc, không cộng dồn

Bảng `reservation_deposit_rules`, lấy quy tắc hợp lệ có `priority` **nhỏ nhất**.
Khách đọc được một dòng lý do rõ ràng ("Nhóm đông từ 10 khách: 100.000đ × 12
khách") thay vì một con số từ trên trời rơi xuống.

Mặc định sau khi cài:

| Ưu tiên | Quy tắc | Số tiền |
|---|---|---|
| 10 | Nhóm đông từ 10 khách | 100.000đ/khách |
| 20 | Khách VIP | 500.000đ |
| 20 | Khách doanh nghiệp | 150.000đ/khách |
| 50 | Giờ cao điểm 18:00–21:00, từ 6 khách | 300.000đ |
| 900 | Khách thường | không cần cọc |

Quy tắc "không cần cọc" để ưu tiên lớn nhất, làm điểm dừng cuối.

### Hủy — lấy mốc **lớn nhất mà khách vẫn còn đáp ứng**

Hủy trước 30 giờ thì thỏa cả ba mốc 24/6/2 → lấy mốc 24 giờ, hoàn 100%.
Hủy trước 3 giờ thì chỉ thỏa mốc 2 giờ → hoàn 0%.

Cùng một mốc giờ, chính sách chuyên biệt (VIP / nhóm đông / giờ cao điểm) thắng
chính sách `ALL`, vì nó là ưu đãi được đặt ra có chủ đích cho nhóm đó.

**No-show luôn hoàn 0%**, không phụ thuộc bảng chính sách.

**Chỉ hoàn lại tiền đã thu thật.** `deposit_amount` là số tiền *phải* cọc theo quy
tắc — nó tồn tại ngay cả khi khách chưa trả đồng nào (`deposit_status = 'UNPAID'`).
Lấy thẳng cột đó mà hoàn sẽ hứa trả lại khách một khoản nhà hàng chưa bao giờ nhận.

Số tiền hoàn được **tính một lần lúc hủy và lưu lại** (`refund_percent`,
`refund_amount`). Tính lại lúc kế toán mở ra sẽ cho số khác vì thời gian đã trôi
qua — và con số hứa với khách lúc hủy mới là con số đúng.

Màn hình xác nhận gọi `xemTruocHuy()` **trước khi hỏi**, nên câu hỏi mang đủ thông
tin: *"Khách đã cọc 500.000đ. Hủy trước 6 giờ — hoàn 50% của 500.000đ."* Một hộp
`confirm()` chỉ hỏi "bạn có chắc không" thì không giúp được ai quyết định.

---

## 10. Trợ lý đặt bàn của khách

Bốn bước, và thứ tự có chủ đích:

```
1. Thời gian   ngày · số khách · khung giờ (ô hết bàn hiện mờ, KHÔNG ẩn đi)
2. Chọn bàn    sơ đồ mặt bằng thật, tab theo khu vực
3. Thông tin   tên · điện thoại · dịp · yêu cầu đặc biệt
4. Xác nhận    đối chiếu lại + tiền cọc trước khi gửi
```

**Vì sao chia bước:** một form dài bắt khách điền hết rồi mới biết khung giờ đó
hết bàn — và lúc đó phải sửa lại từ đầu. Chia bước cho phép kiểm tra bàn **ngay ở
bước 1**, khi khách chưa bỏ công điền gì cả. Cũng vì vậy bước "chọn bàn" đứng
trước bước "thông tin": biết chắc có bàn rồi mới hỏi tên khách.

**Khung giờ hết bàn vẫn hiện, chỉ làm mờ.** Im lặng bỏ đi sẽ khiến khách tưởng
nhà hàng không mở cửa giờ đó và bỏ cuộc.

**Bước 2 có thể biến mất.** Tắt `allow_customer_pick_table` thì trợ lý còn ba bước
và hệ thống tự xếp bàn. Số bước được tính lúc khởi tạo chứ không viết cứng trong
HTML.

**Hết bàn không kết thúc bằng một câu báo lỗi.** API trả kèm `gio_thay_the` và
`khu_thay_the` — các khung giờ và khu vực **thật sự đặt được** (đã qua cả kiểm tra
giờ mở cửa lẫn kiểm tra bàn trống). Trang vẽ chúng thành nút bấm, bấm vào là nhảy
thẳng về bước 1 với giờ mới đã chọn sẵn.

**Không có JavaScript thì không có form.** `<noscript>` chỉ khách sang số điện
thoại của nhà hàng. Một form gửi thẳng không kiểm tra bàn sẽ nhận đơn cho những
khung giờ đã kín — hứa một điều không giữ được còn tệ hơn là bảo khách gọi điện.

### Khách tự quản lý lượt đặt

`/dat-ban/tra-cuu` — danh tính là **cặp (mã đặt bàn + số điện thoại)**. Không bắt
tạo tài khoản. Mã một mình không đủ: nó ngắn và nằm trong email có thể bị người
khác đọc. Ghép thêm số điện thoại đã dùng khi đặt là đủ khó đoán, mà vẫn là thứ
khách chắc chắn nhớ.

Số điện thoại gửi bằng **POST, không phải query string** — query string đi vào
lịch sử trình duyệt, nhật ký máy chủ và header `Referer` gửi sang bên thứ ba.

Mã đặt bàn có dạng `RSV-YYMMDD-XXXX`, bốn ký tự cuối lấy từ bảng chữ **đã bỏ
I, O, 0, 1** — bốn ký tự hay bị đọc nhầm nhất khi khách đọc mã qua điện thoại.

---

## 11. Trung tâm đặt bàn của nhân viên

Ba cách nhìn cùng một ngày, ba tab, một nguồn dữ liệu:

- **Danh sách** — ai đến lúc mấy giờ, xử lý từng lượt.
- **Sơ đồ bàn** — bàn nào trống *ngay lúc này* (chọn được giờ để xem).
- **Timeline** — bàn nào bận lúc nào trong cả ngày, nhìn ra khoảng trống.

Trong một ca làm việc nhân viên đổi qua đổi lại giữa chúng liên tục: khách đến
quầy hỏi "giờ còn bàn cho 6 người không" thì phải trả lời trong hai giây, không
phải sau hai lần tải trang.

**Dải cảnh báo ở trên cùng** chứa những việc không được phép bỏ lỡ, tách hẳn khỏi
bảng: khách quá hạn giữ bàn, lượt chờ duyệt, danh sách chờ, bàn sắp hết giờ. Trong
một bảng 40 dòng thì dòng quan trọng nhất cũng chỉ là một dòng như mọi dòng khác.

**Cờ rủi ro no-show** hiện ngay cạnh tên khách (`3× no-show`), và hiện cả khi nhân
viên vừa gõ xong số điện thoại trong form tạo mới — để biết phải đối xử thế nào
**trước khi** nhận đơn.

**Đổi bàn đi qua sơ đồ**, không qua ô nhập số hiệu: nhân viên nghĩ bằng vị trí bàn
thật ("cái bàn góc trong kia"), không bằng số hiệu.

Màn hình tự tải lại qua Socket.IO khi có thay đổi, gom nhiều sự kiện liên tiếp
thành một lần tải (2,5 giây) — giờ cao điểm có thể có năm thay đổi trong hai giây,
tải lại năm lần là màn hình nhảy liên tục và nhân viên mất chỗ đang bấm.

---

## 12. Hai cửa vào: `/datban` và trang hướng dẫn

### Vì sao `/datban` trở thành một trang chọn

Trước đây `/datban` đi **thẳng** vào form đặt bàn kèm đơn món, và bắt buộc phải có
món trong giỏ: giỏ rỗng thì khách bị đá ngược về trang giỏ hàng kèm một dòng báo
lỗi. Nghĩa là người **chỉ muốn giữ một cái bàn** — phần lớn khách đặt bàn — buộc
phải chọn món trước, hoặc tự đoán ra đường dẫn khác.

Giờ nó là một trang chọn, hai đường:

| | Đi tới | Cần gì |
|---|---|---|
| **Chỉ đặt bàn** | `/dat-ban` | Tên + số điện thoại |
| **Đặt bàn và gọi món trước** | `/menu` → giỏ hàng → `/datban/goi-mon` | Đăng nhập |

Hai điểm thiết kế:

- **Thẻ "Chỉ đặt bàn" đứng trước**, vì đó là việc phần lớn khách đến đây muốn làm.
  Đường còn lại dài hơn và chỉ hợp với người đã biết mình ăn gì; đặt nó lên trước
  là bắt đa số đọc qua một thứ không dành cho họ.
- **Thẻ thứ hai biết trạng thái giỏ hàng.** Đang có món thì nút đi **thẳng** vào
  `/datban/goi-mon`, không bắt đi lại bước chọn món; giỏ rỗng thì nút dẫn sang
  thực đơn. Cùng một thẻ, hai trạng thái — để khách không bao giờ bấm vào một nút
  rồi nhận được trang báo "giỏ hàng trống".

Trang chọn **không** yêu cầu đăng nhập. Nhánh "chỉ đặt bàn" không cần tài khoản;
nhánh "gọi món trước" tự chặn ở `/datban/goi-mon`. Bắt đăng nhập ngay ở trang chọn
là dựng một bức tường trước mặt người còn chưa biết mình muốn gì.

Các nút "Đặt bàn ngay" rải khắp site (trang chủ, giới thiệu, tin tức, chân trang)
đều trỏ về `/datban` — đúng, vì người bấm chúng chưa chọn gì. Riêng nút trong
**giỏ hàng** đi thẳng `/datban/goi-mon`: người đó đã chọn xong rồi.

### Trang hướng dẫn đọc thẳng cấu hình đang chạy

`/huong-dan-dat-ban` có mặt trên thanh menu chính. **Mọi con số trên trang này —
giữ bàn bao nhiêu phút, đặt trước tối thiểu bao lâu, cọc bao nhiêu, hủy trước mấy
giờ thì hoàn bao nhiêu, giờ mở cửa từng thứ — đều đọc từ cấu hình đang chạy**,
không viết cứng trong HTML.

Đó là lý do nó là một trang động chứ không phải một bài viết trong `bai_viet`. Một
hướng dẫn viết tay sẽ lệch khỏi thực tế ngay lần đầu quản lý đổi một tham số ở
`/admin/dat-ban`, và không ai nhớ quay lại sửa. Lúc đó nó **tệ hơn là không có
hướng dẫn nào** — vì khách đọc nó, tin nó, rồi bị hệ thống từ chối bởi một quy tắc
khác.

Đã kiểm chứng: đổi `grace_period_minutes` 15 → 25 thì trang tự hiện 25 phút (sau
khi hết đệm cấu hình 30 giây), đổi lại thì về 15.

Trang cũng chỉ hiện chính sách và quy tắc **đang bật**. Quy tắc quản lý đã tắt vẫn
nằm trong CSDL để tra lại các lần hủy cũ, nhưng khách không cần thấy chúng.

Thêm mục vào thanh menu kéo theo một thay đổi CSS: điểm ngắt chuyển menu sang ngăn
kéo được nâng **1024px → 1180px**. "Hướng dẫn đặt bàn" là nhãn dài nhất trong menu,
và với khách đã đăng nhập thì hàng ngang có bảy mục — đo ở 1140px thì tổng bề ngang
vượt khung và đẩy nút "Đặt bàn" tràn ra ngoài.

---

## 13. Các tình huống nghiệp vụ được xử lý

| # | Tình huống | Xử lý ở đâu |
|---|---|---|
| 1 | Hai khách đặt cùng bàn cùng giờ | `reservation_slot_locks` (§2) + thử lại tự động |
| 2 | Khách đặt vượt sức chứa bàn | `goiYXepBan` — BR-002 |
| 3 | Đổi số lượng khách | `capNhat` — kiểm tra lại bàn (BR-007) |
| 4 | Khách đến sớm | `check-in` → `seat` bất kỳ lúc nào trước giờ |
| 5 | Khách đến trễ | `hold_until` + nút "Giữ thêm 15 phút" |
| 6 | Khách không đến | `quetNoShow` — cảnh báo rồi tự đóng |
| 7 | Khách hủy | `/dat-ban/tra-cuu` hoặc nhân viên, kèm tính hoàn tiền |
| 8–10 | Đổi giờ / ngày / bàn | `capNhat`, `ganBan` |
| 11–12 | Bàn đang dọn / bảo trì | `lyDoKhongDung` (§6) |
| 13 | Nhà hàng full bàn | `WAITLIST` + gợi ý giờ và khu vực thay thế |
| 14 | Khách walk-in | `taoWalkIn` — tạo và xếp bàn trong một bước |
| 15 | Khách VIP | điểm ưu tiên bàn VIP + cờ VIP trên mọi màn hình |
| 16–17 | Nhóm lớn, ghép nhiều bàn | `timToHop` (§5) |
| 18–19 | Tiền cọc, hoàn tiền | §9 |
| 20 | No-show | `hoanTienKhiNoShow` — luôn 0% |
| 21 | Giờ cao điểm | `peak_hours` → quy tắc cọc riêng |
| 22 | Hai lượt liên tiếp cùng bàn | `turnaround_minutes` cộng vào lưới ô |
| 23 | Đặt định kỳ | `taoLichLap` — trả về cả danh sách thất bại |
| 24 | Khách có nhiều lượt đặt | `lichSuKhach` theo số điện thoại |
| 25 | Khách no-show nhiều lần | `no_show_block_threshold` chặn kênh online |

Vài quy tắc **tự bổ sung** ngoài yêu cầu, kèm lý do:

- **Không cho đặt quá `max_advance_days` (90 ngày).** Lịch xa hơn thế không quản
  được: thực đơn đổi, nhân sự đổi, và tỷ lệ no-show tăng theo khoảng cách thời gian.
- **`last_seating_minutes` — ngừng nhận đặt trong 60 phút cuối trước giờ đóng.**
  Nhà hàng đóng 22:00 mà vẫn nhận bàn 21:50 thì khách chỉ được ngồi 10 phút; nhận
  đơn đó là làm khó cả hai bên.
- **`max_guests_online` (30) chỉ áp cho kênh online.** Nhóm 60 người không phải
  việc một form web tự quyết được — phải có người gọi điện thoả thuận. Nhân viên
  tạo hộ thì không bị trần này.
- **Chặn đặt online sau N lần no-show, nhưng không chặn nhân viên.** Người thật vẫn
  có thể nhận đơn sau khi nói chuyện với khách, hoặc yêu cầu đặt cọc. Chặn máy móc
  một khách hàng thật là cái giá đắt hơn một bàn trống.
- **Bàn nhân viên gán tay (`manual_tables`) không bị tự xếp lại** khi cập nhật, nếu
  vẫn đủ chỗ và vẫn trống. Nhân viên đã có lý do khi chọn đúng bàn đó (khách quen
  thích bàn gần cửa sổ); hệ thống không nên âm thầm lật lại quyết định của họ.
- **Khách vãng lai được phép có giờ bắt đầu trong quá khứ gần (60 phút).** Giờ của
  họ bị làm tròn xuống đầu ô lưới để xếp đúng lưới với các lượt đặt trước, nên
  10:07 thành 10:00 — đã là quá khứ ngay khi vừa tạo. Và nhân viên thường nhập
  sau khi đã dẫn khách vào bàn xong. Bản đầu tiên chặn đúng trường hợp này bằng
  lỗi `IN_PAST`; lỗi chỉ lộ ra khi thử thật qua HTTP.
- **Thêm ngày nghỉ vào ngày đã có khách đặt thì cảnh báo, không chặn.** Quản lý có
  thể thật sự phải đóng cửa (mất điện, tang lễ), nhưng phải biết có bao nhiêu lượt
  cần gọi điện báo khách.

---

## 14. API

Mọi thao tác ghi đều là `POST`/`PUT`/`DELETE`, kể cả hủy và no-show. Một lượt đặt
bị hủy thì không lùi lại được; để nó sau một đường link `GET` là để một con bot
quét link hủy bàn của khách thật.

### Công khai — `/api/dat-ban/*`

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/khu-vuc` | danh sách khu vực |
| GET | `/danh-muc` | thẻ yêu cầu đặc biệt |
| GET | `/khung-gio?ngay&so_khach&khu_vuc` | các khung giờ trong ngày, kèm `con_ban` |
| GET | `/kha-dung?…` | kiểm tra + gợi ý bàn + tiền cọc |
| GET | `/so-do?ngay&gio&so_khach&khu_vuc` | sơ đồ bàn (đã lọc thông tin khách khác) |
| POST | `/` | tạo lượt đặt |
| POST | `/tra-cuu` | tra cứu bằng mã + SĐT |
| POST | `/tra-cuu/huy` | khách tự hủy |
| POST | `/tra-cuu/doi-lich` | khách tự đổi giờ |

### Nội bộ — `/api/reservations/*`, `/api/tables/*`

```
GET    /api/reservations                     lọc: ngay, tu_ngay, den_ngay, trang_thai,
                                             nguon, loai_khach, dien_thoai, tim, gioi_han
GET    /api/reservations/timeline?ngay
GET    /api/reservations/dashboard?ngay
GET    /api/reservations/analytics?tu&den    (Quản lý)
GET    /api/reservations/khach/:phone        hồ sơ + lịch sử
PUT    /api/reservations/khach/:phone        gán VIP, ghi chú, chặn  (Quản lý)
GET    /api/reservations/:id
GET    /api/reservations/:id/xem-truoc-huy

POST   /api/reservations                     tạo
POST   /api/reservations/walk-in             khách vãng lai
POST   /api/reservations/recurring           đặt định kỳ
PUT    /api/reservations/:id                 đổi lịch / số khách / khu vực
DELETE /api/reservations/:id                 → CANCELLED (không xoá)

POST   /api/reservations/:id/confirm | check-in | seat | complete | cancel | no-show | waitlist
POST   /api/reservations/:id/reject          (Quản lý)
POST   /api/reservations/:id/assign-table
POST   /api/reservations/:id/giu-them        { phut }
POST   /api/reservations/:id/deposit         (Thu ngân, Kế toán, Quản lý)

GET    /api/tables/availability?…
GET    /api/tables/floor-plan?ngay&gio&khu_vuc&bo_qua
```

Mỗi bước chuyển trạng thái có **đường dẫn riêng** thay vì một
`PUT /:id/status` nhận trạng thái trong thân request: đường dẫn riêng cho phép đặt
quyền khác nhau cho từng bước (chỉ Quản lý được `reject`), và đọc nhật ký máy chủ
là biết ngay ai đã làm gì.

### Định dạng lỗi

```json
{ "ok": false, "ma": "FULL", "thong_bao": "Rất tiếc, nhà hàng đã kín bàn…",
  "chi_tiet": { "gio_thay_the": [...], "khu_thay_the": [...] } }
```

Hết phiên trên nhánh nội bộ trả **401 JSON**, không chuyển hướng:

```json
{ "ok": false, "ma": "HET_PHIEN", "thong_bao": "Phiên đăng nhập đã hết…" }
```

Chuyển hướng sang trang đăng nhập là đúng cho một *trang*, sai cho một *API*:
`fetch()` đi theo chuyển hướng, nhận về HTML, rồi `r.json()` ném lỗi cú pháp — và
giao diện hiện "Mất kết nối tới nhà hàng" trong khi sự thật chỉ là ca làm việc đã
hết giờ.

Lỗi nghiệp vụ (`LoiDatBan`) mang thông điệp **viết cho người đọc** và được trả
nguyên văn kèm mã máy đọc được. Lỗi khác là lỗi của chúng ta: ghi log đầy đủ nhưng
chỉ trả ra một câu chung, vì thông điệp của MySQL có thể lộ tên bảng, tên cột hoặc
cả một phần câu truy vấn.

---

## 15. Cấu hình

`/admin/dat-ban` — sáu thẻ, **mỗi thẻ lưu riêng**. Một nút "Lưu tất cả" nghe gọn
hơn, nhưng nó biến một lần sửa nhỏ ("đóng cửa thứ Hai") thành một lần ghi đè lên
cả sáu nhóm — và nếu một nhóm có giá trị không hợp lệ thì cả sáu đều không lưu được.

Danh sách khoá được phép sửa qua giao diện là **danh sách trắng** kèm miền giá trị
(`KHOA_CHO_PHEP` trong `reservationConfig.js`). Một khoá mới thêm vào CSDL không tự
động trở thành sửa được từ web, và miền giá trị chặn các cấu hình vô nghĩa trước
khi chúng kịp gây sự cố — ví dụ thời gian giữ bàn 0 phút sẽ biến mọi khách thành
no-show ngay khi đến giờ.

Có một kiểm tra chéo: **thời gian giữ bàn phải nhỏ hơn thời lượng ngắn nhất**.

Cấu hình được đệm 30 giây trong bộ nhớ (đọc rất nhiều, sửa rất ít). Mọi hàm ghi
đều gọi `xoaDemCauHinh()` — quên bước này thì quản lý bấm Lưu, trang báo thành
công, mà hệ thống vẫn chạy theo cấu hình cũ thêm 30 giây.

---

## 16. Kiểm tra

```bat
npm run datban:check
```

**Phần A — 33 phép thử logic thuần túy**, chạy được ngay cả khi MySQL tắt: lưới ô
thời gian (kể cả qua nửa đêm và làm tròn), thời lượng theo số khách, chuẩn hoá số
điện thoại, máy trạng thái, thuật toán ghép bàn, chấm điểm, hiệu năng 40 bàn.

**Phần B — cần MySQL**: lược đồ, cấu hình, vòng đời một lượt đặt, khách vãng lai,
báo cáo, và vòng quét nền. Ba lớp chống đặt trùng được thử riêng, vì chúng bảo vệ
ở ba độ sâu khác nhau:

1. Hai yêu cầu cùng bàn cùng giờ bắn song song → cả hai bị từ chối.
2. Gọi thẳng `chiemO` lên ô đã có chủ → `RACE_LOST` **từ khoá chính**.
3. Lượt chồng lấn một phần (15:00 và 16:00) → bị từ chối.

Phép thử 2 là quan trọng nhất: nó bỏ qua toàn bộ tầng ứng dụng và hỏi thẳng CSDL.
Nếu nó hỏng thì mọi lớp bảo vệ còn lại chỉ là quy ước lập trình — và sẽ có ngày
một đoạn mã mới quên mất quy ước đó.

Phần B tạo dữ liệu thật rồi dọn sạch trong khối `finally` — bao gồm **trả trạng
thái vật lý của bàn về Trống trước khi xoá lượt đặt**. Xếp khách vào bàn đặt
`ban.trangthai = 1`, hoàn tất đổi tiếp thành 3; xoá dòng reservation không tự động
hoàn tác hai bước đó, và một bàn kẹt ở "Đang phục vụ" mà không có đơn nào là thứ
nhân viên phải vào sơ đồ gỡ tay.

Vẫn không nên chạy trên CSDL đang vận hành — nó tạo ra vài lượt đặt mà nhân viên
nhìn thấy trong khoảng thời gian script chạy.

Ngoài ra `/admin/dat-ban` có nút **"Chạy một nhịp quét"** để kiểm tra vòng quét nền
ngay, không phải chờ đến chu kỳ kế tiếp.
