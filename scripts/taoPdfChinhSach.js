/**
 * Sinh file PDF "Chinh sach dat ban, dat coc & doi/huy ban" (font Times New Roman).
 * Ket qua: public/files/CHINH_SACH_DAT_BAN.pdf
 * Chay lai khi sua noi dung chinh sach:  npm run chinhsach:pdf
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const DUONG_DAN_CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const THU_MUC_RA = path.join(__dirname, '..', 'public', 'files');
const FILE_RA = path.join(THU_MUC_RA, 'CHINH_SACH_DAT_BAN.pdf');

const HTML = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 18mm 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12.5pt; line-height: 1.45; color: #1f1a14; margin: 0; }
  .dau { text-align: center; border-bottom: 2px solid #b08d3c; padding-bottom: 10px; margin-bottom: 14px; }
  .dau .nh { font-size: 12pt; letter-spacing: 3px; color: #8a6a22; font-weight: bold; text-transform: uppercase; }
  .dau h1 { font-size: 19pt; margin: 6px 0 4px; color: #3b2a14; text-transform: uppercase; }
  .dau .ngay { font-size: 11pt; font-style: italic; color: #6b5a44; }
  p { margin: 0 0 8px; text-align: justify; }
  h2 { font-size: 14pt; color: #fff; background: #4a3519; padding: 5px 10px; margin: 18px 0 10px; text-transform: uppercase; page-break-after: avoid; }
  h3 { font-size: 13pt; color: #6b4e17; margin: 12px 0 6px; page-break-after: avoid; }
  ul { margin: 2px 0 8px 0; padding-left: 22px; }
  li { margin-bottom: 3px; text-align: justify; }
  .vd { font-style: italic; color: #5a4a36; }
  .noibat { border-left: 4px solid #b08d3c; background: #fbf6ea; padding: 7px 12px; margin: 8px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 6px; page-break-inside: avoid; font-size: 12pt; }
  th, td { border: 1px solid #9c8562; padding: 6px 8px; vertical-align: top; }
  th { background: #efe4c9; color: #3b2a14; text-align: center; }
  td.c { text-align: center; }
  tr:nth-child(even) td { background: #fcf9f2; }
  .xanh { color: #166534; font-weight: bold; }
  .cam { color: #b45309; font-weight: bold; }
  .do { color: #b91c1c; font-weight: bold; }
  .chu { font-size: 11pt; font-style: italic; margin-top: 2px; }
  .cuoi { margin-top: 20px; border-top: 2px solid #b08d3c; padding-top: 10px; text-align: center; font-style: italic; }
</style></head><body>

<div class="dau">
  <div class="nh">Nhà hàng Bảo Đoàn</div>
  <h1>Chính sách Đặt bàn, Đặt cọc<br>và Đổi / Hủy bàn</h1>
  <div class="ngay">Áp dụng cho mọi lượt đặt bàn trực tuyến và tại quầy</div>
</div>

<p>Nhằm đảm bảo chất lượng phục vụ chu đáo nhất, giữ đúng vị trí bàn và chuẩn bị nguyên liệu tươi ngon cho từng lượt đặt trước, Nhà hàng Bảo Đoàn áp dụng Chính sách Đặt bàn, Đặt cọc và Đổi/Hủy bàn như sau:</p>

<h2>I. Chính sách đặt cọc bàn &amp; thanh toán món đặt trước</h2>

<h3>1. Trường hợp khách chỉ đặt bàn (không đặt trước món ăn)</h3>
<p>Mức tiền đặt cọc được tính theo số lượng khách và khung giờ nhận bàn:</p>

<p><b>a) Bàn đặt tiệc đoàn đông (từ 15 người trở lên – mọi khung giờ)</b></p>
<ul>
  <li>Mức đặt cọc bắt buộc: <b>150.000đ / người</b>.</li>
  <li class="vd">Ví dụ: Đoàn 15 người → Đặt cọc: 15 × 150.000đ = 2.250.000đ.</li>
</ul>
<div class="noibat"><b>Chính sách đặc biệt khi thanh toán:</b> Toàn bộ tiền cọc được trừ trực tiếp vào hóa đơn cuối buổi. Trường hợp khách dùng món thực tế tại nhà hàng có tổng hóa đơn <b>thấp hơn</b> tổng mức cọc 150.000đ/người, nhà hàng sẽ <b>hoàn lại 100% phần tiền thừa</b> cho quý khách ngay tại quầy lúc thanh toán.</div>

<p><b>b) Khung giờ cao điểm (từ 18:00 đến 21:00 hằng ngày – dưới 15 người)</b></p>
<ul>
  <li>Mức đặt cọc bắt buộc: <b>100.000đ / người</b> (áp dụng khi khách chỉ đặt bàn, không đặt trước món ăn).</li>
  <li class="vd">Ví dụ: Bàn 4 người lúc 19:00 → Đặt cọc: 4 × 100.000đ = 400.000đ.</li>
</ul>

<p><b>c) Khung giờ thường (ngoài khung 18:00 – 21:00)</b></p>
<ul>
  <li>Bàn từ 6 đến 14 người: đặt cọc bắt buộc <b>100.000đ / người</b>. <span class="vd">(Ví dụ: Bàn 6 người lúc 11:30 → Đặt cọc: 6 × 100.000đ = 600.000đ.)</span></li>
  <li>Bàn dưới 6 người (từ 1 đến 5 người): <b class="xanh">MIỄN ĐẶT CỌC (0đ)</b>.</li>
</ul>

<h3>2. Trường hợp khách đặt bàn kèm đặt trước món ăn (Pre-order)</h3>
<ul>
  <li>Khi quý khách chọn món ăn trước trên hệ thống trong quá trình đặt bàn: quý khách thanh toán trước <b>100% tổng tiền món ăn</b> đã chọn qua mã VietQR.</li>
  <li>Ưu đãi khi đặt trước món ăn:
    <ul>
      <li>Quý khách đã thanh toán 100% tiền món đặt trước sẽ <b>không phải đóng thêm</b> khoản tiền cọc giữ bàn 100.000đ/người (kể cả trong khung giờ cao điểm 18:00 – 21:00 hoặc bàn từ 6 – 14 người).</li>
      <li>Riêng đối với đoàn đặt tiệc từ 15 người trở lên: tổng mức thanh toán trước tối thiểu cần đạt <b>150.000đ/người</b>. Nếu tiền món đặt trước thấp hơn mức này, hệ thống thu theo mức tối thiểu 150.000đ/người và hoàn trả lại tiền thừa lúc thanh toán nếu tổng chi tiêu thực tế thấp hơn.</li>
      <li>Món ăn đặt trước sẽ được bếp chuẩn bị sẵn sàng ngay khi quý khách đến nhận bàn, không phải chờ đợi lâu.</li>
    </ul>
  </li>
</ul>

<h3>3. Bảng tóm tắt mức đặt cọc &amp; thanh toán trước</h3>
<table>
  <thead><tr><th style="width:38%">Quy mô đoàn &amp; Khung giờ</th><th>Không đặt món</th><th>Có đặt trước món ăn</th></tr></thead>
  <tbody>
    <tr><td><b>1 – 5 người</b><br><i>Giờ thường: ngoài 18h – 21h</i></td><td class="c xanh">Miễn cọc (0đ)</td><td class="c">Thanh toán 100% tiền món đặt trước</td></tr>
    <tr><td><b>6 – 14 người</b><br><i>Giờ thường: ngoài 18h – 21h</i></td><td class="c cam">Cọc 100.000đ / người</td><td class="c">Thanh toán 100% tiền món đặt trước</td></tr>
    <tr><td><b>1 – 14 người</b><br><i>Giờ cao điểm: 18:00 – 21:00</i></td><td class="c cam">Cọc 100.000đ / người</td><td class="c">Thanh toán 100% tiền món đặt trước</td></tr>
    <tr><td><b>Đặt tiệc từ 15 người trở lên</b><br><i>Mọi khung giờ</i></td><td class="c cam">Cọc 150.000đ / người (*)</td><td class="c">100% tiền món (tối thiểu 150.000đ / người) (*)</td></tr>
  </tbody>
</table>
<div class="chu">(*) Hoàn lại tiền thừa ngay lúc thanh toán nếu dùng món thực tế thấp hơn tổng mức 150.000đ/người.</div>

<h2>II. Quy định về thời gian đặt bàn, thanh toán cọc &amp; giữ bàn</h2>

<h3>1. Thời gian đặt bàn trực tuyến</h3>
<ul>
  <li>Đặt trước tối thiểu: ít nhất <b>30 phút</b> trước giờ dự kiến đến.</li>
  <li>Đặt trước tối đa: <b>90 ngày</b>.</li>
  <li>Quy mô đặt trực tuyến: hỗ trợ tối đa <b>30 khách/lượt</b>. Với đoàn trên 30 khách, quý khách vui lòng liên hệ trực tiếp Hotline nhà hàng để được bố trí sảnh tiệc riêng.</li>
</ul>

<h3>2. Thời hạn thanh toán tiền cọc / tiền món đặt trước</h3>
<ul>
  <li>Sau khi xác nhận đặt bàn có yêu cầu đặt cọc hoặc có chọn món trước, hệ thống hiển thị mã VietQR chuyển khoản tự động.</li>
  <li>Quý khách vui lòng hoàn tất thanh toán trong vòng <b>60 phút</b> (hoặc trước giờ nhận bàn nếu đặt sát giờ). Quá thời hạn trên mà chưa ghi nhận thanh toán, hệ thống sẽ tự động hủy yêu cầu giữ chỗ để mở bàn cho khách khác.</li>
</ul>

<h3>3. Thời gian giữ bàn khi khách đến trễ</h3>
<ul>
  <li>Hệ thống giữ bàn trong vòng <b>15 phút</b> tính từ giờ hẹn trên phiếu đặt bàn.</li>
  <li>Trường hợp quý khách kẹt xe hoặc đến trễ hơn dự kiến, vui lòng gọi điện báo trước cho nhà hàng để nhân viên gia hạn thời gian giữ bàn.</li>
  <li>Nếu quá <b>30 phút</b> sau giờ hẹn mà nhà hàng không nhận được thông báo từ quý khách, lượt đặt bàn sẽ tự động chuyển sang trạng thái <i>“Không đến (No-show)”</i> và nhả bàn.</li>
</ul>

<h2>III. Chính sách đổi lịch, hủy bàn và hoàn tiền cọc</h2>

<h3>1. Chính sách đổi giờ / đổi ngày (Reschedule)</h3>
<p>Quý khách được <b>miễn phí</b> đổi giờ hoặc đổi ngày (bảo lưu 100% số tiền đã đặt cọc / thanh toán trước sang lịch mới) khi thông báo trước:</p>
<ul>
  <li>Tối thiểu <b>04 giờ</b> trước giờ hẹn: đối với bàn thường (dưới 15 khách, không đặt món trước).</li>
  <li>Tối thiểu <b>12 giờ</b> trước giờ hẹn: đối với đoàn tiệc từ 15 khách trở lên hoặc đơn có đặt trước món ăn.</li>
</ul>

<h3>2. Chính sách hủy bàn &amp; hoàn tiền</h3>
<p>Khi quý khách hủy bàn đã đặt cọc hoặc đã thanh toán món ăn trước, mức hoàn tiền được tính tự động dựa trên khoảng thời gian từ lúc hủy đến giờ hẹn:</p>
<table>
  <thead><tr><th style="width:34%">Thời điểm báo hủy<br><i style="font-weight:normal">(so với giờ hẹn nhận bàn)</i></th><th>Bàn thường<br><i style="font-weight:normal">(&lt; 15 khách)</i></th><th>Đoàn tiệc (≥ 15 người)<br><i style="font-weight:normal">hoặc có đặt món trước</i></th></tr></thead>
  <tbody>
    <tr><td><b>Trước từ 24 giờ trở lên</b></td><td class="c xanh">Hoàn 100% tiền cọc</td><td class="c xanh">Hoàn 100% tiền cọc / tiền món đã trả</td></tr>
    <tr><td><b>Từ 6 giờ đến dưới 24 giờ</b></td><td class="c cam">Hoàn 70% tiền cọc</td><td class="c cam">Hoàn 50% tiền cọc / tiền món đã trả</td></tr>
    <tr><td><b>Từ 2 giờ đến dưới 6 giờ</b></td><td class="c cam">Hoàn 50% tiền cọc</td><td class="c do">Không hoàn tiền (0%)<br><span style="font-weight:normal;font-style:italic;color:#5a4a36">Bếp đã sơ chế món / bố trí sảnh tiệc</span></td></tr>
    <tr><td><b>Sát giờ (dưới 2 giờ)</b></td><td class="c do">Không hoàn tiền (0%)</td><td class="c do">Không hoàn tiền (0%)</td></tr>
    <tr><td><b>Không đến (No-show)</b></td><td class="c do">Không hoàn tiền (0%)</td><td class="c do">Không hoàn tiền (0%)</td></tr>
  </tbody>
</table>

<h3>3. Quy định đối với lịch sử bỏ bàn (No-show)</h3>
<ul>
  <li>Đối với các lượt đặt bàn miễn cọc (1 – 5 khách giờ thường): quý khách có thể hủy miễn phí trên hệ thống bất kỳ lúc nào trước giờ hẹn nếu thay đổi kế hoạch.</li>
  <li>Nếu một số điện thoại đặt bàn nhưng không đến và không báo hủy (No-show) từ <b>03 lần</b> trở lên, hệ thống sẽ tạm khóa tính năng đặt bàn tự động trực tuyến của số điện thoại đó; quý khách cần liên hệ trực tiếp nhà hàng để đặt bàn cho các lần tiếp theo.</li>
</ul>

<div class="cuoi">Mọi thắc mắc hoặc yêu cầu hỗ trợ đặt tiệc, đổi lịch, hoàn cọc, quý khách vui lòng liên hệ Hotline Nhà hàng Bảo Đoàn hoặc tra cứu tại mục <b>“Đơn của tôi”</b>.<br><b>Trân trọng cảm ơn Quý khách!</b></div>

</body></html>`;

(async () => {
  const chrome = DUONG_DAN_CHROME.find((p) => fs.existsSync(p));
  if (!chrome) {
    console.error('[chinhsach:pdf] Khong tim thay Chrome/Edge. Dat bien CHROME_PATH tro toi chrome.exe.');
    process.exit(1);
  }
  fs.mkdirSync(THU_MUC_RA, { recursive: true });
  const trinhDuyet = await puppeteer.launch({ executablePath: chrome, headless: true });
  try {
    const trang = await trinhDuyet.newPage();
    await trang.setContent(HTML, { waitUntil: 'load' });
    await trang.pdf({
      path: FILE_RA,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font-family:\'Times New Roman\',serif;font-size:9pt;color:#7a6a55;text-align:center;">' +
        'Nhà hàng Bảo Đoàn — Chính sách Đặt bàn, Đặt cọc &amp; Hoàn hủy — Trang <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
      margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
    });
    console.log('[chinhsach:pdf] Da tao: ' + FILE_RA);
  } finally {
    await trinhDuyet.close();
  }
})();
