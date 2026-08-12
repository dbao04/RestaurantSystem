# Hệ thống quản lý nhà hàng thông minh

Tài liệu này giải thích **cách dự án hoạt động**: kiến trúc, luồng dữ liệu, cách
các thành phần gọi nhau và vì sao lại chia như vậy. Các tài liệu khác đi sâu vào
từng phần:

| Tài liệu | Nội dung |
|---|---|
| `README.md` (file này) | Kiến trúc tổng thể, luồng hoạt động |
| `HUONG_DAN_AI_ML.md` | Chi tiết tầng phân tích, Machine Learning, Apriori |
| `HUONG_DAN_CAI_DAT.md` | Cài đặt lần đầu |
| `HUONG_DAN_CO_CAU_TO_CHUC.md` | Chức danh, phân quyền, thời gian thực |
| `HUONG_DAN_CHAM_CONG_KHUON_MAT.md` | Chấm công bằng khuôn mặt |
| `HUONG_DAN_CHATBOT.md` | Chatbot hỏi đáp tiếng Việt (phân loại ý định tự huấn luyện) |
| `HUONG_DAN_QUET_QR_TU_XA.md` | Cho khách quét mã QR bằng 4G hoặc từ mạng khác |
| `HUONG_DAN_XEP_CA.md` | Xếp ca tự động: định mức nhân sự, thuật toán, vận hành |
| `DANH_SACH_TAI_KHOAN.md` | Danh sách tài khoản đăng nhập |

---

## 1. Tổng quan kiến trúc

Hệ thống chạy bằng **hai tiến trình độc lập** dùng chung **một cơ sở dữ liệu MySQL**:

```
                    ┌──────────────────────────────────────────┐
   Trình duyệt      │  Tiến trình 1 — Web (Node.js + Express)  │
   (khách / NV /    │  cổng 3000                               │
    quản trị)  ───▶ │                                          │
        ▲           │  server.js ──▶ routes/ ──▶ services/     │
        │           │       │                       │          │
        │ Socket.IO │       └──▶ views/*.ejs (HTML) │          │
        └───────────┤                               │          │
                    └───────────────────────────────┼──────────┘
                                        HTTP/JSON   │      │ mysql2
                                    (services/mlService.js)│
                                                    ▼      │
                    ┌──────────────────────────────────┐   │
                    │ Tiến trình 2 — ML (Python)       │   │
                    │ FastAPI + uvicorn, cổng 8000     │   │
                    │ ml_service/main.py               │   │
                    │   forecast.py · apriori.py       │   │
                    └────────────────┬─────────────────┘   │
                                     │ SQLAlchemy/PyMySQL  │
                                     ▼                     ▼
                    ┌──────────────────────────────────────────┐
                    │        MySQL — CSDL `gs_restaurant`      │
                    └──────────────────────────────────────────┘
```

**Vì sao tách hai tiến trình?**

1. Hệ sinh thái học máy (scikit-learn, XGBoost, pandas) chỉ có trên Python.
2. Huấn luyện mô hình tốn CPU hàng chục giây. Nếu chạy chung với web server thì
   mỗi lần huấn luyện lại sẽ làm nghẽn toàn bộ trang web.

**Hai tiến trình dùng chung file `.env`** nên thông tin kết nối CSDL chỉ khai báo
một nơi (`config/db.js` phía Node đọc bằng `dotenv`, `ml_service/db.py` phía
Python đọc bằng `python-dotenv` từ đúng file đó).

### Nguyên tắc quan trọng: ML service không được làm sập web

`services/mlService.js` bọc mọi lời gọi sang cổng 8000. Nếu Python chưa bật,
timeout hay lỗi, hàm gọi **không ném lỗi ra ngoài** mà trả về dữ liệu dự phòng
đọc từ CSDL (kết quả dự báo đã lưu lần trước, hoặc món bán chạy). Web vẫn chạy
bình thường khi quên bật service Python — chỉ nút "Chạy lại dự báo" là không dùng
được.

---

## 2. Khởi động hệ thống

Cách nhanh nhất: nhấp đúp **`start_all.bat`** — tự kiểm tra MySQL, bật ML service
rồi bật web server.

Thủ công thì cần ba thứ theo thứ tự:

```bat
:: 0. MySQL (XAMPP) phải chạy trước
:: 1. ML service — cổng 8000
python -m uvicorn ml_service.main:app --host 127.0.0.1 --port 8000

:: 2. Web server — cổng 3000
node server.js
```

Huấn luyện lại mô hình ngoài web (in bảng chỉ số để viết báo cáo):

```bat
train_ml.bat          :: tương đương: python -m ml_service.train
```

### Các địa chỉ chính

| Đường dẫn | Dành cho |
|---|---|
| `http://localhost:3000` | Khách hàng |
| `/admin/login` | Quản trị |
| `/staff/login` | Nhân viên |
| `/analytics` | Dashboard phân tích |
| `/du-bao` | Dự báo AI/ML |
| `/admin/chatbot` | Quản trị trợ lý ảo (chỉ số mô hình, câu bot chưa hiểu) |
| `/kds` | Màn hình bếp |
| `/so-do-ban` | Sơ đồ bàn |
| `/qr/table/:id` | Menu QR đặt tại bàn (không cần đăng nhập) |
| `http://127.0.0.1:8000/docs` | Tài liệu API ML tự sinh |

---

## 3. Tiến trình web hoạt động thế nào

### 3.1. Một request đi qua những gì

```
Request
  │
  ├─▶ body-parser            (đọc form / JSON)
  ├─▶ express.static         (css, js, images, fonts, /food, /admin…)
  ├─▶ express-session        (cookie phiên, lưu trong bộ nhớ)
  ├─▶ middleware chung       server.js:88
  │      • dựng res.locals.session — object phẳng an toàn cho EJS
  │      • nạp helper formatMoney / formatDate / formatTime
  │      • tính lại tổng giỏ hàng theo sessionID
  ├─▶ middleware phân quyền  requireLogin / requireAdmin / requireStaff / requireRole
  ├─▶ handler trong server.js hoặc routes/*.js
  │      └─▶ services/*.js   (toàn bộ truy vấn SQL nằm ở đây)
  │             └─▶ config/db.js  (pool mysql2, tối đa 10 kết nối)
  └─▶ res.render('…ejs')  hoặc  res.json(…)
```

Ba tầng rõ ràng: **route** nhận request và kiểm tra quyền → **service** chứa
nghiệp vụ và SQL → **view (EJS)** chỉ hiển thị. Không viết SQL trong view.

### 3.2. Phiên và phân quyền

Hệ thống có **ba loại phiên đăng nhập song song**, phân biệt bằng ba cờ khác nhau
trong cùng một session:

| Cờ session | Đối tượng | Middleware bảo vệ |
|---|---|---|
| `userlogin` | Khách hàng | `requireLogin` |
| `adminlogin` | Quản trị | `requireAdmin` |
| `stafflogin` + `staffRole` | Nhân viên | `requireStaff`, `requireRole([...])` |

`requireRole(['Bep'])` chặn theo **vai trò nhân viên**, trả 403 nếu sai vai. Năm
vai trò đang dùng: `Bep` (bếp), `Phuc vu`, `Thu ngan`, `Quay`, `Ke toan`.

Ví dụ đọc từ `server.js`:

```js
app.post('/staff/kitchen/mark-done/:id', requireRole(['Bep']), …)   // chỉ bếp
app.get('/staff/bookings',  requireRole(['Phuc vu','Ke toan','Quay','Thu ngan']), …)
```

### 3.3. Realtime bằng Socket.IO

`server.js` bọc Express bằng `http.createServer` rồi gắn Socket.IO lên cùng cổng
3000. Client gửi `join-room` khi vào trang, server chia thành các **phòng**:

| Phòng | Ai vào | Nhận sự kiện |
|---|---|---|
| `kitchen_room` | Nhân viên vai `Bep` | `new-order-to-kitchen` |
| `staff_room` | `Phuc vu`, `Ke toan` | `dish-ready` |
| `room_<userId>` | Từng khách hàng | `new-message` (chat) |

Nhờ chia phòng, món mới chỉ bắn xuống màn hình bếp, chuông "món xong" chỉ kêu ở
máy phục vụ, tin nhắn chỉ đến đúng khách.

---

## 4. Luồng nghiệp vụ chính

### 4.1. Vòng đời một đơn hàng

Tất cả món trong cùng một lần đặt dùng chung mã phiên **`sesis`**; bảng `hopdong`
lưu **mỗi món một dòng**. Cột `tinhtrang` là trạng thái của cả đơn:

```
 0  Chờ xác nhận ──▶ 1  Đã xác nhận ──▶ 5  Khách đã đến ──▶ 6  Đang dùng món ──▶ 3  Đã thanh toán
        │
        └──────────────────────────────▶ 2  Đã hủy
```

Song song đó, mỗi **dòng món** có trạng thái bếp riêng (`trangthai_bep`), đây
chính là thứ màn hình KDS điều khiển:

```
 0 Chờ chế biến ──▶ 1 Đang chế biến ──▶ 2 Hoàn thành ──▶ 3 Đã phục vụ
```

Khi món cuối cùng của đơn được đánh dấu xong, `orderService` tự đẩy đơn từ trạng
thái 5 sang 6.

### 4.2. Ba đường vào của một đơn

```
(a) Khách đặt online   /menu → /add-to-cart → /cart → /datban  (cần đăng nhập)
(b) Nhân viên tạo hộ   /staff/bookings/create
(c) Khách quét QR bàn  /qr/table/:tableId → /qr/add-dish       (không cần đăng nhập)
```

Cả (b) và (c) đều bắn `io.to('kitchen_room').emit('new-order-to-kitchen')` nên
món hiện lên màn hình bếp ngay lập tức, không cần F5.

### 4.3. Kho và nguyên liệu

```
Nhập hàng          phieu_nhap → chi_tiet_phieu_nhap (theo lô, có hạn sử dụng)
   │
Bán món            cong_thuc (định lượng mỗi món) ──▶ xuat_kho (nhật ký tiêu hao)
   │
Tồn kho FIFO       chi_tiet_phieu_nhap.so_luong_con_lai
   │
Dự báo nguyên liệu ml_service/forecast.py đọc xuat_kho để tính "cần nhập thêm"
```

Chuỗi này là lý do phần dự báo nguyên liệu có dữ liệu để học: mỗi món bán ra đều
để lại dấu vết tiêu hao trong `xuat_kho`.

### 4.4. Nhân sự

Chấm công (`cham_cong`) → lịch làm việc (`lich_lam_viec`) → nghỉ phép
(`nghi_phep`) → bảng lương (`luong`, kế toán lập rồi quản trị duyệt tại
`/admin/salary-approval`).

---

## 5. Tiến trình ML hoạt động thế nào

`ml_service/` là một package Python độc lập, chạy được cả qua HTTP lẫn dòng lệnh.

```
main.py        FastAPI — 7 endpoint, chỉ làm nhiệm vụ nhận/trả JSON
  ├─ db.py         engine SQLAlchemy dùng chung, đọc .env ở gốc dự án
  ├─ features.py   sinh đặc trưng: lịch, ngày lễ/Tết, lag t-1/t-7/t-14, trượt 7/28, xu hướng
  ├─ models.py     huấn luyện + đánh giá (Ridge, RandomForest, GradientBoosting, XGBoost)
  ├─ forecast.py   Bài toán 1 (lượt khách) và Bài toán 2 (nguyên liệu)
  ├─ apriori.py    Bài toán 3 — luật kết hợp, tự cài đặt từ đầu
  ├─ train.py      chạy cả ba bài toán từ dòng lệnh, in bảng chỉ số
  ├─ khuon_mat.py  nhận diện khuôn mặt (xem mục 7 — chưa nối vào hệ thống)
  └─ chatbot/      chatbot hỏi đáp: 5 tầng, mô hình tự huấn luyện
       y_dinh.py       44 ý định + trình sinh dữ liệu huấn luyện
       phan_loai.py    so sánh 5 mô hình phân loại ý định
       thuc_the.py     thời gian tiếng Việt + từ điển sinh động từ CSDL
       truy_van.py     mẫu SQL có tham số (không sinh SQL tự do)
       tra_loi.py      sinh câu trả lời tiếng Việt
```

### Cách một lần dự báo diễn ra

```
Người dùng bấm "Chạy lại dự báo" trên /du-bao
   │
   ▼  POST /du-bao/api/chay-du-bao-khach          (routes/forecast.js)
services/mlService.js  ──HTTP──▶  POST http://127.0.0.1:8000/du-bao/luot-khach
                                     │
                                     ├─ đọc lịch sử đơn từ bảng hopdong
                                     ├─ features.py dựng bảng đặc trưng
                                     ├─ models.py huấn luyện 4 mô hình + baseline
                                     │     chia train/test THEO MỐC THỜI GIAN,
                                     │     không dùng train_test_split ngẫu nhiên
                                     ├─ chọn mô hình có MAE thấp nhất
                                     ├─ dự báo đệ quy nhiều bước (t+1 làm lag cho t+2…)
                                     └─ GHI kết quả xuống bảng du_bao_luot_khach
                                        và chỉ số xuống danh_gia_mo_hinh
   │
   ▼
Trang /du-bao đọc lại từ CSDL để vẽ biểu đồ
```

Điểm mấu chốt: **kết quả luôn được ghi xuống CSDL**. Nhờ vậy trang vẫn xem được
khi ML service tắt, và số liệu đánh giá luôn tái lập được khi viết báo cáo.

### Gợi ý món (Apriori)

`apriori.py` đọc lịch sử giỏ hàng từ `hopdong`, tính support / confidence / lift,
sinh luật rồi lưu vào bảng `luat_ket_hop`.

Khi khách chọn món, khối gợi ý (`views/partials/goi-y-mon.ejs`) gọi
`POST /goi-y/api/mon`. Route này thử ML service trước (timeout 8 giây); nếu không
gọi được thì `mlService.goiYTuDb` đọc thẳng bảng `luat_ket_hop` bằng SQL thuần —
áp dụng luật khi **toàn bộ** vế trái đã có trong giỏ, xếp hạng theo lift. Giỏ
trống thì trả về món bán chạy. Vì vậy gợi ý luôn hiển thị được kể cả khi Python
đang tắt.

Thuật toán tự cài đặt thay vì gọi thư viện để giải thích được từng bước khi bảo vệ.

Chi tiết phương pháp luận, công thức và kết quả thực nghiệm: xem `HUONG_DAN_AI_ML.md`.

---

## 6. Dữ liệu

 ,### Migration

Schema gốc nằm ở `gs_restaurant.sql`. Các thay đổi về sau viết thành script chạy
lần lượt trong `config/migrations/`:

| Script | Việc làm |
|---|---|
| `001_chuan_hoa_schema.js` | Thêm `ngay_dat`/`gio_dat` chuẩn kiểu DATE/TIME, không xóa cột cũ |
| `002_master_data.js` | Đơn vị tính, danh mục nguyên liệu, công thức, nhà cung cấp, c
ombo |
| `003_sinh_du_lieu_lich_su.js` | Sinh ~12 tháng dữ liệu mô phỏng theo quy luật ngành F&B |
| `004_hieu_suat.js` | Gắn đơn cho nhân viên, mốc thời gian chế biến |
| `005_ton_lo_hang.js` | Mô phỏng tồn kho theo lô FIFO |
| `006_trang_thai_van_hanh.js` | Tạo lát cắt vận hành hôm nay để demo KDS + sơ đồ bàn |
| `007_cham_cong_khuon_mat.js` | Bảng `khuon_mat_nv`, `nhat_ky_nhan_dien` |
| `008_co_cau_to_chuc.js` | Bộ phận, chức danh, tổ làm việc, phân quyền, ủy quyền |
| `009_tao_tai_khoan.js` | Bộ tài khoản chuẩn cho admin và từng chức danh |
| `010_anh_do_uong.js` | Gán ảnh cho các món đồ uống |
| `011_mo_rong_so_do_ban.js` | Nâng nhà hàng lên **40 bàn / 4 khu**, đổi tên bàn sang mã thống nhất, đồng bộ mã QR |

Hai nguyên tắc xuyên suốt:

- **Không xóa cột cũ.** `server.js` dài hơn 2600 dòng đang đọc các cột cũ; ta thêm
  cột chuẩn rồi backfill, code mới dùng cột mới.
- **Chạy lại được nhiều lần** (idempotent): mỗi bước đều kiểm tra tồn tại trước.

### Vì sao có dữ liệu mô phỏng

CSDL thật chỉ có 16 đơn hàng. Apriori và mô hình chuỗi thời gian không học được gì
từ 16 quan sát. Migration 003 sinh dữ liệu theo các quy luật có thật (hiệu ứng
cuối tuần, mùa vụ, ngày lễ/Tết, khung giờ cao điểm, nhóm món đi kèm) để mô hình có
cái để học **và** để có "ground truth" đối chiếu khi đánh giá. Cột
`hopdong.la_du_lieu_mo_phong` đánh dấu rạch ròi đâu là dữ liệu sinh.

### Nhóm bảng chính

| Nhóm | Bảng |
|---|---|
| Thực đơn | `monan`, `loai_mon`, `combos`, `cong_thuc` |
| Đơn hàng | `hopdong` (mỗi món một dòng, gộp theo `sesis`), `cart`, `ban`, `qr_tables` |
| Khách hàng | `khach_hang`, `danh_gia`, `chat`, `loyalty_transactions` |
| Nhân sự | `nhan_vien`, `vitri`, `cham_cong`, `lich_lam_viec`, `nghi_phep`, `luong` |
| Kho | `nguyen_lieu`, `nha_cung_cap`, `phieu_nhap`, `chi_tiet_phieu_nhap`, `xuat_kho` |
| AI/ML | `du_bao_luot_khach`, `du_bao_nguyen_lieu`, `danh_gia_mo_hinh`, `luat_ket_hop` |
| Sinh trắc học | `khuon_mat_nv`, `nhat_ky_nhan_dien` |
| Hệ thống | `cau_hinh`, `audit_logs`, `thong_bao`, `email_history` |

Bảng `cau_hinh` là nơi chỉnh tham số mà **không cần sửa code**: URL của ML
service, ngưỡng support/confidence của Apriori, tọa độ nhà hàng, ngưỡng nhận diện
khuôn mặt.

---

## 7. Trạng thái hiện tại — phần chưa nối vào hệ thống

Nêu rõ để không bị hỏi bất ngờ:

- **Chấm công bằng khuôn mặt.** `ml_service/khuon_mat.py` (~1000 dòng) đã hoàn
  chỉnh về mặt thuật toán: phát hiện bằng YuNet, trích vector 128 chiều bằng
  SFace, so khớp cosine, có kiểm tra chống giả mạo ảnh in/màn hình. Migration 007
  đã tạo bảng. **Nhưng** `main.py` chưa khai báo endpoint cho module này và phía
  Node chưa có giao diện gọi tới — nên tính năng chưa dùng được từ trình duyệt.
  Ngoài ra `ml_service/requirements.txt` chưa liệt kê `opencv-python`, cần cài
  thêm trước khi chạy. Hai tệp mô hình ONNX tải bằng
  `python -m ml_service.tai_mo_hinh`.
- **Ba router chưa được mount** trong `server.js`: `routes/loyalty.js`,
  `routes/adminLoyalty.js`, `routes/generalStaff.js`. Code đã viết xong, chỉ thiếu
  dòng `app.use(...)`. Hiện chỉ `analytics`, `forecast`, `kds` được nạp
  (`server.js:154-157`).
- **Chấm công GPS**: bảng và tham số đã có trong `cau_hinh`, chưa có luồng xử lý.
- **Chưa làm**: theo dõi shipper trên bản đồ, OCR hóa đơn, phân tích cảm xúc đánh
  giá.

**Chatbot** đã hoàn chỉnh và nối vào hệ thống — xem `HUONG_DAN_CHATBOT.md`. Cần
chạy `node config\migrations\016_chatbot.js` rồi `train_chatbot.bat` một lần
trước khi dùng.

---

## 8. Bản đồ thư mục

```
server.js                 Điểm vào web: session, phân quyền, route, Socket.IO
config/
  db.js                   Pool mysql2, ép UTF-8 cho mọi cột chuỗi
  migrate.js              Bộ chạy migration
  migrations/             001 → 011, chạy lại được nhiều lần
routes/                   Các phân hệ mới tách riêng khỏi server.js
  analytics.js            Dashboard: 13 endpoint JSON cho biểu đồ
  forecast.js             Trang /du-bao và các nút chạy lại dự báo
  kds.js                  Màn hình bếp + sơ đồ bàn (nhận `io` để bắn realtime)
  toChuc.js               Sơ đồ tổ chức, bảng điều hành, phân quyền, ủy quyền
  khuonMat.js             Chấm công bằng khuôn mặt (kiosk / cá nhân / quản lý)
  chatbot.js              Trợ lý ảo: API công khai + trang quản trị
services/                 Toàn bộ nghiệp vụ và SQL
  mlService.js            Cầu nối sang Python, luôn có dữ liệu dự phòng
  chatbotService.js       Cầu nối chatbot, có bộ trả lời dự phòng khi Python tắt
  phanQuyenService.js     Quyền hiệu lực theo chức danh + ủy quyền + cấp riêng
  toChucService.js        Bổ nhiệm, chức danh, tổ, việc cần xử lý
  realtime.js             Trung tâm Socket.IO: phòng theo cơ cấu tổ chức
  faceService.js          Ghi chấm công + nhật ký nhận diện khuôn mặt
middleware/
  auth.js                 Phân quyền theo khách / quản trị / nhân viên (bản cũ)
  phanQuyen.js            Phân quyền RBAC mới (canQuyen/canCapBac/canVaiTroCu)
  errorHandler.js         asyncHandler + xử lý lỗi tập trung
views/                    EJS — gốc là trang khách, admin/ và staff/ là hai khu riêng
utils/                    format tiền/ngày, gửi mail, kiểm tra dữ liệu vào
ml_service/               Package Python (xem mục 5)
css/ js/ scss/ fonts/ images/ food/    Tài nguyên tĩnh
start_all.bat             Bật cả hệ thống
train_ml.bat              Huấn luyện lại và in bảng chỉ số
```

Các tài liệu chuyên đề: `HUONG_DAN_CO_CAU_TO_CHUC.md` (phân quyền, realtime),
`HUONG_DAN_CHAM_CONG_KHUON_MAT.md` (nhận diện khuôn mặt),
`DANH_SACH_TAI_KHOAN.md` (tài khoản đăng nhập).

---

## 9. Cấu hình

Tất cả nằm trong `.env` ở thư mục gốc, **dùng chung cho cả Node và Python**:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=gs_restaurant

PORT=3000
NODE_ENV=development
SESSION_SECRET=…

EMAIL_USER=        # tùy chọn — quên mật khẩu, gửi thông báo
EMAIL_PASS=
```

Các tham số nghiệp vụ (URL ML service, ngưỡng Apriori, ngưỡng nhận diện) không
để trong `.env` mà nằm ở bảng `cau_hinh` để sửa được lúc đang chạy.

---

## 10. Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| Web server | Node.js, Express 5, EJS, express-session, multer, socket.io |
| CSDL | MySQL 8 (XAMPP), truy cập qua mysql2/promise |
| Tiện ích | nodemailer (email), qrcode (QR bàn), xlsx (xuất Excel), md5 |
| Giao diện | Bootstrap, jQuery, Chart.js |
| ML service | Python, FastAPI, uvicorn, pandas, NumPy |
| Học máy | scikit-learn (Ridge, RandomForest, GradientBoosting), XGBoost |
| Khai phá dữ liệu | Apriori tự cài đặt |
| Thị giác máy tính | OpenCV DNN — YuNet + SFace (ONNX) |
