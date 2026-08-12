# Chatbot hỏi đáp tiếng Việt

Tài liệu này mô tả phân hệ **trợ lý ảo** của hệ thống: kiến trúc, phương pháp,
cách đánh giá và cách mở rộng.

Điểm khác biệt so với các chatbot thường gặp: **toàn bộ mô hình do hệ thống tự
huấn luyện trên bộ dữ liệu tự xây**, chạy hoàn toàn offline, không gọi API của
bất kỳ nhà cung cấp AI nào và không cần khóa API.

---

## 1. Chạy thử trong 3 bước

```bat
:: 1. Tạo bảng và tham số cấu hình (chạy một lần)
node config\migrations\016_chatbot.js

:: 2. Huấn luyện bộ phân loại ý định + in bảng chỉ số cho báo cáo
train_chatbot.bat

:: 3. Bật hệ thống như bình thường
start_all.bat
```

Sau đó:

| Nơi | Đường dẫn |
|---|---|
| Widget chat (mọi trang khách) | nút tròn góc dưới bên phải |
| Trang quản trị chatbot | `http://localhost:3000/admin/chatbot` |
| API tài liệu tự sinh | `http://127.0.0.1:8000/docs` |

> Bỏ qua bước 2 thì lần hỏi đầu tiên sẽ tự huấn luyện ngay trong request và mất
> vài chục giây. Chạy `train_chatbot.bat` trước là để tránh đúng chuyện đó, và
> để có bảng chỉ số đưa vào báo cáo.

---

## 2. Kiến trúc — 5 tầng

```
        "Doanh thu tuần trước bao nhiêu?"
                     │
   ┌─────────────────▼─────────────────────────────────────────┐
   │ ① tien_xu_ly.py    Chuẩn hóa                              │
   │    teencode "dt" → "doanh thu", bỏ dấu câu, gom khoảng    │
   └─────────────────┬─────────────────────────────────────────┘
                     ▼
   ┌───────────────────────────────────────────────────────────┐
   │ ② phan_loai.py     PHÂN LOẠI Ý ĐỊNH   ← học máy tự train  │
   │    TF-IDF từ (1-2 gram) ⊕ TF-IDF n-gram ký tự (2-5)       │
   │    → hoi_doanh_thu, độ tin cậy 0.94                       │
   └─────────────────┬─────────────────────────────────────────┘
                     ▼
   ┌───────────────────────────────────────────────────────────┐
   │ ③ thuc_the.py      TRÍCH XUẤT THAM SỐ                     │
   │    "tuần trước" → {tu: 2026-07-27, den: 2026-08-02}       │
   │    tên món / nguyên liệu tra từ điển sinh động từ CSDL    │
   └─────────────────┬─────────────────────────────────────────┘
                     ▼
   ┌───────────────────────────────────────────────────────────┐
   │ ④ truy_van.py      MẪU SQL CÓ THAM SỐ                     │
   │    SELECT SUM(thanhtien) … WHERE ngay_dat BETWEEN :tu AND │
   │    :den        ← KHÔNG sinh SQL tự do                     │
   └─────────────────┬─────────────────────────────────────────┘
                     ▼
   ┌───────────────────────────────────────────────────────────┐
   │ ⑤ tra_loi.py       SINH CÂU TRẢ LỜI + bảng + biểu đồ      │
   └─────────────────┬─────────────────────────────────────────┘
                     ▼
        "Doanh thu tuần trước (27/07 → 02/08): 128.450.000đ …"
                     │
              ghi vào chatbot_hoi_thoai
```

Điều phối: `ml_service/chatbot/bot.py`.

### Bản đồ tệp

| Tệp | Vai trò |
|---|---|
| `ml_service/chatbot/tien_xu_ly.py` | Chuẩn hóa, bỏ dấu, đo tương đồng 3-gram |
| `ml_service/chatbot/y_dinh.py` | **Bộ từ điển 44 ý định + trình sinh dữ liệu** |
| `ml_service/chatbot/phan_loai.py` | Huấn luyện, đánh giá, suy luận, quét ngưỡng |
| `ml_service/chatbot/thuc_the.py` | Thời gian tiếng Việt, từ điển món/nguyên liệu |
| `ml_service/chatbot/truy_van.py` | Mẫu SQL an toàn + phân quyền |
| `ml_service/chatbot/tra_loi.py` | Sinh câu trả lời tiếng Việt |
| `ml_service/chatbot/bot.py` | Điều phối + nhật ký |
| `ml_service/chatbot/train.py` | CLI huấn luyện, in bảng chỉ số |
| `services/chatbotService.js` | Cầu nối Node → Python, có bộ dự phòng |
| `routes/chatbot.js` | API công khai + trang quản trị |
| `views/partials/chatbot.ejs` | Widget chat (nhúng trong footer) |
| `views/admin/chatbot.ejs` | Trang quản trị chatbot |

---

## 3. Bộ dữ liệu — tự xây

Không có bộ dữ liệu hỏi đáp tiếng Việt công khai nào chứa các ý định đặc thù của
một nhà hàng (hỏi tồn kho, hỏi lô sắp hết hạn, hỏi hiệu suất bếp). Vì vậy bộ dữ
liệu được xây từ đầu.

### Cách sinh

Mỗi ý định được mô tả bằng một số **mẫu câu** dùng hai ký pháp:

```python
"{doanh thu|dt} <tg> {là bao nhiêu|bao nhiêu|thế nào}"
#  └ chọn một trong 2   └ chỗ trống      └ chọn một trong 3
#  → 2 × 3 = 6 biến thể, mỗi biến thể điền một mốc thời gian mẫu
```

### Quy mô

| Chỉ số | Giá trị |
|---|---|
| Số ý định | **44** (5 chung · 21 khách hàng · 18 quản lý) |
| Số mẫu câu viết tay | **352** |
| Số câu sinh ra | **~5.000** |
| Độ dài trung bình | ~5,4 từ |
| Tập kiểm thử viết tay | **66 câu** |
| Tập ngoài phạm vi | **20 câu** |

Bộ sinh dùng seed cố định (`SEED = 20260804`, trùng quy ước với bộ sinh dữ liệu
lịch sử ở migration 003) nên **chạy lại cho ra đúng bộ dữ liệu cũ** — số liệu
trong luận văn tái lập được.

### Tăng cường dữ liệu đặc thù tiếng Việt

30% số câu được nhân bản sang **dạng không dấu** (`"doanh thu hôm qua"` →
`"doanh thu hom qua"`). Người Việt gõ không dấu rất nhiều, nhất là trên điện
thoại; nếu không dạy mô hình điều này thì bot gần như vô dụng trên thực tế.

---

## 4. Ba nguyên tắc phương pháp luận

Đây là phần hội đồng thường hỏi nhất — cùng tinh thần với phần dự báo chuỗi
thời gian của hệ thống.

### 4.1. Chia tập theo **nhóm mẫu câu**, không chia ngẫu nhiên

Nếu chia ngẫu nhiên từng câu, hai câu sinh ra từ **cùng một mẫu** sẽ rơi vào cả
tập huấn luyện lẫn tập kiểm thử. Mô hình gần như đã "thấy trước" câu kiểm thử →
độ chính xác đẹp giả tạo, khoảng 99%.

Hệ thống dùng `GroupShuffleSplit` với nhóm là **mã mẫu câu**: toàn bộ câu sinh
từ một mẫu chỉ nằm ở một bên. Con số thu được thấp hơn nhưng đo đúng thứ cần đo:
**khả năng hiểu một cách diễn đạt chưa từng thấy**.

Đây chính là phiên bản dành cho văn bản của nguyên tắc "chia theo mốc thời gian,
không dùng `train_test_split` ngẫu nhiên" ở phần dự báo.

### 4.2. Luôn có mô hình nền

Mô hình nền `Nền – đoán nhãn phổ biến nhất` luôn có mặt trong bảng so sánh. Bất
kỳ mô hình nào không vượt được nó thì không có giá trị thực tế.

### 4.3. Tập kiểm thử viết tay mới là thước đo thật

Ngoài tập sinh, có **66 câu do người viết tự do** — có lỗi chính tả, viết tắt,
diễn đạt vòng vo, không theo mẫu nào:

```
"cho mình hỏi quán mình mấy giờ đóng cửa vậy ạ"
"toi nay con ban trong khong ban"
"thang nay so voi thang truoc the nao"
```

Mô hình được **chọn theo F1-macro trên tập viết tay**, không theo tập sinh.

---

## 5. Biểu diễn đặc trưng — hai kênh song song

| Kênh | Đặc trưng | Bắt được gì |
|---|---|---|
| 1 | TF-IDF trên **từ** (1–2 gram) | Cụm từ mang nghĩa: "doanh thu", "tồn kho" |
| 2 | TF-IDF trên **n-gram ký tự** (2–5), bản bỏ dấu | Gõ không dấu, sai chính tả, viết dính |

Hai kênh ghép bằng `FeatureUnion`.

**Vì sao không dùng thư viện tách từ tiếng Việt** (`underthesea`, `pyvi`):
n-gram ký tự đã phủ được phần lớn vai trò của tách từ, đồng thời suy giảm mượt
hơn hẳn khi gặp lỗi gõ — một lỗi nhỏ chỉ làm hỏng vài n-gram thay vì biến cả từ
thành từ lạ. Đổi lại hệ thống không phải thêm một phụ thuộc nặng.

---

## 6. Kết quả thực nghiệm

Chạy `train_chatbot.bat` để sinh bảng này (số liệu thay đổi theo máy):

```
  Mô hình                          DoCX(sinh)  F1(sinh)  DoCX(tay)  F1(tay)  Train(s)  ms/câu
  ----------------------------------------------------------------------------------------
  Nền - đoán nhãn phổ biến nhất        ...        ...       ...       ...      ...      ...
  Naive Bayes (chỉ TF-IDF từ)          ...        ...       ...       ...      ...      ...
  kNN cosine (k=5)                     ...        ...       ...       ...      ...      ...
  Hồi quy Logistic                     ...        ...       ...       ...      ...      ...
* SVM tuyến tính                       ...        ...       ...       ...      ...      ...
```

Bảng còn được ghi vào bảng `chatbot_danh_gia` và hiển thị lại ở
`/admin/chatbot` — xem được ngay cả khi Python đang tắt.

**Cách đọc bảng khi viết báo cáo:**

- Chênh lệch giữa **Naive Bayes (chỉ TF-IDF từ)** và các mô hình dùng cả hai
  kênh chính là **đóng góp của n-gram ký tự** — đây là một nghiên cứu loại bỏ
  (ablation) có sẵn trong bảng.
- Chênh lệch giữa cột **(sinh)** và cột **(tay)** cho thấy khoảng cách giữa dữ
  liệu sinh theo mẫu và ngôn ngữ tự nhiên thật. Nêu thẳng con số này thay vì
  giấu đi.
- Cột **ms/câu** trả lời câu hỏi "chạy nổi trên máy thường không".

### Ngưỡng tin cậy

Bot chỉ trả lời khi độ tin cậy vượt ngưỡng; dưới ngưỡng thì nói "chưa hiểu" và
hỏi lại. `train.py` in bảng quét ngưỡng với ba chỉ số đối nghịch:

| Chỉ số | Ý nghĩa | Mong muốn |
|---|---|---|
| Từ chối đúng | % câu **ngoài phạm vi** bị từ chối | càng cao càng tốt |
| Từ chối oan | % câu **hợp lệ** bị từ chối nhầm | càng thấp càng tốt |
| Đúng & nhận | % câu hợp lệ vừa được nhận vừa đoán đúng | càng cao càng tốt |

Nhờ bảng này, việc chọn ngưỡng là một **quyết định có biện luận**, không phải
con số chọn bừa. Ngưỡng mặc định 0,45; quản lý chỉnh qua khóa
`chatbot.nguong_tin_cay` trong bảng `cau_hinh`.

---

## 7. An ninh — bốn lớp độc lập

### Lớp 1 — Không sinh SQL tự do

Mỗi ý định gắn cứng với một hàm xử lý viết sẵn, bên trong là câu SQL cố định
với **tham số ràng buộc** (`:tu`, `:den`, `:id`). Văn bản người dùng chỉ bao giờ
đi vào **vị trí tham số**, không bao giờ trở thành **cú pháp SQL**.

Hệ quả: không có đường nào để injection; không thể hỏi ra bảng không nằm trong
`truy_van.py`; không thể sinh ra câu SQL sai cú pháp.

Đây là điểm khác biệt căn bản với cách tiếp cận "để mô hình ngôn ngữ tự viết
SQL" — cách đó mạnh hơn về độ linh hoạt nhưng phải kèm cả một tầng kiểm duyệt
câu lệnh, và vẫn không bảo đảm tuyệt đối.

### Lớp 2 — Quyền suy từ phiên đăng nhập

Tham số `quyen` gửi sang Python được suy ra từ `req.session` phía server,
**không bao giờ lấy từ body request**. Khách sửa JSON cũng không thể tự nâng
mình lên quản lý.

18 ý định nhóm `quan_ly` bị chặn **trước khi chạm vào CSDL**. Mô hình chỉ làm
nhiệm vụ nhận dạng, không được phép là chốt bảo vệ an ninh.

### Lớp 3 — Dữ liệu cá nhân lấy từ phiên

Câu "đơn của tôi tới đâu rồi" tra theo `id_kh` **lấy từ phiên đăng nhập**, không
lấy từ nội dung câu hỏi. Người dùng không thể gõ "đơn của khách số 15".

### Lớp 4 — Giới hạn tần suất và độ dài

20 câu / 60 giây cho mỗi phiên; câu hỏi tối đa 500 ký tự.

---

## 8. Không làm sập web

Theo đúng nguyên tắc chung của hệ thống, `services/chatbotService.js` bọc mọi
lời gọi sang cổng 8000. Nếu Python chưa bật hoặc lỗi, nó chuyển sang **bộ trả
lời dự phòng** viết bằng JavaScript: so khớp từ khóa cho vài ý định phổ biến
nhất (giờ mở cửa, địa chỉ, liên hệ, thanh toán, giao hàng, món bán chạy), đọc
nội dung từ bảng `cau_hinh`.

Chế độ dự phòng được **ghi rõ trên giao diện** để người dùng không tưởng nhầm
đó là năng lực đầy đủ. Và nó **không bao giờ trả về số liệu kinh doanh nội bộ**.

---

## 9. Hội thoại nhiều lượt

Bot có bộ nhớ một bước. Khi thiếu tham số bắt buộc:

```
Khách:  giá bao nhiêu
Bot:    Bạn muốn hỏi giá món nào ạ?          ← ghi nhớ: đang chờ tham số "mon"
Khách:  gà nướng
Bot:    Gà nướng (GÀ) có giá 200.000đ        ← ghép vào ý định đang chờ
```

Ngữ cảnh lưu trong **phiên phía server**, không lấy từ body — nếu tin body thì
người dùng có thể tự khai "ý định đang chờ" bất kỳ để lách qua bước phân loại.

Điều kiện ghép: lượt mới phải có tham số cần **và** độ tin cậy dưới 0,75. Nếu
người dùng đổi hẳn chủ đề thì ý định mới được tôn trọng.

---

## 10. Vòng lặp cải tiến

Bảng `chatbot_hoi_thoai` ghi lại mọi lượt hỏi. Trang `/admin/chatbot` hiển thị
**danh sách câu bot chưa hiểu**, sắp theo số lần gặp.

```
Câu chưa hiểu (từ nhật ký thật)
        │
        ▼
Thêm mẫu câu vào ml_service/chatbot/y_dinh.py
        │
        ▼
train_chatbot.bat  (hoặc bấm "Huấn luyện lại" trên trang quản trị)
        │
        ▼
Độ phủ tăng — đo lại bằng chính bảng thống kê đó
```

Đây là một vòng MLOps thu nhỏ và **đo được**: tỷ lệ hiểu trước/sau mỗi lần bổ
sung là một biểu đồ tốt cho báo cáo.

Khách còn chấm 👍/👎 mỗi câu trả lời (`chatbot_hoi_thoai.huu_ich`) — dữ liệu để
đo mức hài lòng thật.

---

## 11. Thêm một ý định mới

1. Mở `ml_service/chatbot/y_dinh.py`, thêm mục vào `Y_DINH` với **ít nhất 8 mẫu
   câu** (ít hơn thì phép chia theo nhóm không đủ mẫu cho cả hai bên):

```python
"hoi_wifi": {
    "nhom": "khach",
    "mo_ta": "Hỏi mật khẩu wifi",
    "mau": [
        "{cho|} {xin|hỏi} {mật khẩu|pass} wifi",
        "wifi {tên gì|mật khẩu gì|pass gì}",
        # … tối thiểu 8 mẫu
    ],
},
```

2. Nếu ý định cần dữ liệu: viết hàm `_q_...` trong `truy_van.py` rồi đăng ký vào
   `THU_VIEN`. Nếu chỉ là câu trả lời cố định: thêm vào `NOI_DUNG_TINH` và thêm
   khóa `chatbot.*` vào migration.
3. Viết hàm sinh câu trả lời trong `tra_loi.py`, đăng ký vào `BO_SINH`.
4. Thêm 1–2 câu vào `BO_KIEM_THU_TAY` để ý định mới cũng được đo.
5. Chạy `train_chatbot.bat`.

---

## 12. Hạn chế — nêu trung thực trong báo cáo

1. **Chỉ hiểu trong phạm vi 44 ý định.** Bot không tán gẫu tự do, không trả lời
   câu hỏi ngoài lĩnh vực nhà hàng. Đây là đánh đổi có chủ đích: đổi độ linh
   hoạt lấy tính đúng đắn tuyệt đối của số liệu và an toàn SQL.

2. **Dữ liệu huấn luyện sinh từ mẫu.** Dù đã chia theo nhóm mẫu và có tập viết
   tay, bộ dữ liệu vẫn do một người viết nên chưa phủ hết cách nói của người
   dùng thật. Nhật ký hội thoại chính là cơ chế khắc phục dần.

3. **Trích xuất thực thể dùng luật, không dùng học máy.** Đây là lựa chọn thiết
   kế (tên món là dữ liệu sống, thêm món mới không được bắt huấn luyện lại),
   nhưng đồng nghĩa các cách diễn đạt thời gian lạ có thể không nhận ra.

4. **Câu trả lời sinh theo mẫu.** Văn phong kém tự nhiên hơn mô hình ngôn ngữ
   lớn. Đổi lại bot không bao giờ bịa số liệu.

5. **Món chay lọc theo từ khóa tên món** vì CSDL chưa có cột đánh dấu. Bot có
   nói rõ điều này và khuyên khách xác nhận với nhân viên — dị ứng là vấn đề an
   toàn, không được im lặng suy đoán.

6. **"Hôm nay" neo vào ngày có dữ liệu mới nhất**, không phải ngày hệ thống, để
   trình diễn được trên CSDL mô phỏng. Câu trả lời luôn ghi rõ mốc ngày đang
   dùng.

---

## 13. Hướng phát triển

- **Ghép thêm LLM ở tầng diễn đạt**: giữ nguyên tầng ②③④ (đảm bảo số liệu đúng
  và an toàn SQL), chỉ dùng mô hình ngôn ngữ để viết lại câu trả lời cho tự
  nhiên hơn. Kiến trúc hiện tại đã tách sẵn tầng ⑤ nên chỉ cần thay một hàm.
- **Fine-tune PhoBERT** cho tầng ②, thêm một dòng vào bảng so sánh. Cần
  `torch` + `transformers`; nên huấn luyện trên Google Colab rồi tải mô hình về.
- **Nhận dạng giọng nói** cho khách quét QR tại bàn.
- **Chuyển tiếp sang nhân viên thật** khi bot từ chối hai lượt liên tiếp — hệ
  thống đã có sẵn phân hệ chat người–người để nối vào.
