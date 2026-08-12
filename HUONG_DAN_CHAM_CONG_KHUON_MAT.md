# Chấm công bằng khuôn mặt

Tài liệu này mô tả phân hệ chấm công bằng khuôn mặt: cách nó được nối vào hệ
thống, luồng dữ liệu, và cách vận hành.

---

## 1. Trước và sau

Phần **thuật toán** (`ml_service/khuon_mat.py`, ~1000 dòng) đã có sẵn từ trước:
phát hiện bằng YuNet, trích vector 128 chiều bằng SFace, so khớp cosine, chống
giả mạo. Nhưng nó **chưa nối vào hệ thống** — `main.py` không có endpoint, phía
Node không có gì gọi tới, và file mô hình SFace bị hỏng.

Đã bổ sung để tính năng chạy được từ trình duyệt:

| Thành phần | File |
|---|---|
| 7 endpoint FastAPI cho khuôn mặt | `ml_service/main.py` |
| Cầu nối Node → Python | `services/mlService.js` (6 hàm `khuonMat*`) |
| Nghiệp vụ chấm công + nhật ký | `services/faceService.js` (mới) |
| Router + 3 trang | `routes/khuonMat.js` (mới) |
| Kiosk / cá nhân / quản lý / lần đầu | `views/staff/khuon-mat-*.ejs` |
| `opencv-python` vào requirements | `ml_service/requirements.txt` |
| Tải lại mô hình SFace (bản cũ hỏng) | `ml_service/mo_hinh_khuon_mat/` |

---

## 2. Phân chia trách nhiệm

```
Trình duyệt (webcam)
   │  gửi loạt khung hình base64
   ▼
Node  routes/khuonMat.js ──▶ services/faceService.js
   │                              │  nghiệp vụ: ghi cham_cong, nhật ký, chống chấm trùng
   │                              ▼
   │                         services/mlService.js  ──HTTP──▶  Python (cổng 8000)
   │                                                              │  THỊ GIÁC MÁY TÍNH
   │                                                              ├─ kiểm tra ảnh sống (liveness)
   │                                                              ├─ phát hiện + trích vector
   │                                                              ├─ so khớp cosine
   │                                                              └─ lưu ảnh bằng chứng ra đĩa
   ▼
MySQL  cham_cong · nhat_ky_nhan_dien · khuon_mat_nv
```

Nguyên tắc: **vector khuôn mặt không bao giờ rời khỏi tiến trình Python.** Node
chỉ nhận về kết quả (ai, độ khớp, đường dẫn ảnh) rồi lo phần nghiệp vụ. CSDL chỉ
lưu vector 128 chiều, **không lưu ảnh gốc** — từ vector không dựng lại được mặt.

---

## 3. Ba luồng sử dụng

### 3.1. Tự đăng ký ngay lần đăng nhập đầu tiên  ⭐

Nhân viên **không phải chụp hay tải ảnh thủ công**. Ngay sau khi đăng nhập lần
đầu (chưa có mẫu khuôn mặt), hệ thống tự chuyển tới `/staff/khuon-mat/lan-dau`:

```
Đăng nhập  →  server.js kiểm tra: faceService.soMauCua(id) == 0 ?
   │                                          │ có
   │ không                                    ▼
   ▼                             /staff/khuon-mat/lan-dau
/staff                          Trang TỰ CHỤP: hướng dẫn 3 tư thế
                                (thẳng · trái · phải), tự bấm máy 7 khung,
                                tự gửi đăng ký. Luôn có nút "Bỏ qua".
```

Trang này không có nút chụp, không có ô tải ảnh — chỉ một vòng tròn tiến độ và
hướng dẫn. Không bao giờ chặn việc vào hệ thống: nếu dịch vụ Python tắt hoặc
người dùng muốn để sau, có link *Bỏ qua*.

### 3.2. Kiosk chấm công 1:N — `/cham-cong-khuon-mat`

Màn hình toàn khung đặt ở cửa. Ai đứng trước camera, bấm một nút, làm theo thử
thách chống giả mạo (gật đầu / quay trái / quay phải / lại gần) trong ~2,4 giây;
hệ thống nhận diện **1:N** (so với toàn bộ người đã đăng ký) rồi tự ghi chấm
công vào/ra. Kết quả hiện to, có tiếng bíp, tự ẩn để phục vụ người kế tiếp.

Chạy được cả trên máy tính bảng và điện thoại: dưới 600px bố cục chuyển sang
khung dọc 3/4 (mặt người cao hơn rộng, nên khung dọc chứa được mặt to hơn với
cùng bề ngang màn hình), nút chấm công trải hết bề ngang, và có nút đổi camera
trước/sau ở góc khung hình — nút này chỉ hiện khi máy thật sự có từ hai camera.
Điện thoại xoay ngang thì video và phần điều khiển xếp thành hai cột để không
phải cuộn.

### 3.3. Cá nhân — `/staff/khuon-mat`

Nhân viên tự đăng ký lại (đổi kiểu tóc, kính…) và tự chấm công **1:1** (xác minh
đúng là mình). Chế độ 1:1 lấy `id_nv` từ **phiên đăng nhập**, không nhận từ
client, nên không thể khai id người khác.

### 3.4. Quản lý — `/to-chuc/khuon-mat`

Cần quyền `nhansu.cham_cong.xem` (xem) hoặc `nhansu.cham_cong.sua` (sửa). Xem ai
đã/chưa đăng ký, nhật ký nhận diện gần đây (kể cả lần thất bại / nghi giả mạo),
khai báo **vị trí nhà hàng** cho ràng buộc GPS, xóa mẫu của người nghỉ việc, và
chạy **đánh giá độ chính xác** (SFace so với mốc LBPH, kiểu leave-one-out).

### 3.5. Trang chấm công — `/staff/attendance`  ⭐

Đây là nơi nhân viên chấm công hằng ngày: đồng hồ, giờ vào/giờ ra hôm nay, lịch
sử theo tháng, và **một máy chấm công khuôn mặt ngay trên trang** (camera + thử
thách chống giả mạo + GPS). Nút tự đổi nhãn theo chiều kế tiếp: chưa có giờ vào
thì hiện "Chấm công VÀO", đã vào chưa ra thì "Chấm công RA".

**Chấm công thủ công đã bị gỡ bỏ hoàn toàn.** Trước đây trang này có hai nút
`POST /staff/clock-in` và `/staff/clock-out` ghi thẳng vào bảng `cham_cong` chỉ
dựa trên phiên đăng nhập — mượn được tài khoản là chấm hộ được, đúng thứ mà nhận
diện khuôn mặt sinh ra để chặn. Đã xoá:

| Đã gỡ | Ở đâu |
|---|---|
| `POST /staff/clock-in`, `POST /staff/clock-out` | `server.js` |
| `personnelService.clockIn` / `clockOut` | `services/personnelService.js` |
| `POST /check-in`, `POST /check-out` | `routes/generalStaff.js` (router chưa mount, gỡ để sau này mount lên không mở lại đường cũ) |

Nay chỉ còn **một** đường ghi chấm công: `POST /api/khuon-mat/cham-cong`
(`routes/khuonMat.js`), luôn phải qua kiểm tra ảnh sống + đối chiếu GPS.

Đánh đổi cần biết: khi ML service tắt hoặc một người chưa đăng ký khuôn mặt thì
họ **không chấm công được**. Lối thoát duy nhất là quản lý ghi bổ sung ở mục 3.6
— có danh tính và có dấu vết, khác hẳn nút bấm tay cũ.

### 3.6. Quản lý bảng công — `/to-chuc/cham-cong`

Xem cần `nhansu.cham_cong.xem`; mọi thao tác **ghi** cần `nhansu.cham_cong.sua`.
Tách hai mức vì nhiều chức danh (giám sát, trưởng ca…) được xem bảng công bộ
phận mình, nhưng chỉ quản lý nhà hàng và kế toán trưởng mới được sửa số liệu
tính lương.

Bảng công theo ngày liệt kê **mọi nhân viên đang làm việc**, kể cả người chưa
chấm — dùng `LEFT JOIN` chứ không lọc từ bảng `cham_cong`, vì thứ quản lý cần
nhìn nhất là *ai chưa chấm*, điều mà một bảng chỉ chứa người đã chấm không bao
giờ nói ra được. Mỗi dòng hiện giờ vào/ra, tổng giờ, khoảng cách GPS lúc chấm,
và **cách ghi**:

| Nhãn | Nghĩa |
|---|---|
| `Khuôn mặt` | Có bằng chứng sinh trắc + ảnh sống + GPS, kèm % độ khớp |
| `Sửa tay` | Người có quyền ghi/sửa vào, kèm lý do trong `ghi_chu` |
| `Thủ công (cũ)` | Dữ liệu từ trước khi bỏ chấm công tay |

Ba việc ghi được: **sửa** giờ vào/ra, **ghi bổ sung** cho người không chấm được,
**xoá** bản ghi sai. Cả ba đều:

1. **Bắt buộc nhập lý do** tối thiểu 8 ký tự — chặn kiểu gõ "ok" cho có. Không
   có lý do thì không ghi, kiểm ở phía server chứ không chỉ ở giao diện.
2. Ghi vào `audit_logs` (`action = 'cham_cong.sua' | '.them' | '.xoa'`) kèm người
   thực hiện, IP, và **giá trị trước/sau** — nên xoá nhầm vẫn khôi phục lại được
   từ nhật ký.
3. Đánh dấu `phuong_thuc_vao/ra = 'sua_tay'` cho **đúng chiều bị đổi**. Sửa mỗi
   giờ ra thì giờ vào vẫn giữ nhãn `khuon_mat` — báo cáo không bị nói oan là cả
   dòng do người sửa trong khi một nửa vẫn có bằng chứng khuôn mặt.

Ràng buộc dữ liệu: giờ ra phải sau giờ vào; không cho có giờ ra mà thiếu giờ
vào; `tong_gio` luôn tính lại từ hai mốc cuối cùng chứ không tin giá trị cũ; một
nhân viên chỉ thêm được một bản ghi cho mỗi ngày (đã có thì phải sửa).

Cột phải của trang là **nhật ký sửa chữa**: ai sửa gì, từ giờ nào sang giờ nào,
vì lý do gì, lúc nào.

---

## 4. Vòng đời một lần chấm công

```
0. Trình duyệt xin toạ độ GPS (trước khi thu ảnh — hộp xin quyền che mất
   camera, xin sau thì cả loạt khung vừa chụp đều hỏng)
   Node đối chiếu với toạ độ nhà hàng bằng công thức Haversine
      ✗ ngoài bán kính → ghi nhật ký 'sai_vi_tri', từ chối NGAY,
        không gọi Python (chặn trong một phần giây thay vì đợi hết lượt
        nhận diện; câu trả lời "bạn đang cách nhà hàng 4 km" không cần
        biết người đó là ai)
1. Trình duyệt thu ~12 khung trong lúc người dùng làm thử thách
   (camera xin 960×720 rồi thu nhỏ vừa trong hộp 640×480 — Python cắt mặt
    về 112×112, ở 480×360 người ngồi cách một sải tay chỉ còn ~90 điểm ảnh
    nên bị phóng to và nhoè, làm rớt chính bài kiểm tra độ nét ở bước 2).
   Hộp 640×480 TỰ XOAY theo hướng của nguồn: điện thoại cầm dọc cho luồng
    720×960 sẽ ra ảnh 480×640, không phải 640×480. Xem `chup()` trong
    js/cham-cong-khuon-mat.js — ép nguồn dọc vào canvas ngang là bóp méo
    mặt 1,78 lần, mà thẻ <video> dùng object-fit:cover nên ảnh xem trước
    vẫn đúng tỉ lệ và không ai phát hiện ra.
2. Python: kiểm tra ảnh sống (4 tín hiệu: hình học thử thách, độ nét,
   kết cấu tần số, nhất quán danh tính giữa các khung).
   Trả về `ma_ly_do` — mã máy đọc được, Node tra bảng chứ KHÔNG đoán
   ngược từ câu tiếng Việt:
      ✗ chua_dat_thu_thach / khong_du_khung
            → ghi 'chua_dat_thu_thach', mời làm lại dứt khoát hơn
      ✗ khung_khong_dong_nhat (vector giữa các khung lệch nhau)
            → ghi 'khung_khong_dong_nhat', mời ngồi gần hơn / tránh
              ngược sáng
      ✗ nghi_gia_mao (điểm sống dưới ngưỡng)
            → ghi 'gia_mao', từ chối
      ✓ đạt → dùng lại khung rõ nhất cho bước nhận diện

   Chỉ nhánh thứ ba là cáo buộc gian lận. Ba nhánh kia là người thật gặp
   điều kiện chụp xấu — gộp hết vào 'gia_mao' thì vừa sai bản chất, vừa
   không cho người dùng biết phải sửa gì, vừa thổi phồng ô "nghi giả mạo
   hôm nay" trên trang quản lý.
3. Python: trích vector, so khớp
      1:N (kiosk)      → tìm người gần nhất, kiểm tra ngưỡng + biên an toàn
      1:1 (cá nhân)    → so với mẫu của chính người đó, đối chiếu chống chấm hộ
4. Node: nếu khớp
      - chống chấm trùng: cách lần trước ≥ 90 giây (cau_hinh)
      - ghi cham_cong: lần đầu trong ngày = giờ VÀO, lần sau = giờ RA
      - ghi nhat_ky_nhan_dien (mọi lần, kể cả thất bại) kèm khoang_cach_m
        và dia_chi_ip
      - ghi cham_cong_gps: toạ độ, khoảng cách, hợp lệ hay không
      - báo realtime cho quản lý (sự kiện cham-cong:moi)
```

Ở kiosk (1:N) danh tính chỉ có sau bước nhận diện, nên bản ghi `cham_cong_gps`
của lượt **thành công** được viết ở bước 4; lượt bị chặn vì sai vị trí viết ngay
ở bước 0 với `loai = 'chan'`.

Cột ghi vào `cham_cong`: `phuong_thuc_vao/ra = 'khuon_mat'`, `do_tin_cay_vao/ra`
(điểm cosine), `anh_vao/ra` (đường dẫn ảnh bằng chứng). **Không ghi đè** dữ liệu
chấm công thủ công cũ.

---

## 5. Cài đặt & vận hành

### Lần đầu

```bat
:: 1. Cài opencv (đã thêm vào requirements)
pip install -r ml_service/requirements.txt

:: 2. Tải hai mô hình ONNX (YuNet + SFace)
python -m ml_service.tai_mo_hinh

:: 3. Bảng dữ liệu (nếu chưa chạy)
node config/migrations/007_cham_cong_khuon_mat.js
```

### Chạy hằng ngày

Không có gì thêm: khi ML service (cổng 8000) đã bật thì tính năng khuôn mặt tự
sẵn sàng. `start_all.bat` đã bật ML service.

### Nếu Python tắt

Không sập web, nhưng **không ai chấm công được** — đây là hệ quả trực tiếp của
việc bỏ chấm công thủ công (mục 3.5). Trang đăng ký vẫn cho *bỏ qua* để vào hệ
thống làm việc bình thường; trang `/staff/attendance` hiện cảnh báo kèm việc cần
làm là bật lại ML service ở cổng 8000.

Vì vậy ML service phải được coi là dịch vụ thiết yếu chứ không phải tuỳ chọn:
`start_all.bat` đã bật sẵn, nên luôn khởi động hệ thống bằng file đó.

---

## 6. Tham số (bảng `cau_hinh`, sửa nóng không cần khởi động lại)

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `khuon_mat_nguong_cosine` | 0.363 | Ngưỡng coi là cùng một người (khuyến nghị của SFace) |
| `khuon_mat_bien_an_toan` | 0.05 | Khoảng cách tối thiểu giữa người hạng 1 và hạng 2 |
| `khuon_mat_so_anh_toi_thieu` | 5 | Số ảnh mẫu tối thiểu để đủ điều kiện |
| `khuon_mat_bat_kiem_tra_song` | 1 | Bật chống giả mạo (ảnh in / màn hình) |
| `khuon_mat_nguong_do_net` | 45 | Phương sai Laplacian tối thiểu — loại ảnh mờ |
| `khuon_mat_nguong_diem_song` | 0.55 | Điểm liveness tối thiểu |
| `khuon_mat_cach_nhau_giay` | 90 | Giãn cách tối thiểu giữa hai lần chấm của một người |
| `khuon_mat_bat_gps` | 1 | Bắt buộc đứng trong bán kính nhà hàng mới chấm được |
| `nha_hang_vi_do` | 10.762622 | Vĩ độ nhà hàng — **phải sửa**, xem dưới |
| `nha_hang_kinh_do` | 106.660172 | Kinh độ nhà hàng — **phải sửa**, xem dưới |
| `ban_kinh_cham_cong_m` | 30 | Bán kính cho phép, tính bằng mét |

### ⚠️ Phải khai báo toạ độ nhà hàng trước khi bật GPS

Toạ độ mặc định là trung tâm Quận 1, TP.HCM với bán kính 30 m. Nếu nhà hàng
không nằm đúng chỗ đó mà `khuon_mat_bat_gps = 1` thì **mọi lượt chấm công đều bị
từ chối**.

Cách khai báo: vào `/to-chuc/khuon-mat` → thẻ **Vị trí nhà hàng**. Cần quyền
`nhansu.cham_cong.sua`. Có ba cách chọn, dùng cách nào cũng được:

* **Kéo ghim trên bản đồ** (Leaflet + OpenStreetMap) — nhìn thấy ngay mình đang
  chọn đúng toà nhà nào; vòng tròn vàng là bán kính cho phép, đổi ô bán kính thì
  vòng tròn to nhỏ theo.
* **Tìm theo địa chỉ** rồi kéo ghim cho khớp đúng cửa nhà hàng.
* **Bấm *Lấy vị trí hiện tại*** khi đang đứng tại nhà hàng.

Bản đồ và hai ô toạ độ đồng bộ hai chiều: kéo ghim thì số đổi, gõ số thì ghim
nhảy. Khi bấm Lưu thì nguồn dữ liệu vẫn là **hai ô số**, nên mất mạng (bản đồ
không tải được từ CDN) màn hình vẫn dùng được bình thường — chỗ bản đồ hiện lời
nhắc nhập tay.

Gõ tay toạ độ là việc rất dễ sai: lệch một chữ số thập phân thứ tư là đã đi
khoảng 10 m, đủ để chặn hết cả nhà hàng khi bán kính chỉ 30 m. Vì vậy bản đồ là
cách nên dùng.

Bán kính nên đặt **50–100 m**: sai số GPS của điện thoại trong nhà thường
20–50 m. Hệ thống còn tự cộng thêm sai số mà trình duyệt báo về (giới hạn 100 m
để không ai lách bằng cách khai sai số thật lớn).

Định vị của trình duyệt — giống camera — **chỉ chạy trên HTTPS hoặc
`localhost`**. Mở kiosk bằng `http://<ip-máy>:3000` từ máy khác thì cả camera lẫn
GPS đều không dùng được.

Toạ độ do trình duyệt gửi lên **không tin tuyệt đối được** (người dùng sửa được
JavaScript). Đây là ràng buộc vận hành, không phải biện pháp chống gian lận tuyệt
đối — vì vậy mọi lượt đều được ghi lại trong `cham_cong_gps` kèm IP để đối chiếu
về sau.

---

## 7. Bảo mật

- CSDL chỉ lưu **vector 128 chiều**, không lưu ảnh gốc.
- Ảnh mẫu và ảnh bằng chứng lưu ở `du_lieu_khuon_mat/` — **ngoài** thư mục tĩnh
  của Express nên không truy cập được qua URL, và đã thêm vào `.gitignore`.
- Nhận diện 1:1 lấy `id_nv` từ phiên đăng nhập, không nhận từ client.
- Chống chấm hộ: khi xác minh 1:1, nếu có người khác giống hơn chính chủ thì
  từ chối và ghi nhật ký `nghi_cham_ho`.
- Mọi lần nhận diện (kể cả thất bại) đều được ghi `nhat_ky_nhan_dien` làm dấu
  vết kiểm toán.

---

## 8. Kiểm chứng đã thực hiện

Chạy trên MySQL 8 tạm (Docker) với đúng bản dump, ML service riêng, hai khuôn
mặt thật khác nhau:

- Đăng ký 2 người, mỗi người 5 mẫu — đạt điều kiện.
- Nhận diện 1:N: người A → đúng A, người B → đúng B (phân biệt chính xác).
- Xác minh 1:1: đúng chính chủ → thành công; đưa mặt người khác → **không khớp**
  (chống chấm hộ).
- Đánh giá SFace vs LBPH chạy được, ghi vào `danh_gia_mo_hinh`.
- **Qua toàn chuỗi Node → Python → CSDL:** chấm VÀO ghi đúng `cham_cong`
  (phương thức, độ tin cậy, ảnh bằng chứng) + `nhat_ky_nhan_dien`; lần thứ hai
  ngay lập tức bị chặn "quá nhanh"; sau đó chấm RA điền đúng `gio_ra` + `tong_gio`.
- Đăng nhập lần đầu (chưa có khuôn mặt) → tự chuyển tới trang tự đăng ký.
- Sửa kèm: file mô hình SFace hỏng (23 MB) → tải lại bản chuẩn (38 MB); nâng
  giới hạn body lên 20 MB để nhận loạt khung ảnh (trước đó 413).

CSDL thật không bị đụng tới trong quá trình test (toàn bộ chạy ở DB tạm).
