# Giao hàng & theo dõi shipper bằng GPS

Tài liệu này mô tả phân hệ vận chuyển: bài toán nó giải, các bảng dữ liệu, luồng
một đơn hàng đi qua, cách vận hành, và những chỗ dễ hiểu nhầm.

---

## 1. Trước và sau

Cột `hopdong.loai_don` đã có giá trị `'giao_hang'` từ migration 003, và câu trả
lời sẵn của trợ lý ảo vẫn hứa *"nhà hàng có nhận mang về và giao hàng trong bán
kính 5km"*. Nhưng trong toàn hệ thống **không có chỗ nào** ghi đơn đó sẽ đi đâu,
ai cầm, và bao giờ tới. Đơn giao hàng nằm lẫn trong danh sách đặt bàn, không
phân biệt được với khách ăn tại chỗ.

Phân hệ này dựng phần còn thiếu trên đúng mô hình tổ chức sẵn có: một bộ phận
mới (GH), hai chức danh mới, sáu bảng dữ liệu, sáu quyền chi tiết, và bốn khu
màn hình cho bốn nhóm người dùng khác nhau.

| Thành phần | File |
|---|---|
| Nghiệp vụ: cước phí, phân công, trạng thái, GPS | `services/vanChuyenService.js` |
| Router (4 khu đường dẫn) | `routes/vanChuyen.js` |
| Bảng, bộ phận, chức danh, quyền, tham số | `config/migrations/019_van_chuyen.js` |
| Quản trị: đơn vị vận chuyển + bảng giá | `views/admin/van-chuyen.ejs` |
| Quản trị: hồ sơ shipper | `views/admin/van-chuyen-shipper.ejs` |
| Điều phối: bảng đơn | `views/staff/giao-hang.ejs` |
| Điều phối: bản đồ thời gian thực | `views/staff/giao-hang-ban-do.ejs` |
| Điều phối: chi tiết một đơn + lộ trình | `views/staff/giao-hang-chi-tiet.ejs` |
| Ứng dụng điện thoại của shipper (PWA) | `views/shipper.ejs` |
| Khách tự tra cứu đơn của mình | `views/theo-doi-giao-hang.ejs`, `views/theo-doi-nhap-ma.ejs` |
| Sự kiện thời gian thực `shipper:vi-tri` | `services/realtime.js` |

---

## 2. Cài đặt

Chạy một lần:

```bash
node config/migrations/019_van_chuyen.js
```

Migration tạo 6 bảng, 2 đơn vị vận chuyển mặc định, bộ phận **GH — Giao hàng**,
hai chức danh **DPGH** (Điều phối giao hàng) và **SHIPPER**, 6 quyền mới, và 6
khóa tham số trong `cau_hinh`. **Chạy lại nhiều lần không hỏng gì** — mọi lệnh
thêm đều là `INSERT IGNORE` hoặc `CREATE TABLE IF NOT EXISTS`, và cấu hình bạn
đã chỉnh không bị kéo về mặc định.

### Bắt buộc: khai tọa độ nhà hàng

Không có tọa độ thì **không tính được khoảng cách**, nên mọi đơn sẽ có phí giao
bằng 0 và hệ thống không chặn được đơn ngoài vùng. Khai ở **Quản lý chấm công →
Cấu hình vị trí** (`/to-chuc/cham-cong`) — phân hệ giao hàng và phân hệ chấm
công dùng chung một cặp tọa độ, khai một lần cho cả hai.

### Ba bước còn lại

1. **Quản trị → Đơn vị vận chuyển** (`/admin/van-chuyen`) — sửa bảng giá hai đơn
   vị mặc định cho khớp giá thật. Khối *Ví dụ giá* dưới ba ô nhập tự tính ra
   tiền cho quãng 1 / 3 / 5 km ngay khi bạn gõ.
2. **Quản lý shipper** (`/admin/van-chuyen/shipper`) — bấm *Thêm shipper*, chọn
   đúng nhân viên ở ô **Nhân viên**. Chỉ nhân viên được gắn ở đây mới mở được
   ứng dụng `/shipper`.
3. **Tổ chức → Quản lý tổ chức** — bổ nhiệm chức danh `SHIPPER` hoặc `DPGH` cho
   họ, để họ có quyền tương ứng.

> **Hồ sơ shipper và chức danh là hai việc khác nhau.** Bổ nhiệm chức danh cho
> họ *quyền*; lập hồ sơ shipper cho hệ thống biết họ chạy xe gì, biển số nào,
> thuộc đơn vị nào và cầm được mấy đơn cùng lúc. Thiếu hồ sơ thì họ mở
> `/shipper` sẽ gặp một trang hướng dẫn thay vì mã 403 trống.

---

## 3. Bốn khu màn hình

Bốn nhóm người dùng, bốn khu đường dẫn tách bạch. Tách ra vì họ làm bốn việc
khác hẳn nhau trên bốn thiết bị khác nhau — nhét chung rồi ẩn bớt theo quyền thì
shipper phải cuộn qua bảng giá và danh sách đơn của cả đội, trên một màn hình 5
inch, giữa đường, một tay cầm mũ bảo hiểm.

| Ai | Đường dẫn | Làm gì |
|---|---|---|
| Quản trị | `/admin/van-chuyen`, `/admin/van-chuyen/shipper` | Khai đơn vị, bảng giá, hồ sơ shipper, tham số vận hành |
| Điều phối | `/staff/giao-hang`, `/staff/giao-hang/ban-do` | Nhận đơn, phân shipper, theo dõi bản đồ, xử lý sự cố |
| Shipper | `/shipper/` | Xem đơn của mình, chỉ đường, cập nhật trạng thái, phát GPS |
| Khách | `/theo-doi/<mã>` | Xem đơn đang ở đâu — **không cần đăng nhập** |

---

## 4. Vòng đời một đơn

```
        khách đặt trên web              điều phối          shipper
        (chọn "Giao tận nơi")
                 │
                 ▼
           ┌──────────┐  phân shipper  ┌─────────┐  "tới lấy hàng"  ┌──────────┐
           │ cho_phan │───────────────▶│ da_phan │─────────────────▶│ dang_lay │
           └──────────┘                └─────────┘                  └──────────┘
                 ▲                          │                            │
                 │ gỡ shipper               │                            │ "đã lấy hàng"
                 └──────────────────────────┘                            ▼
                                                                  ┌───────────┐
                                        ┌─────────────────────────│ dang_giao │
                                        │  "không giao được"      └───────────┘
                                        ▼                               │ "giao xong"
                                  ┌──────────┐                          ▼
                                  │ that_bai │                    ┌──────────┐
                                  └──────────┘                    │ da_giao  │
                                        │ phân lại                └──────────┘
                                        └──▶ da_phan
```

`huy` đi ra được từ mọi trạng thái trừ `da_giao`. Bảng chuyển đổi hợp lệ nằm
trong hằng `CHUYEN_DUOC` của `services/vanChuyenService.js` và là **nơi duy nhất**
quyết định điều đó — mọi màn hình đều gọi qua `doiTrangThai()`.

`that_bai` quay lại `da_phan` được: khách không nghe máy lần đầu, điều phối gọi
được thì cho giao lại chứ không bắt tạo đơn mới — tạo đơn mới là mất lịch sử và
mất liên kết với đơn gốc.

Khi đơn chuyển sang `da_giao`, hệ thống tự đặt `hopdong.tinhtrang = 3` (đã thanh
toán) cho toàn bộ đơn: khách giao hàng trả tiền cho shipper hoặc đã trả trước,
không ai ra quầy thanh toán nữa.

---

## 5. Cước phí tính thế nào

```
phí = phí_cơ_bản + làm_tròn_lên_0.5km(max(0, khoảng_cách − số_km_đầu)) × phí_mỗi_km
```

Khoảng cách là **đường chim bay** (công thức Haversine trên tọa độ), không phải
đường đi thật. Đường thật trong phố luôn dài hơn — thường 1.2 đến 1.4 lần. Con
số này dùng để **báo giá và chặn đơn ngoài vùng**, không phải cước phí chính xác
tuyệt đối. Muốn chính xác từng mét thì phải gọi một dịch vụ chỉ đường (OSRM,
Google Directions): thêm phụ thuộc ngoài, thêm khóa API, và thêm một điểm hỏng
khi mất mạng. Trong bán kính 5 km, sai số này nằm trong khoảng một hai nghìn
đồng — không đáng để đánh đổi.

Làm tròn lên từng **0.5 km** thay vì từng km: nhảy từng km làm phí vọt lên 5.000đ
chỉ vì lệch 50 m, còn tính từng mét thì ra con số lẻ khó đọc như 17.340đ.

**Chọn đơn vị nào:** hệ thống lấy đơn vị **rẻ nhất** trong số những đơn vị còn
với tới địa chỉ đó. Hai đơn vị bằng giá thì đơn vị có `thu_tu` nhỏ hơn thắng —
đội nhà để `thu_tu = 1` nên được ưu tiên, vì chỉ họ mới theo dõi được GPS.

**Phí thật luôn được tính lại ở máy chủ** từ tọa độ và bảng giá trong CSDL. Con
số hiện trên trang đặt hàng chỉ để xem. Tin vào số trình duyệt gửi lên thì ai
cũng sửa được phí giao về 0 bằng công cụ nhà phát triển.

---

## 6. GPS hoạt động ra sao

### Ứng dụng shipper

Trang `/shipper/` dùng `watchPosition` chứ không phải `setInterval` +
`getCurrentPosition`. Cách sau phải đánh thức chip GPS từ đầu mỗi lần — tốn pin
hơn hẳn, và điểm đầu tiên sau khi thức dậy thường có sai số lớn. `watchPosition`
giữ chip ở chế độ theo dõi liên tục và để hệ điều hành gộp với các ứng dụng khác
đang định vị; ứng dụng chỉ tự bóp **tần số gửi lên máy chủ** (mặc định 15 giây).

**Dải trạng thái định vị dính ở đỉnh màn hình** và không bao giờ ẩn. Trình duyệt
điện thoại tạm dừng JavaScript nền khi tắt màn hình, và Android giết hẳn tab khi
thiếu bộ nhớ — nghĩa là định vị **có thể chết mà không báo gì**. Không có dải
này thì shipper chạy nửa tiếng trong khi điều phối nhìn một chấm đứng yên, và
không ai biết cho tới lúc khách gọi phàn nàn. Dải chuyển đỏ ngay khi quá hai
nhịp không gửi được.

Ứng dụng cũng gửi lại vị trí ngay khi màn hình sáng trở lại
(`visibilitychange`), vì khi khóa máy thì bộ đếm bị giãn ra tới vài phút.

### Trang phải chạy trên `https://`

GPS chỉ tồn tại trong *secure context*. Mở bằng `http://<ip-lan>:3000` thì
không có định vị. Trang tự phát hiện và đưa thẳng đường dẫn `https://` bấm được
— giống hệt cách trang chấm công điện thoại đang làm.

### Hai bảng vị trí, cố ý không gộp

| Bảng | Ghi thế nào | Trả lời câu hỏi |
|---|---|---|
| `vi_tri_shipper` | thêm một dòng mỗi nhịp | *shipper đã đi đường nào?* |
| `vi_tri_shipper_moi_nhat` | ghi đè, mỗi shipper một dòng | *shipper đang ở đâu?* |

Hai câu hỏi có yêu cầu khác nhau: vị trí hiện tại phải đọc **rất nhanh** và chỉ
cần một dòng; vết đường đọc hiếm khi nhưng **lớn rất nhanh** (một shipper chạy
cả ngày sinh khoảng 2.000 dòng). Gộp lại thì hoặc bản đồ chậm dần theo thời
gian, hoặc phải xóa vết — mất khả năng đối chiếu khi khách khiếu nại.

### Lọc tín hiệu rác

Điểm có sai số trên **200 m** bị bỏ ở tầng service. GPS điện thoại trong nhà hoặc
giữa tòa nhà cao tầng có thể nhảy vài trăm mét; vẽ lên bản đồ sẽ thành một đường
zíc zắc vô lý và điều phối tưởng shipper đang đi lung tung. Máy chủ vẫn trả về
HTTP 200 cho những điểm này — ứng dụng không nên hiện thông báo lỗi cho một nhịp
sai số cao, nó chỉ cần biết để còn thử lại nhịp sau.

### Bản đồ điều phối

Ba nguồn dữ liệu nuôi màn hình `/staff/giao-hang/ban-do`, cố ý không gộp:

1. **HTML dựng sẵn** — bản đồ có chấm ngay khi trang vừa mở.
2. **Socket `shipper:vi-tri`** — đường chính, độ trễ khoảng một phần nghìn giây.
   Gói tin này **mang thẳng tọa độ** (khác mọi miền dữ liệu khác trong hệ thống,
   vốn chỉ báo "dữ liệu vừa đổi"), nên bản đồ chỉ cần dời chấm chứ không gọi lại
   API — xe chạy mượt với chi phí gần như bằng không.
3. **Gọi lại API mỗi 20 giây** — lưới an toàn. Gói tin socket có thể rơi khi
   mạng chập chờn; không có bước này thì bản đồ đứng im mà không ai biết.

Marker được **giữ theo id và cập nhật tại chỗ** thay vì xóa sạch rồi vẽ lại. Vẽ
lại làm popup đang mở bị đóng sập ngay giữa lúc điều phối đang đọc địa chỉ trong
đó — cứ 15 giây một lần.

Thư viện: **Leaflet + nền OpenStreetMap**. Không cần khóa API, không giới hạn
lượt xem, và không gửi dữ liệu đơn hàng của nhà hàng cho bên thứ ba nào — chỉ
tải về ảnh nền theo ô vuông tọa độ.

---

## 7. Trang theo dõi của khách

`/theo-doi/<mã>` là **trang duy nhất trong hệ thống mà người xem có thể không
đăng nhập gì cả**. Không thể đòi đăng nhập: đơn giao hàng có thể do lễ tân đặt
hộ qua điện thoại, hoặc đặt bằng tài khoản vãng lai của mã QR tại bàn — bắt đăng
nhập thì đúng những người đó không xem được đơn của chính mình.

`ma_giao` (dạng `GH0818-007`) đóng vai trò mã bí mật, và nó chỉ in trên đơn của
chính khách đó. Ba lớp chặn để mã này không bị dò:

1. **Chỉ nhận đơn chưa xong.** Đơn đã giao hôm trước thì mã hết tác dụng —
   người nhặt được tờ hóa đơn cũ không theo dõi được ai.
2. **Mỗi kết nối vào tối đa 5 phòng theo dõi.** Không thể ngồi thử mã hàng loạt
   trên một kết nối.
3. **Gói tin gửi vào phòng khách chỉ có tọa độ** — không có tên shipper, số điện
   thoại hay địa chỉ khách. Route cũng lọc dữ liệu trước khi đưa sang view: không
   số điện thoại shipper, không ghi chú nội bộ, không id nhân viên nào.

Bản đồ chỉ hiện khi đơn **đang chạy**. Đơn đã giao xong mà vẫn vẽ vị trí shipper
là để lộ họ đang ở đâu sau khi công việc đã kết thúc — không liên quan gì tới
khách nữa.

---

## 8. Phân quyền

Sáu quyền mới, nhóm **Giao hàng**:

| Mã quyền | Cho phép |
|---|---|
| `giao_hang.xem` | Xem đơn giao hàng |
| `giao_hang.phan_cong` | Phân đơn cho shipper, gỡ đơn, đổi trạng thái đơn của người khác |
| `giao_hang.cap_nhat` | Cập nhật trạng thái đơn **của mình** |
| `giao_hang.theo_doi` | Xem bản đồ theo dõi shipper |
| `giao_hang.shipper` | Quản lý hồ sơ shipper |
| `giao_hang.don_vi` | Quản lý đơn vị vận chuyển và bảng giá *(nhạy cảm)* |

Đáng chú ý nhất là việc **tách `cap_nhat` khỏi `phan_cong`**: shipper được bấm
"đã giao" cho đơn của mình, nhưng không được tự nhận thêm đơn hay gỡ đơn của
đồng nghiệp.

Migration cấp sẵn: `QLNH`/`TLQL` được tất cả; `DPGH` được tất cả trừ `don_vi`;
`SHIPPER` chỉ được `xem` + `cap_nhat`; `GSPV`/`TRUONGLT` được `xem` + `theo_doi`
(khách đứng ở sảnh hỏi *"đơn tôi tới đâu rồi"* thì họ trả lời được ngay mà không
động được vào việc điều phối); `NVLT`/`GSTN`/`NVTN` chỉ được `xem`.

---

## 9. Tham số vận hành

Sửa ở **Quản trị → Đơn vị vận chuyển**, khối *Tham số vận hành* (lưu vào bảng
`cau_hinh`).

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `giao_hang.bat` | `1` | Nhận đơn giao hàng trên website |
| `giao_hang.ban_kinh_km` | `5` | Bán kính tối đa, dùng để báo cho khách |
| `giao_hang.mien_phi_tu` | `500000` | Đơn từ mức này được miễn phí giao (0 = không miễn) |
| `giao_hang.nhip_gps_giay` | `15` | Bao lâu ứng dụng shipper gửi vị trí một lần |
| `giao_hang.giu_vet_ngay` | `7` | Giữ vết đường đi bao nhiêu ngày |
| `giao_hang.tu_dong_tao_don` | `1` | Tự tạo đơn giao khi khách đặt, hay để điều phối tạo tay |

**`nhip_gps_giay`** là đánh đổi giữa độ mượt của bản đồ và pin điện thoại
shipper. 15 giây là mức thấy được xe đi liền mạch mà không hao pin rõ rệt.

**`giu_vet_ngay`** giới hạn bảng vết. Đủ dài để đối chiếu khiếu nại, quá dài thì
bảng phình rất nhanh. Dọn vết cũ bằng:

```js
require('./services/vanChuyenService').donVetCu()
```

Chỉ động đến `vi_tri_shipper`; bảng vị trí hiện tại và nhật ký trạng thái đều
nhỏ và **là bằng chứng**, không được dọn.

---

## 10. Dữ liệu để thử — nhân sự và một ca vận hành thật

Hai script, cố ý tách khỏi migration: migration dựng schema và quyền (thứ mọi
bản cài đặt đều cần), còn nhân sự thì nhà hàng thật sẽ tự thêm người của họ —
migration tự sinh ra bốn nhân viên không có thật là rác trong CSDL thật.

### Tạo nhân sự

```bash
npm run giaohang:nhansu
```

Tạo một điều phối và ba shipper, **mỗi người hai thứ**: bản ghi `nhan_vien` kèm
tài khoản và chức danh (cho họ *quyền*), và bản ghi `shipper` (cho họ *hồ sơ* —
xe gì, biển số nào, thuộc đơn vị nào, cầm được mấy đơn). Thiếu thứ hai thì họ
đăng nhập được nhưng mở `/shipper` chỉ thấy trang "chưa có hồ sơ shipper" — chỗ
hay sót nhất khi làm tay qua giao diện.

| Tài khoản | Họ tên | Chức danh | Xe |
|---|---|---|---|
| `dieuphoi` | Ngô Thị Hạnh | DPGH | — |
| `shipper1` | Lê Văn Hùng | SHIPPER | 59X1-234.56 · tối đa 3 đơn |
| `shipper2` | Trần Minh Tú | SHIPPER | 59H2-887.10 · tối đa 3 đơn |
| `shipper3` | Phạm Quốc Đạt | SHIPPER | 59K1-045.72 · tối đa 2 đơn |

Mật khẩu đều là `123456`, đăng nhập tại `/staff/login`. Cả ba bắt đầu ở trạng
thái **ngoài ca** — ca trực là thứ shipper tự bật trong ứng dụng; tạo sẵn ở
`san_sang` thì màn hình điều phối nói dối rằng có người đang sẵn sàng nhận đơn
trong khi họ chưa mở máy.

### Chạy một ca vận hành thật

```bash
npm run giaohang:mophong
# hoặc:  node scripts/moPhongGiaoHang.js --don=5 --nhip=3 --phut=8
```

| Tham số | Mặc định | Nghĩa |
|---|---|---|
| `--don` | 3 | Số đơn đặt trong ca |
| `--nhip` | 4 | Giây giữa hai lần gửi GPS |
| `--phut` | 5 | Mỗi chuyến kéo dài bao lâu |

**Đây không phải script sinh dữ liệu.** Cách nhanh nhất để có dữ liệu trông đẹp
là `INSERT` thẳng vào `don_giao_hang` và `vi_tri_shipper`; script này cố ý không
làm thế. Mọi bước đều đi qua đúng con đường người thật đi:

```
khách đặt đơn   →  POST /login, /add-to-cart, /datban   (chọn Giao tận nơi)
điều phối phân  →  POST /staff/giao-hang/:id/phan
shipper bật ca  →  POST /api/shipper/ca
shipper chạy    →  POST /api/shipper/vi-tri              (mỗi vài giây)
shipper đổi tt  →  POST /api/shipper/don/:id/trang-thai
```

Nhờ vậy mọi thứ đều thật: cước phí do máy chủ tính lại từ tọa độ, trạng thái đi
qua bảng `CHUYEN_DUOC`, nhật ký ghi kèm tọa độ lúc bấm nút, và quan trọng nhất —
`realtime.viTriShipper()` **phát thật**, nên bản đồ điều phối và trang theo dõi
của khách động ngay trước mắt. `INSERT` thẳng thì bạn có dữ liệu đẹp trong CSDL
và một bản đồ đứng im.

Các chuyến chạy **song song**, vì đó mới giống giờ cao điểm thật — và đó mới là
thứ đáng kiểm tra: bản đồ có vẽ được nhiều chấm cùng lúc không, danh sách bên
phải có cập nhật kịp không.

> Đường đi được **nội suy thẳng** từ nhà hàng tới điểm giao, cộng một chút nhiễu.
> Vẽ đúng đường phố cần một dịch vụ chỉ đường ngoài (xem mục 5). Với mục đích
> xem hệ thống có chạy không thì đường thẳng là đủ: cái đang kiểm tra là **dòng
> dữ liệu**, không phải hình dạng tuyến đường.

Mở `/staff/giao-hang/ban-do` trong lúc script chạy để xem xe di chuyển.

---

## 11. Không vào được trang giao hàng?

Chạy lệnh này trước khi đoán — nó đọc thẳng CSDL và chỉ ra đúng bước còn thiếu:

```bash
npm run giaohang:check
```

Bốn nguyên nhân, mỗi cái cho ra một màn hình khác nhau:

| Bạn thấy gì | Nguyên nhân | Cách sửa |
|---|---|---|
| **404 Not Found** | Máy chủ chưa nạp mã nguồn mới | Tắt cửa sổ `node server.js` rồi chạy lại `npm start` |
| **Lỗi 500** | Chưa chạy migration 019 | `node config/migrations/019_van_chuyen.js` |
| **Bị đá về trang đăng nhập** | Vào nhầm khu | `/admin/van-chuyen` cần tài khoản **quản trị**; `/staff/giao-hang` cần tài khoản **nhân viên** |
| **403 "Chức danh của bạn không có quyền"** | Tài khoản nhân viên chưa được cấp `giao_hang.xem` | Bổ nhiệm chức danh `DPGH`/`SHIPPER` tại `/to-chuc/quan-ly`, hoặc dùng tài khoản quản trị |
| **Trang mở ra nhưng trống** | Chưa có đơn giao nào | Không phải lỗi. Đặt thử một đơn trên website và chọn *Giao tận nơi* |

Riêng `/shipper` còn một cửa nữa: nhân viên phải **có hồ sơ shipper** (`/admin/van-chuyen/shipper`), không chỉ có chức danh. Thiếu hồ sơ thì họ gặp một trang hướng dẫn chứ không phải mã 403 trống — xem mục 2.

---

## 12. Những chỗ dễ hiểu nhầm

**Bảng giá đổi không ảnh hưởng đơn cũ.** Phí giao được chốt vào cột
`don_giao_hang.phi_giao` lúc tạo đơn. Sửa bảng giá chỉ áp cho đơn mới.

**Xóa đơn vị vận chuyển không xóa được khi đã có đơn.** Hệ thống bắt chuyển sang
*Ngừng hoạt động* thay vì xóa — xóa đi thì các đơn cũ mất tên đơn vị đã giao
chúng, và báo cáo chi phí vận chuyển tháng trước rỗng.

**Xóa hồ sơ shipper không mất lịch sử.** Khóa ngoại là `ON DELETE SET NULL`, và
tên người giao đã được chép vào `nhat_ky_giao_hang` tại thời điểm thao tác nên
không cần join ngược.

**Điều phối gỡ được đơn ở trạng thái `da_phan` và `dang_lay`, nhưng không gỡ
được `dang_giao`** — shipper đã rời nhà hàng với hàng trong cốp. Trường hợp đó
phải báo *giao thất bại* rồi phân lại.

**`/api/shipper/vi-tri` cố ý không nằm trong bảng của `middleware/baoDoi.js`.**
Nó chạy bốn lần một phút cho mỗi shipper; cho vào đó thì cả hệ thống tự tải lại
trang mỗi 15 giây vì một chấm xe dịch 20 mét.

**Trang bản đồ cũng cố ý bị loại khỏi bảng đồng bộ ở
`views/staff/partials/footer.ejs`** (quy tắc `(?!\/ban-do)`). Tráo `innerHTML`
sẽ giết thể hiện Leaflet và để lại một ô xám.

**Service worker của `/shipper/` không lưu đệm gì cả.** Nó tồn tại **duy nhất**
để Chrome cho phép cài ứng dụng ra màn hình chính. Bản đồ cũ trong bộ nhớ đệm
còn nguy hiểm hơn bảng chấm công cũ: shipper sẽ chạy theo một địa chỉ đã bị đổi,
hoặc thấy một đơn đã bị gỡ khỏi mình từ mười phút trước.

**Đơn hàng chỉ chuyển sang `dang_lay` khi bếp đã xong thì mới hợp lý.** Hệ thống
không cưỡng chế điều này, nhưng cả bảng điều phối lẫn ứng dụng shipper đều hiện
rõ *"bếp đang nấu"* / *"bếp xong"* — xe chờ trước cửa bếp 20 phút là một chuyến
bị lãng phí.
