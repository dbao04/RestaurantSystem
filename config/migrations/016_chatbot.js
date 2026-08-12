/**
 * Migration 016 - Chatbot hoi dap tieng Viet.
 *
 * TAO GI
 *   1. `chatbot_hoi_thoai` - nhat ky tung luot hoi dap.
 *
 *      Bang nay khong phai de "luu cho co". No phuc vu ba viec cu the:
 *        - Do do chinh xac THAT tren cau hoi that. Con so trong bao cao lay tu
 *          tap kiem thu do chinh tac gia viet; nhat ky nay cho biet mo hinh
 *          chay ra sao voi nguoi dung khong biet truoc bot hieu gi.
 *        - Cau bi danh dau `khong_hieu` la du lieu quy nhat de bo sung mau cau
 *          o `ml_service/chatbot/y_dinh.py` roi huan luyen lai.
 *        - Trang quan tri co so lieu de ve bieu do.
 *
 *   2. `chatbot_danh_gia` - bang so sanh mo hinh, ghi khi chay huan luyen.
 *      Tuong duong `danh_gia_mo_hinh` cua phan du bao: nho co bang nay, trang
 *      quan tri xem duoc ket qua thuc nghiem ma khong can chay lai Python.
 *
 *   3. Cac khoa `chatbot.*` trong `cau_hinh` - noi dung cau tra loi tinh
 *      (gio mo cua, dia chi, chinh sach giao hang...). Quan ly sua truc tiep
 *      trong CSDL, KHONG phai sua ma nguon.
 *
 * Chay lai duoc nhieu lan (idempotent).
 */
const db = require('../db');

// [khoa, gia_tri, mo_ta]
const CAU_HINH = [
  ['chatbot.bat', '1',
   'Bat (1) / tat (0) chatbot tren toan he thong.'],
  ['chatbot.nguong_tin_cay', '0.45',
   'Duoi nguong nay bot tra loi "chua hieu" thay vi doan bua. Cao hon = than trong hon.'],
  ['chatbot.gio_mo_cua',
   'Nhà hàng mở cửa **10:00 – 22:00** tất cả các ngày trong tuần (nhận khách đến 21:30).',
   'Cau tra loi cho cau hoi ve gio mo cua.'],
  ['chatbot.dia_chi',
   'Nhà hàng nằm tại **số 1 Võ Văn Ngân, TP. Thủ Đức, TP.HCM**. Có bãi giữ xe máy và ô tô miễn phí cho khách.',
   'Cau tra loi cho cau hoi ve dia chi.'],
  ['chatbot.lien_he',
   'Bạn liên hệ nhà hàng qua **hotline 0918 484 042** hoặc nhắn tin trực tiếp trong mục Chat của website nhé.',
   'Cau tra loi cho cau hoi ve lien he.'],
  ['chatbot.thanh_toan',
   'Nhà hàng nhận **tiền mặt, chuyển khoản và quét mã VietQR**. Bạn có thể thanh toán tại quầy hoặc quét mã QR ngay tại bàn.',
   'Cau tra loi cho cau hoi ve thanh toan.'],
  ['chatbot.giao_hang',
   'Nhà hàng có **nhận mang về và giao hàng** trong bán kính 5km. Bạn đặt món ở mục Thực đơn rồi chọn hình thức Giao hàng khi thanh toán.',
   'Cau tra loi cho cau hoi ve giao hang.'],
  ['chatbot.dat_coc',
   'Đặt bàn thường **không cần cọc**. Với bàn VIP hoặc nhóm đông, nhà hàng xin cọc giữ chỗ và **hoàn lại toàn bộ** khi bạn đến dùng bữa.',
   'Cau tra loi cho cau hoi ve dat coc.'],
  ['chatbot.dat_ban',
   'Bạn đặt bàn ở mục **Đặt bàn** trên website: chọn ngày, giờ, số khách rồi xác nhận. Nhà hàng sẽ gọi lại xác nhận trong ít phút.',
   'Cau tra loi huong dan dat ban.'],
  ['chatbot.huy_don',
   'Bạn vào mục **Đơn của tôi** để hủy hoặc đổi giờ đơn đang chờ. Đơn bếp đã bắt đầu chế biến thì cần báo nhân viên trực tiếp.',
   'Cau tra loi huong dan huy don.'],
  ['chatbot.danh_gia',
   'Nhà hàng rất mong nhận góp ý của bạn. Bạn đánh giá ở mục **Đánh giá** trên website. Nếu cần xử lý gấp, mình chuyển bạn sang nhân viên ngay.',
   'Cau tra loi khi khach muon danh gia / gop y.'],
  ['chatbot.gioi_thieu',
   'Mình là **trợ lý ảo của nhà hàng**. Mình trả lời được về thực đơn, giá món, khuyến mãi, đặt bàn, giao hàng; và với tài khoản quản lý thì thêm doanh thu, tồn kho, hiệu suất nhân viên và dự báo.',
   'Cau tra loi khi khach hoi bot lam duoc gi.'],
  ['chatbot.chao',
   'Chào bạn! Mình là trợ lý ảo của nhà hàng. Mình giúp gì được cho bạn?',
   'Cau chao mo dau.'],
  ['chatbot.tam_biet',
   'Cảm ơn bạn đã ghé nhà hàng. Hẹn gặp lại bạn!',
   'Cau tam biet.'],
  ['chatbot.cam_on',
   'Rất vui được giúp bạn. Bạn cần gì thêm cứ nhắn mình nhé!',
   'Cau dap khi khach cam on.'],
  ['chatbot.chuyen_nhan_vien',
   'Mình chuyển bạn sang nhân viên hỗ trợ ngay. Bạn chờ một chút nhé!',
   'Cau dap khi khach xin gap nhan vien that.'],
];

async function taoBang() {
  console.log('\n[1/3] Tao bang');

  await db.query(`CREATE TABLE IF NOT EXISTS chatbot_hoi_thoai (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    cau_hoi       VARCHAR(500) NOT NULL,
    y_dinh        VARCHAR(60)  NULL,
    tin_cay       DECIMAL(6,4) NULL,
    quyen         VARCHAR(20)  NULL,
    id_kh         INT          NULL,
    id_nv         INT          NULL,
    thoi_gian_ms  INT          NULL,
    khong_hieu    TINYINT(1)   NOT NULL DEFAULT 0,
    huu_ich       TINYINT(1)   NULL COMMENT 'Khach bam thich/khong thich cau tra loi',
    tham_so       VARCHAR(500) NULL,
    tao_luc       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_y_dinh (y_dinh),
    KEY idx_khong_hieu (khong_hieu),
    KEY idx_tao_luc (tao_luc)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('  + chatbot_hoi_thoai');

  await db.query(`CREATE TABLE IF NOT EXISTS chatbot_danh_gia (
    id                INT NOT NULL AUTO_INCREMENT,
    mo_hinh           VARCHAR(80)  NOT NULL,
    do_chinh_xac      DECIMAL(6,2) NULL COMMENT '%% tren tap kiem thu sinh',
    f1_macro          DECIMAL(6,2) NULL,
    do_chinh_xac_tay  DECIMAL(6,2) NULL COMMENT '%% tren tap cau viet tay',
    f1_macro_tay      DECIMAL(6,2) NULL,
    giay_huan_luyen   DECIMAL(8,2) NULL,
    ms_moi_cau        DECIMAL(8,2) NULL,
    la_mo_hinh_chon   TINYINT(1)   NOT NULL DEFAULT 0,
    tao_luc           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_chon (la_mo_hinh_chon)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('  + chatbot_danh_gia');
}

async function themCauHinh() {
  console.log('\n[2/3] Tham so va noi dung tra loi tinh');
  let them = 0;
  for (const [khoa, giaTri, moTa] of CAU_HINH) {
    const [kq] = await db.query(
      'INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, ?, ?)',
      [khoa, giaTri, moTa]
    );
    if (kq.affectedRows) { them++; console.log(`  + ${khoa}`); }
    else console.log(`  = ${khoa} (da co, giu nguyen)`);
  }
  console.log(`  -> them ${them}/${CAU_HINH.length} khoa`);
}

async function kiemTra() {
  console.log('\n[3/3] Kiem tra');
  const [ch] = await db.query(
    "SELECT COUNT(*) AS n FROM cau_hinh WHERE khoa LIKE 'chatbot.%'"
  );
  const [ht] = await db.query('SELECT COUNT(*) AS n FROM chatbot_hoi_thoai');
  const [dg] = await db.query('SELECT COUNT(*) AS n FROM chatbot_danh_gia');
  console.log(`  cau_hinh chatbot.*    : ${ch[0].n} khoa`);
  console.log(`  chatbot_hoi_thoai     : ${ht[0].n} dong`);
  console.log(`  chatbot_danh_gia      : ${dg[0].n} dong`);
  console.log('\n  Buoc tiep theo: chay `train_chatbot.bat` de huan luyen bo phan loai.');
}

async function main() {
  console.log('=== Migration 016: chatbot hoi dap tieng Viet ===');
  await taoBang();
  await themCauHinh();
  await kiemTra();
  console.log('\n=== Hoan tat migration 016 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
