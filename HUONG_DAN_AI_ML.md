# Hệ thống quản lý nhà hàng thông minh — Phần AI / Machine Learning

Tài liệu này mô tả các phân hệ mới được bổ sung vào hệ thống, tương ứng với
Tầng 2 (phân tích dữ liệu), Tầng 3 (Machine Learning) và Tầng 4 (AI gợi ý).

---

## 1. Khởi động hệ thống

Cách nhanh nhất: nhấp đúp file **`start_all.bat`**. File này tự kiểm tra MySQL,
bật ML service và web server.

Nếu muốn chạy thủ công, cần **hai tiến trình**:

```bat
:: Cửa sổ 1 — Web server (Node.js, cổng 3000)
node server.js

:: Cửa sổ 2 — ML service (Python/FastAPI, cổng 8000)
python -m uvicorn ml_service.main:app --host 127.0.0.1 --port 8000
```

MySQL (XAMPP) phải chạy trước cả hai.

> Web vẫn hoạt động bình thường khi ML service tắt: các trang sẽ đọc kết quả dự
> báo đã lưu trong CSDL thay vì huấn luyện lại. Chỉ nút "Chạy lại dự báo" là
> không dùng được.

### Địa chỉ các trang

| Trang | Đường dẫn | Quyền truy cập |
|---|---|---|
| Trang khách hàng | `/` | Công khai |
| Dashboard phân tích | `/analytics` | Admin, Quản lý, Kế toán |
| Dự báo AI / ML | `/du-bao` | Admin, Quản lý, Kế toán |
| Màn hình bếp (KDS) | `/kds` | Mọi nhân viên (chỉ Bếp mới thao tác) |
| Sơ đồ bàn | `/so-do-ban` | Mọi nhân viên (chỉ Quản lý mới kéo thả) |
| Tài liệu API của ML service | `http://127.0.0.1:8000/docs` | — |

### Tài khoản đăng nhập

| Vai trò | Cổng đăng nhập | Tài khoản | Mật khẩu |
|---|---|---|---|
| Admin | `/admin/login` | `admin` | `123456` |
| Bếp | `/staff/login` | `bep` | `123456` |
| Thu ngân | `/staff/login` | `thungan` | `123456` |
| Phục vụ | `/staff/login` | `phucvu` | `123456` |
| Kế toán | `/staff/login` | `ketoan` | `123` |
| Khách hàng | `/login` | `0918484042` | `123456` |

Các tài khoản `nv001`–`nv004`, `bb` bị khóa (`trangthai = 0`) nên không đăng nhập được.

---

## 2. Huấn luyện lại mô hình

```bat
train_ml.bat
:: hoặc
python -m ml_service.train
```

Script in ra bảng so sánh MAE / RMSE / MAPE / R² của tất cả mô hình — dùng trực
tiếp cho phần thực nghiệm trong báo cáo. Kết quả đồng thời được ghi vào bảng
`danh_gia_mo_hinh` để hiển thị trên trang `/du-bao`.

---

## 3. Dữ liệu

### Vấn đề ban đầu

CSDL gốc chỉ có **16 đơn hàng**, cột `dates` lưu kiểu `TEXT` với ba định dạng
lẫn lộn (`7/9/2026`, `2026-05-30`, chuỗi rỗng), và chỉ có 3 dòng công thức cho
25 món. Không đủ để huấn luyện bất kỳ mô hình nào.

### Cách xử lý

Các migration trong `config/migrations/` chạy theo thứ tự:

| File | Nội dung |
|---|---|
| `001_chuan_hoa_schema.js` | Thêm `ngay_dat` (DATE) + `gio_dat` (TIME) chuẩn, backfill từ cột TEXT cũ; thêm trạng thái/tọa độ bàn; gộp nguyên liệu trùng tên; tạo 9 bảng mới |
| `002_master_data.js` | 45 nguyên liệu, 6 đồ uống, **107 dòng công thức cho 31 món**, 5 nhà cung cấp, 4 combo |
| `003_sinh_du_lieu_lich_su.js` | Sinh **17.932 đơn / 80.557 dòng món** trong 368 ngày |
| `004_hieu_suat.js` | Gán nhân viên phục vụ, sinh mốc thời gian chế biến |
| `005_ton_lo_hang.js` | Mô phỏng tồn kho theo lô (FIFO) và hạn sử dụng |
| `006_trang_thai_van_hanh.js` | Tạo lát cắt vận hành hôm nay cho KDS và sơ đồ bàn (số bàn bận tính theo tỷ lệ trên tổng số bàn, trải đều 4 khu) |
| `011_mo_rong_so_do_ban.js` | Nâng lên 40 bàn / 4 khu, đổi tên bàn sang mã thống nhất, đồng bộ mã QR |

Chạy lại toàn bộ:

```bat
node config\migrations\001_chuan_hoa_schema.js
node config\migrations\002_master_data.js
node config\migrations\003_sinh_du_lieu_lich_su.js
node config\migrations\004_hieu_suat.js
node config\migrations\005_ton_lo_hang.js
node config\migrations\011_mo_rong_so_do_ban.js
node config\migrations\006_trang_thai_van_hanh.js
```

`011` phải chạy **trước** `006`, vì `006` dựng lát cắt vận hành trên danh sách bàn
hiện có. Thêm cờ `--xep-lai` cho `011` nếu muốn vứt bỏ cách sắp xếp sơ đồ mà quản
lý đã kéo thả và trả 40 bàn về lưới mặc định.

Bản sao lưu CSDL trước khi thay đổi nằm ở `backup/gs_restaurant_before_ai.sql`.

### Cách sinh dữ liệu mô phỏng

**Điểm phải nêu rõ trong báo cáo:** dữ liệu lịch sử là dữ liệu **mô phỏng**, không
phải dữ liệu kinh doanh thật. Bộ sinh cài đặt các quy luật có thật của ngành F&B:

- **Hiệu ứng thứ trong tuần** — cuối tuần đông gấp khoảng 2 lần ngày thường
- **Mùa vụ theo tháng** — tháng 12 và tháng hè cao điểm
- **Ngày lễ / Tết** — Giáng sinh, Valentine, 30/4, Quốc khánh…; riêng mùng 1–2 Tết
  quán gần như đóng cửa
- **Khung giờ cao điểm** — hai đỉnh: trưa 11–13h và tối 18–21h
- **Kịch bản bữa ăn** — 7 nhóm khách (gia đình, nhậu, trưa văn phòng, cặp đôi,
  mang về, giao hàng, ăn chay), mỗi nhóm có tổ hợp món đặc trưng

Bộ sinh dùng PRNG có seed cố định (`SEED = 20260804`) nên **chạy lại cho ra đúng
bộ dữ liệu cũ** — số liệu trong luận văn tái lập được.

Đơn mô phỏng có cờ `la_du_lieu_mo_phong = 1`, xóa sạch bất cứ lúc nào mà không
ảnh hưởng 16 đơn thật:

```sql
DELETE FROM hopdong WHERE la_du_lieu_mo_phong = 1;
```

---

## 4. Tầng 2 — Dashboard phân tích (`/analytics`)

Nguồn: `services/analyticsService.js`, `routes/analytics.js`.

- Doanh thu theo ngày / khung giờ / thứ trong tuần / tháng
- Cơ cấu theo danh mục món và hình thức phục vụ
- Top 15 món bán chạy kèm lợi nhuận gộp từng món
- **Phân tích Pareto** — bao nhiêu % số món tạo ra 80% doanh thu
- Hiệu suất nhân viên phục vụ (số đơn, doanh thu)
- Hiệu suất bếp (thời gian chế biến TB, món chậm nhất / nhanh nhất)
- Tồn kho kèm **số ngày sử dụng còn lại** = tồn ÷ tiêu hao TB 30 ngày
- Cảnh báo lô hàng sắp hết hạn

Giá von món ăn được suy ra từ `cong_thuc × nguyen_lieu.gia_von`, nhờ đó tính
được lợi nhuận gộp — thứ mà phần mềm quản lý thông thường không có.

---

## 5. Tầng 3 — Machine Learning (`/du-bao`)

Mã nguồn trong `ml_service/`:

| File | Vai trò |
|---|---|
| `db.py` | Kết nối CSDL (dùng chung `.env` với Node) |
| `features.py` | Xây dựng đặc trưng |
| `models.py` | Huấn luyện, đánh giá, so sánh mô hình |
| `forecast.py` | Hai bài toán dự báo |
| `apriori.py` | Khai phá luật kết hợp |
| `main.py` | REST API (FastAPI) |
| `train.py` | Chạy huấn luyện từ dòng lệnh |

### Đặc trưng đầu vào

1. **Lịch** — thứ, tháng, ngày trong tháng, tuần trong năm, cuối tuần
2. **Ngày lễ** — cờ ngày lễ, khoảng cách tới Tết
3. **Trễ (lag)** — giá trị t-1, t-7, t-14
4. **Trượt** — trung bình / độ lệch chuẩn 7 và 28 ngày, trung bình cùng thứ 4 tuần gần nhất
5. **Xu hướng** — chỉ số ngày tăng dần

Đặc trưng chu kỳ được mã hóa bằng `sin`/`cos` để mô hình hiểu Thứ 7 và Chủ nhật
là kề nhau.

### Ba nguyên tắc phương pháp luận

Đây là phần hội đồng thường hỏi nhất:

1. **Không dùng `train_test_split` ngẫu nhiên.** Đây là chuỗi thời gian; chia
   ngẫu nhiên khiến mô hình "nhìn thấy tương lai" và cho chỉ số đẹp giả tạo. Hệ
   thống chia theo mốc thời gian: 294 ngày đầu huấn luyện, 60 ngày cuối kiểm thử.

2. **Luôn so sánh với mô hình nền `SeasonalNaive`** (lấy giá trị cùng thứ tuần
   trước). Nếu học máy không thắng được baseline này thì nó không có giá trị thực tế.

3. **Tránh rò rỉ dữ liệu.** Các đặc trưng trượt đều `shift(1)` trước khi tính,
   không dùng giá trị của chính ngày đang dự báo.

### Kết quả thực nghiệm

**Bài toán 1 — Dự báo lượt khách** (294 ngày train / 60 ngày test):

| Mô hình | MAE | RMSE | MAPE | R² |
|---|---|---|---|---|
| **RandomForest** | **19.55** | **24.19** | **10.97%** | **0.7698** |
| XGBoost | 20.56 | 26.18 | 11.47% | 0.7304 |
| GradientBoosting | 21.34 | 26.41 | 11.63% | 0.7257 |
| Ridge | 21.97 | 27.28 | 12.38% | 0.7073 |
| SeasonalNaive (nền) | 31.02 | 37.77 | 18.70% | 0.4390 |

RandomForest **giảm 37% sai số** so với mô hình nền. Đây là con số trả lời trực
tiếp câu hỏi *"bỏ AI đi thì hệ thống khác gì phần mềm bán hàng?"*

**Bài toán 2 — Dự báo nhu cầu nguyên liệu**: 42 nguyên liệu, mỗi loại một mô hình
riêng, MAPE trung bình ~31%. Sai số cao hơn bài toán 1 là hợp lý vì chuỗi tiêu
hao từng nguyên liệu nhiễu hơn nhiều so với tổng lượng khách. Nguyên liệu có
chuỗi quá ngắn tự động chuyển sang trung bình trượt 28 ngày thay vì ép học máy
trên quá ít quan sát.

Dự báo nhiều bước dùng phương pháp **đệ quy**: dự báo t+1 rồi đưa kết quả vào làm
lag để dự báo t+2. Ưu điểm là giữ được tính nhất quán của đặc trưng trễ; hạn chế
là sai số tích lũy theo tầm dự báo — cần nêu rõ trong phần đánh giá.

---

## 6. Tầng 4 — AI gợi ý món (Apriori)

`ml_service/apriori.py` — **tự cài đặt thuật toán**, không dùng thư viện
(`mlxtend`), để giải thích được từng bước khi bảo vệ.

### Ba độ đo

- **Support(X)** = số hóa đơn chứa X / tổng số hóa đơn → mức độ phổ biến
- **Confidence(X→Y)** = support(X ∪ Y) / support(X) → xác suất gọi Y khi đã gọi X
- **Lift(X→Y)** = confidence(X→Y) / support(Y) → **quan trọng nhất**

Vì sao lift quan trọng nhất: một món ai cũng gọi (nước suối) sẽ có confidence cao
với mọi thứ nhưng lift ≈ 1, tức là **không mang thông tin gợi ý**. Lift > 1 mới
nghĩa là gọi X thực sự làm tăng khả năng gọi Y.

Thuật toán áp dụng **tính chất Apriori** để cắt tỉa: mọi tập con của một tập
thường xuyên cũng phải thường xuyên — nhờ vậy loại bớt ứng viên trước khi quét
lại dữ liệu.

### Kết quả

Khai phá từ **16.537 hóa đơn** (giỏ trung bình 4.64 món), tham số
`min_support = 0.02`, `min_confidence = 0.25`, `min_lift = 1.05`:
**310 tập thường xuyên → 227 luật**.

Một số luật mạnh nhất:

| Nếu khách gọi | Gợi ý thêm | Tin cậy | Lift |
|---|---|---|---|
| Gà gỏi + Bia Tiger | Heo lên mẹt | 53.9% | 5.13 |
| Heo lên mẹt + Gà nướng | Bia Tiger | 95.4% | 4.93 |
| Heo lên mẹt | Bia Tiger | 94.4% | 4.88 |
| Khai vị ba món + Chả giò | Bia Tiger | 87.3% | 4.51 |

> **Lưu ý trung thực:** dữ liệu là mô phỏng, và bộ sinh có cài sẵn kịch bản "nhóm
> khách nhậu". Việc Apriori tìm lại đúng các quan hệ đó chứng minh **thuật toán
> cài đặt chạy đúng**, chứ chưa chứng minh được quy luật tiêu dùng thực tế. Trên
> dữ liệu thật, quy trình chạy y hệt.

### Nơi gợi ý xuất hiện

Widget `views/partials/goi-y-mon.ejs` được nhúng vào trang **thực đơn** và **giỏ
hàng**. Nó gọi `/goi-y/api/theo-gio-hang`, hiển thị món gợi ý kèm lý do đọc được
("94% khách gọi món này kèm theo — phổ biến gấp 4.9 lần bình thường").

Nếu giỏ trống hoặc chưa có luật nào khớp, hệ thống tự chuyển sang gợi ý **món bán
chạy 60 ngày gần nhất**, nên widget luôn có nội dung.

---

## 7. KDS và sơ đồ bàn thời gian thực

### Màn hình bếp (`/kds`)

Bốn cột theo đúng quy trình: **Chờ chế biến → Đang chế biến → Hoàn thành → Đã phục vụ**.

Trạng thái lưu ở `hopdong.trangthai_bep` (0/1/2/3). Hệ thống cũ chỉ có 0/1;
`kdsService` mở rộng thành 4 mức và **giữ nguyên trang `/staff/kitchen` cũ**.

Món chờ quá 20 phút tự động tô đỏ để bếp ưu tiên.

**Trừ kho tự động** xảy ra tại bước *Hoàn thành* — đúng thời điểm nguyên liệu
thực sự bị tiêu hao. Hệ thống trừ `nguyen_lieu.so_luong` theo công thức và ghi
`xuat_kho`, dữ liệu này quay lại nuôi mô hình dự báo nguyên liệu.

Đã kiểm chứng: hoàn thành *Chả giò ×2* trừ đúng bánh tráng 0.6, thịt heo 0.2,
cà rốt 0.08, dầu ăn 0.1.

### Sơ đồ bàn (`/so-do-ban`)

Quy mô: **40 bàn / 242 chỗ, chia 4 khu** (migration 011). Mã bàn thống nhất dạng
`<chữ cái khu><2 chữ số>`:

| Khu | Mã bàn | Số bàn | Số chỗ |
|---|---|---|---|
| Sảnh chính | `S01`–`S14` | 14 | 60 |
| Sân vườn | `V01`–`V10` | 10 | 54 |
| Tầng 2 | `T01`–`T10` | 10 | 68 |
| Phòng VIP | `P01`–`P06` | 6 | 60 |

- Bàn tô màu theo trạng thái: 🟢 Trống · 🔴 Đang phục vụ · 🟡 Đã đặt · ⚫ Đang dọn
- Hiển thị số món, tổng tiền, số khách của từng bàn đang phục vụ
- Mỗi khu là một dải riêng trên sơ đồ; tab lọc theo khu, thứ tự khu lấy từ
  `vitri.thu_tu` (sảnh → sân vườn → tầng 2 → VIP) chứ không theo `id_vitri`
- **Kéo thả** bàn để khớp mặt bằng thật (chỉ Quản lý và Admin). `ban.toa_do_x/y`
  là tọa độ **trong từng khu**, không phải tọa độ tuyệt đối trên cả sơ đồ — view
  tự cộng độ lệch của khu khi vẽ và trừ lại khi lưu
- Chỉ số thời gian thực: tỷ lệ lấp đầy, doanh thu đang mở, doanh thu hôm nay

Mỗi bàn có đúng một mã QR trùng tên bàn trong `qr_tables`
(`orderService.timIdBanTheoTen()` dò theo tên vì `qr_tables` không có khóa ngoại
sang `ban`). Đổi tên bàn thì phải sửa cả `table_name` lẫn `url` của mã QR, nếu
không đơn quét mã sẽ mất liên kết với bàn.

Cả hai màn hình cập nhật qua **Socket.IO** (`kds-cap-nhat`, `ban-cap-nhat`), kèm
tự làm mới mỗi 20 giây làm lưới an toàn.

---

## 8. Bảng CSDL mới

| Bảng | Mục đích |
|---|---|
| `nha_cung_cap` | Nhà cung cấp |
| `phieu_nhap`, `chi_tiet_phieu_nhap` | Phiếu nhập, lô hàng, hạn sử dụng |
| `xuat_kho` | Nhật ký tiêu hao nguyên liệu |
| `du_bao_luot_khach` | Kết quả dự báo lượt khách |
| `du_bao_nguyen_lieu` | Kết quả dự báo nguyên liệu |
| `danh_gia_mo_hinh` | Chỉ số MAE/RMSE/MAPE/R² của từng mô hình |
| `luat_ket_hop` | Luật kết hợp Apriori |
| `cham_cong_gps` | Chấm công GPS (cấu trúc đã sẵn sàng) |
| `cau_hinh` | Tham số hệ thống (tọa độ nhà hàng, ngưỡng Apriori, URL ML service) |

Cột thêm vào bảng cũ: `hopdong.ngay_dat`, `gio_dat`, `loai_don`, `id_nv_phuc_vu`,
`bep_bat_dau`, `bep_ket_thuc`, `id_ban`, `la_du_lieu_mo_phong`; `ban.trangthai`,
`so_cho`, `toa_do_x`, `toa_do_y`, `sesis_hien_tai`; `nguyen_lieu.gia_von`,
`han_su_dung_ngay`, `ten_chuan`.

---

## 9. Phần chưa làm

Nêu rõ để không bị hỏi bất ngờ:

- **Chấm công GPS + selfie**: bảng `cham_cong_gps` và tham số tọa độ/bán kính đã
  có trong `cau_hinh`, nhưng **chưa có giao diện và luồng xử lý**.
- **Theo dõi shipper trên bản đồ**: chưa làm. Cột `loai_don` đã phân biệt
  `giao_hang` nên dữ liệu sẵn sàng, nhưng chưa có module shipper/GPS/ETA.
- **OCR hóa đơn** và **phân tích cảm xúc đánh giá**: chưa làm.
- **Chatbot**: chưa làm (đề bài cũng khuyến nghị ưu tiên thấp).

Ba trọng tâm mà đề bài đánh giá cao nhất — dashboard phân tích, ML dự báo, AI gợi
ý — đã hoàn thiện và kiểm chứng được bằng số liệu.
