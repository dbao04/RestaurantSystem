# 📱 CHẤM CÔNG BẰNG ĐIỆN THOẠI

Nhân viên tự chấm công bằng điện thoại của mình: mở một địa chỉ, đăng nhập, đưa
mặt vào khung, bấm một nút. Vẫn là **đúng luồng chấm công khuôn mặt** như máy đặt
tại nhà hàng — cùng một API, cùng kiểm tra ảnh sống, cùng đối chiếu GPS.

Địa chỉ: **`https://<địa-chỉ-máy-chủ>/cham-cong/`**

---

## 1. Vì sao bắt buộc phải là `https://`

Mọi trình duyệt hiện nay chỉ cho trang web dùng **camera** và **định vị** khi
trang chạy trong "ngữ cảnh bảo mật" — tức `https://`, hoặc `localhost` ngay trên
chính máy đó.

Điện thoại mở `http://192.168.1.50:3000` thì đối tượng `navigator.mediaDevices`
**không tồn tại**. Đây không phải là bị từ chối quyền — nó đơn giản là không có
sẵn, và không có cách nào lách bằng JavaScript. Bấm "Cho phép" bao nhiêu lần cũng
vô ích.

Trang `/cham-cong/` tự phát hiện việc này: nếu bạn mở bằng `http://`, nó không vẽ
máy chấm công mà hiện thẳng đường dẫn `https://` bấm được.

Các trang khác (đơn hàng, thực đơn, báo cáo) vẫn chạy bình thường trên `http://`.

---

## 2. Hai cách cho điện thoại vào được

### Cách A — Mở ra Internet bằng tunnel *(khuyến nghị)*

```bash
npm run qr:online          # hoặc nháy đúp _mo_qr_online.bat
```

Cửa sổ hiện lên một địa chỉ dạng `https://<ngẫu-nhiên>.trycloudflare.com` kèm
dòng **"Chấm công (điện thoại)"**. Đưa địa chỉ đó cho nhân viên.

| Ưu | Nhược |
|---|---|
| Chứng chỉ thật → **không có cảnh báo nào** | Địa chỉ đổi mỗi lần chạy lại |
| Điện thoại ở mạng nào cũng vào được (4G, Wi-Fi nhà) | Phải giữ cửa sổ đó mở |
| Không cần sửa router, không cần IP tĩnh | Máy chủ phải có Internet |

> **Cảnh báo vận hành:** đường này mở hệ thống ra Internet công khai. Ai có địa
> chỉ đều vào được trang đăng nhập. Chỉ nên bật khi cần, và phải đổi mật khẩu mặc
> định `123456` trước — xem `DANH_SACH_TAI_KHOAN.md`.
>
> Địa chỉ này cũng cho phép chấm công từ **ngoài nhà hàng**; thứ chặn việc đó là
> **ràng buộc GPS** ở mục 5, không phải mạng.

### Cách B — HTTPS trong mạng nội bộ

Chạy `npm start` như bình thường. Terminal in ra bảng địa chỉ:

```
  Điện thoại trong cùng mạng Wi-Fi — CHẤM CÔNG KHUÔN MẶT
  phải dùng địa chỉ https:// dưới đây, http:// sẽ không mở được camera:
     https://192.168.1.50:3443/cham-cong/
```

Điện thoại phải **cùng Wi-Fi** với máy chủ. Lần đầu mỗi máy sẽ hiện
**"Kết nối của bạn không phải là kết nối riêng tư"** — đó là do chứng chỉ tự ký,
không phải lỗi:

* **Chrome / Edge (Android):** *Nâng cao* → *Tiếp tục truy cập ... (không an toàn)*
* **Safari (iPhone):** *Chi tiết* → *Truy cập trang web này*

Bấm qua một lần, các lần sau máy nhớ luôn.

---

## 3. Nhân viên làm gì

1. Vào trang chấm công trên máy tính (`/staff/attendance`) — ở đó có sẵn **mã QR**
   dẫn tới địa chỉ điện thoại. Quét mã bằng camera điện thoại, khỏi gõ tay.
2. Đăng nhập bằng chính tài khoản nhân viên của mình. Sau khi đăng nhập, hệ thống
   đưa thẳng về trang chấm công chứ không đá về trang tổng quan.
3. **Lần đầu:** trang hiện phần *Đăng ký khuôn mặt* — chụp 5 ảnh ở vài góc rồi bấm
   *Lưu đăng ký*. Chỉ làm một lần.
4. **Các lần sau:** đưa mặt vào khung, bấm **Chấm công VÀO / RA**, làm động tác
   ngẫu nhiên mà máy yêu cầu (gật đầu / quay trái / quay phải / lại gần). Giữ mặt
   trong khung khoảng 3 giây.
5. Màn hình xanh = xong. Giờ vào/ra hiện ngay ở đầu trang.

**Cài ra màn hình chính** (tuỳ chọn, nên làm): trang có nút *Cài lên màn hình
chính*; trên iPhone thì dùng *Chia sẻ → Thêm vào MH chính*. Sau đó nó chạy toàn
màn hình như một ứng dụng, không còn thanh địa chỉ, khung camera rộng thêm.

---

## 4. Ba trạng thái trang có thể hiện

| Trang hiện | Nghĩa là | Xử lý |
|---|---|---|
| "Chưa mở được camera ở địa chỉ này" | Đang mở bằng `http://` | Bấm nút *Mở địa chỉ an toàn* ngay trên trang |
| "Bạn chưa đăng ký khuôn mặt" | Chưa có mẫu trong hệ thống | Chụp 5 ảnh ngay tại trang đó |
| "Dịch vụ nhận diện chưa bật" | Chưa chạy ML service | Quản trị chạy `npm run ml` |

---

## 5. Điều quan trọng nhất: chấm công từ nhà thì sao?

**Không được**, và đây là lý do tính năng này an toàn để bật:

* Máy chủ đối chiếu toạ độ điện thoại với toạ độ nhà hàng **trước khi** nhận diện.
  Ngoài bán kính cho phép (mặc định 30 m) là chặn thẳng, kèm câu "Bạn đang cách
  nhà hàng khoảng X m".
* Bật/tắt và đặt toạ độ ở `/to-chuc/khuon-mat`, chỉ **cấp 1 (Quản lý nhà hàng)**
  sửa được. Toạ độ mặc định là trung tâm Quận 1 — **phải đặt lại đúng nhà hàng**,
  nếu không mọi người sẽ bị chặn hết.
* Mỗi lần chấm đều ghi vào `cham_cong_gps` (toạ độ, khoảng cách, hợp lệ hay không)
  và `nhat_ky_nhan_dien`, kể cả lần thất bại. Có dấu vết để đối chiếu về sau.
* Toạ độ do trình duyệt gửi lên nên **về nguyên tắc là giả mạo được** (chế độ nhà
  phát triển của Android, ứng dụng fake GPS). Đây là ràng buộc vận hành, không
  phải biện pháp chống gian lận tuyệt đối. Kèm với đó vẫn còn: kiểm tra ảnh sống,
  động tác ngẫu nhiên, và ngưỡng khớp khuôn mặt.

Muốn siết chặt hơn thì tắt hẳn chấm công bằng điện thoại (không đưa địa chỉ cho
nhân viên, chỉ dùng kiosk đặt tại cửa) — luồng kiosk không đổi.

---

## 6. Lỗi hay gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Điện thoại không mở được trang LAN | Tường lửa Windows chặn cổng 3443 | Mở cổng 3443 cho Node.js trong Windows Defender Firewall |
| Vào được nhưng không hiện camera | Đang mở bằng `http://` | Bấm *Mở địa chỉ an toàn* trên chính trang đó |
| Safari không cho bấm "Truy cập" | Chứng chỉ cũ, không còn chứa IP hiện tại | Xoá thư mục `config/chung-chi/` rồi chạy lại server |
| Cảnh báo hiện lại sau khi đổi Wi-Fi | Router cấp IP mới cho máy chủ | Bình thường — chứng chỉ tự sinh lại, bấm qua một lần nữa |
| "Sai vị trí" dù đang đứng ở quán | Toạ độ nhà hàng chưa đặt, hoặc bán kính quá nhỏ | Vào `/to-chuc/khuon-mat` đặt lại toạ độ; trong nhà GPS sai số 20–50 m nên để bán kính ≥ 30 m |
| "Làm lại động tác" nhiều lần | Thiếu sáng hoặc để đèn sau lưng | Đứng quay mặt về phía nguồn sáng, đưa điện thoại ngang tầm mắt |
| Gửi ảnh rất lâu | Sóng yếu (mỗi lượt ~1 MB) | Đứng gần điểm phát sóng; quá 45 giây hệ thống tự báo lỗi |
| Biểu tượng không hiện, chỉ có ô trống | Máy chủ mất Internet nên không tải được font biểu tượng | Không ảnh hưởng chức năng — mọi nút đều có chữ |

---

## 7. Chỗ nào trong mã nguồn

| Việc | Tệp |
|---|---|
| Trang, manifest PWA, service worker | `routes/chamCongDiDong.js` |
| Giao diện điện thoại | `views/staff/cham-cong-dien-thoai.ejs` |
| Camera / GPS phía trình duyệt (dùng chung 4 trang) | `js/cham-cong-khuon-mat.js` |
| Nhận diện, đối chiếu GPS, ghi bảng công | `services/faceService.js` |
| Chọn địa chỉ https cho điện thoại | `utils/diaChiQR.js` — `diaChiDienThoai()` |
| Chứng chỉ tự ký cho LAN | `config/chungChi.js` |

Xem thêm: `HUONG_DAN_CHAM_CONG_KHUON_MAT.md` (thuật toán, ngưỡng, đánh giá mô hình)
và `HUONG_DAN_CAI_DAT.md` (cài đặt chung).
