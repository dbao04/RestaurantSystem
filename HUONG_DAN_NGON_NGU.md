# Đa ngôn ngữ: Tiếng Việt · English · 日本語

Tài liệu này mô tả phân hệ đa ngôn ngữ: phạm vi, cách hoạt động, cách thêm chuỗi
mới, và những chỗ dễ hiểu nhầm.

---

## 1. Phạm vi — cố ý hẹp

**Chỉ khu khách được dịch.** `/admin`, `/staff` và `/shipper` giữ nguyên tiếng
Việt: người dùng ba khu đó là nhân viên nhà hàng, dịch ra chỉ bắt họ đọc lại một
hệ thống đã thuộc, và nhân đôi số chuỗi phải bảo trì mà không ai đọc.

Danh sách chặn nằm trong `middleware/ngonNgu.js`, hằng `KHONG_DICH`.

| Thành phần | File |
|---|---|
| Lõi: tra chuỗi, tên món, tên nhóm | `services/ngonNgu.js` |
| Ba từ điển, mỗi tệp 377 khóa | `locales/vi.js`, `en.js`, `ja.js` |
| Phát hiện ngôn ngữ, gắn vào `res.locals` | `middleware/ngonNgu.js` |
| Nút đổi ngôn ngữ | `views/partials/header.ejs` + `css/nhahang.css` |
| Kiểm tra tự động | `scripts/kiemTraNgonNgu.js` |

---

## 2. Ngôn ngữ được chọn thế nào

Bốn nguồn, theo thứ tự ưu tiên:

1. **`?lang=en` trên địa chỉ** — người dùng vừa bấm nút đổi ngôn ngữ
2. **Cookie `ngon_ngu`** — lựa chọn đã lưu từ lần trước (hạn 1 năm)
3. **Header `Accept-Language`** — đoán từ trình duyệt, lần đầu vào
4. **Tiếng Việt** — mặc định

**Dùng cookie chứ không phải phiên đăng nhập.** Kho phiên mặc định của
`express-session` nằm trong bộ nhớ máy chủ: khởi động lại là mọi người về lại
tiếng Việt. Ngôn ngữ là lựa chọn của *thiết bị*, không phải của phiên làm việc.

**Đoán từ trình duyệt đọc đúng thứ tự `q`.** Header dạng
`ko-KR,ko;q=0.9,en;q=0.8` sẽ cho ra `en` — bỏ qua tiếng Hàn vì hệ thống không có
bản dịch, chứ không phải cứ lấy ngôn ngữ đầu danh sách.

---

## 3. Dùng trong view

```ejs
<%= t('dieu_huong.thuc_don') %>              <!-- chuỗi giao diện -->
<%= t('dat_ban.giao_hang_mo_ta', { km: 5 }) %>  <!-- có chèn giá trị -->
<%- t('trang_chu.gioi_thieu_1') %>           <!-- chuỗi có thẻ HTML -->
<%= tenMon(m).chinh %>                        <!-- tên món theo ngôn ngữ -->
<%= tenMon(m).phu %>                          <!-- tên phụ để đối chiếu -->
<%= tenNhom(loai) %>                          <!-- tên nhóm món -->
<%= nhanDip(order.noidung) %>                 <!-- nhãn dịp đặt bàn -->
<%= nn %>                                     <!-- 'vi' / 'en' / 'ja' -->
```

`t()` **không nhận tham số ngôn ngữ**. Bắt view viết `t('khoa', nn)` ở vài trăm
chỗ là vài trăm cơ hội quên một chỗ, và chỗ quên đó sẽ im lặng trả về tiếng Việt
giữa một trang tiếng Nhật.

### Chuỗi nằm trong JavaScript

Mã JavaScript chạy ở trình duyệt, không gọi được `t()`. Gom hết vào **một khối
hằng số** do máy chủ sinh, đặt ở đầu `<script>` — xem `views/booking.ejs`:

```ejs
var NN = {
  loiDiaChi: <%- JSON.stringify(t('dat_ban.loi_dia_chi')) %>,
  ...
};
```

`JSON.stringify` chứ không phải nháy tay: bản dịch nào chứa dấu nháy sẽ làm vỡ
cả khối `<script>`.

---

## 4. Tên món — dùng dữ liệu có sẵn, không bịa

| Ngôn ngữ | Nguồn |
|---|---|
| **vi** | `monan.name_mon` |
| **en** | Tách từ `monan.ghichu_mon` — **cả 258 món đã có sẵn** |
| **ja** | Tra bảng thuật ngữ từ tên tiếng Anh |

Cột `ghichu_mon` đang chứa chuỗi dạng `S12- SALMON SASHIMI · phần`. Hàm
`tenTiengAnh()` bỏ mã món ở đầu và đơn vị sau dấu `·`.

### Bảng thuật ngữ Anh → Nhật

**Không phải bộ dịch máy.** Là bảng tra **từng thuật ngữ**, dựng trên đúng **202
từ** thực sự xuất hiện trong thực đơn (quét toàn bộ `ghichu_mon`). Dịch cả câu là
sinh ra dữ liệu không ai kiểm chứng được; thay `SASHIMI` bằng 刺身 thì không thể
sai.

Ba nguyên tắc, mỗi cái sinh ra từ một lỗi thật khi làm:

1. **Cụm từ tra trước từ đơn.** `FLYING FISH ROE` → とびこ, không phải
   "bay"+"cá"+"trứng".
2. **Một số từ chỉ cụm mới phân biệt được.** `BEEF TENDON` là *gân bò* (牛すじ);
   tra từng từ cho ra 天丼 — món cơm tempura. Sai hẳn món ăn.
3. **Quá 1/3 số từ chưa dịch được thì trả về `null`** — màn hình hiện tiếng Anh.
   Một tên tiếng Anh đúng còn hơn một tên nửa Nhật giả hiệu.

Kết quả: **258/258 món** dịch được, luôn kèm tên tiếng Anh bên dưới để đối chiếu.

---

## 5. Bài viết chỉ có tiếng Việt

Nội dung 6 bài viết trong bảng `bai_viet` **không dịch** — đó là nội dung dài do
nhà hàng viết, dịch bằng máy là sinh ra văn bản không ai kiểm chứng. Trang Tin
tức hiện một nhãn `Bài viết hiện chỉ có bản tiếng Việt` khi khách đang ở chế độ
EN/JA, để họ biết **trước khi** bấm vào chứ không phải sau khi mở ra và gặp một
bức tường chữ lạ.

Muốn dịch thật thì thêm bảng `bai_viet_dich (id_bv, ngon_ngu, tieu_de, noi_dung)`
và sửa `anhBaiViet()` trong `views/blog.ejs`.

---

## 6. Thêm một chuỗi mới

1. Thêm khóa vào **cả ba** tệp `locales/`.
2. Dùng `t('khoa_moi')` trong view.
3. Chạy `npm run ngonngu:check`.

Quy ước đặt khóa:

```
chung.*         dùng ở nhiều trang
dieu_huong.*    thanh menu trên cùng
chan_trang.*    chân trang
<ten_trang>.*   chỉ dùng trong đúng trang đó
nhom_mon.*      tên 22 nhóm món
dip.*           nhãn "dịp đặt bàn" lưu trong CSDL
```

---

## 7. Kiểm tra tự động

```bash
npm run ngonngu:check
```

Bốn phép kiểm tra, mỗi phép bắt một loại lỗi **đã thật sự xảy ra** khi làm:

| Phép | Bắt lỗi gì |
|---|---|
| Đối chiếu khóa | `en`/`ja` thiếu khóa → chỗ đó lặng lẽ về tiếng Việt, không ai phát hiện |
| Khóa thừa | Gõ nhầm tên khóa → khóa đó không bao giờ được dùng tới |
| Lẫn chữ Latin | Bản tiếng Nhật còn sót từ tiếng Anh — **đã xảy ra 2 lần**: một chuỗi còn nguyên chữ `season`, một chuỗi còn `support` |
| Tên món | Bao nhiêu món dịch được, và món nào cho ra chuỗi lặp ký tự (dấu hiệu tra từng từ bị trùng nghĩa) |

---

## 8. Những chỗ dễ hiểu nhầm

**Giá trị lưu trong CSDL không đổi theo ngôn ngữ.** `hopdong.noidung` vẫn lưu
`'Sinh nhật'` kể cả khi khách đặt bằng giao diện tiếng Nhật — nhân viên đọc bảng
đặt bàn bằng tiếng Việt, và đổi giá trị lưu sẽ làm hỏng mọi đơn cũ. Chỉ **nhãn**
đổi, qua `nhanDip()`.

**Giỏ hàng phải JOIN sang `monan`.** Bảng `cart` chỉ chụp lại tên và giá lúc
khách bấm thêm (để giá đã chốt không đổi khi nhà hàng sửa bảng giá). Tên tiếng
Anh/Nhật phải lấy từ `monan`; thiếu bước này thì đổi sang English xong, riêng giỏ
hàng vẫn tiếng Việt.

**Tên nhóm món trong CSDL vốn đã là tiếng Anh** (`05. SASHIMI`). Chế độ `en`
dùng thẳng; `vi` và `ja` tra bảng `nhom_mon.*` và **giữ nguyên số thứ tự** ở đầu.

**Địa chỉ nhà hàng không dịch.** Đó là địa chỉ thật ở Việt Nam — dịch ra thì
khách nước ngoài đưa cho tài xế taxi lại không ai hiểu.

**Nút đổi ngôn ngữ mở bằng bấm, không phải hover.** Điện thoại không có con trỏ;
menu chỉ hiện khi hover thì khách dùng điện thoại không bao giờ mở được.

**Liệt kê view từ thư mục, đừng từ `git status`.** Trang `/thanh-vien` bị bỏ sót
ở đợt đầu vì lúc đó nó chưa được theo dõi trong git nên không nằm trong danh
sách tôi lập. Quét `views/*.ejs` bằng `ls` mới đủ.

**Tên mỗi ngôn ngữ viết bằng chính nó** (`English`, `日本語`) chứ không phải bằng
tiếng đang hiển thị — người đang nhìn một trang tiếng Nhật mà không đọc được
tiếng Nhật vẫn phải tìm ra lối thoát.
