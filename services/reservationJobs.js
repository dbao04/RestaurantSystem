/**
 * Bo xu ly NEN cua module dat ban.
 *
 * Mot he thong dat ban khong the chi phan ung khi co nguoi bam nut. Ba viec sau
 * xay ra do THOI GIAN TROI QUA, khong do ai thao tac:
 *
 *   1. Khach da qua gio giu ban ma chua den   -> canh bao, roi no-show (muc 7)
 *   2. Sap den gio dat                        -> nhac khach va nhac bep (muc 19)
 *   3. Coc qua han thanh toan                 -> tu huy, tra ban lai (BR-005)
 *
 * Neu khong co vong quet nay thi ban cua mot khach khong den se bi giu den het
 * ngay, va nhan vien phai tu nho ma don - dung cai ma phan mem sinh ra de lam
 * ho ho.
 *
 * ---------------------------------------------------------------------------
 * VI SAO KHONG DUNG CRON RIENG
 * ---------------------------------------------------------------------------
 * Ca he thong da chay mot tien trinh Node duy nhat kem Socket.IO. Them mot tien
 * trinh cron nghia la them mot thu phai nho bat, phai giam sat, va phai chia se
 * ket noi CSDL. Mot `setInterval` trong chinh tien trinh web la du cho quy mo
 * mot nha hang, va no phat duoc su kien realtime ngay lap tuc - dieu ma mot
 * tien trinh rieng khong lam duoc neu khong noi them mot kenh nua.
 *
 * Danh doi: chay nhieu ban sao web thi moi ban se cung quet. Cac thao tac deu
 * qua `doiTrangThai` (co FOR UPDATE + kiem tra may trang thai) nen ban thu hai
 * chi nhan loi "khong the chuyen tu NO_SHOW sang NO_SHOW" va bo qua - khong
 * hong du lieu. Khi nao thuc su chay nhieu ban sao thi thay bang khoa phan tan.
 */
const db = require('../config/db');
const qt = require('./reservationRules');
const dv = require('./reservationService');
const realtime = require('./realtime');
const mailer = require('../utils/mailer');
const { ngayCucBo } = require('../utils/thoiGian');

/** Chu ky quet. 60 giay: du nhanh de canh bao con y nghia, du cham de khong ton. */
const CHU_KY_MS = 60000;

let dongHo = null;
let dangChay = false;

// --------------------------------------------------------------- thong bao

/**
 * Noi dung email theo tung su kien.
 *
 * Giu o day thay vi trong tung ham vi de doat lai duoc toan bo giong noi cua
 * he thong khi doc mot cho - va vi mot noi dung sai chinh ta se duoc gui cho
 * hang tram khach truoc khi ai do phat hien.
 */
function soanMail(suKien, r, duLieu = {}) {
  const gio = qt.gioNgan(String(r.start_time));
  const ngay = qt.ngayChuoi(r.reservation_date);
  const ngayVN = ngay.split('-').reverse().join('/');
  const ban = r.table_names ? ` · Bàn ${r.table_names}` : '';

  const mau = {
    RESERVATION_CREATED: {
      tieuDe: `Đã nhận yêu cầu đặt bàn ${r.reservation_code}`,
      than: `Cảm ơn bạn đã đặt bàn tại Nhà Hàng Bảo Đoàn.

Mã đặt bàn: ${r.reservation_code}
Thời gian: ${gio} ngày ${ngayVN}
Số khách: ${r.guest_count}${ban}
Trạng thái: ${qt.NHAN_TRANG_THAI[r.status]}

Bạn có thể xem, đổi giờ hoặc hủy lượt đặt tại trang tra cứu bằng mã đặt bàn và số điện thoại đã dùng.`,
    },
    RESERVATION_CONFIRMED: {
      tieuDe: `Xác nhận đặt bàn ${r.reservation_code}`,
      than: `Nhà hàng đã xác nhận lượt đặt bàn của bạn.

Mã đặt bàn: ${r.reservation_code}
Thời gian: ${gio} ngày ${ngayVN}
Số khách: ${r.guest_count}${ban}

Rất mong được đón tiếp bạn.`,
    },
    RESERVATION_REMINDER: {
      tieuDe: `Nhắc lịch: bàn của bạn lúc ${gio} hôm nay`,
      than: `Xin nhắc bạn về lượt đặt bàn sắp tới.

Mã đặt bàn: ${r.reservation_code}
Thời gian: ${gio} ngày ${ngayVN}
Số khách: ${r.guest_count}${ban}

Nhà hàng giữ bàn trong ${duLieu.grace || 15} phút kể từ giờ đặt. Nếu bạn đến muộn hơn, vui lòng gọi cho nhà hàng để chúng tôi giữ bàn thêm.`,
    },
    RESERVATION_CANCELLED: {
      tieuDe: `Đã hủy đặt bàn ${r.reservation_code}`,
      than: `Lượt đặt bàn ${r.reservation_code} (${gio} ngày ${ngayVN}) đã được hủy.
${duLieu.hoan_tien && duLieu.hoan_tien.soTien
    ? `\nTiền cọc hoàn lại: ${Number(duLieu.hoan_tien.soTien).toLocaleString('vi-VN')}đ (${duLieu.hoan_tien.moTa}).`
    : ''}
Mong được phục vụ bạn vào một dịp khác.`,
    },
    RESERVATION_NO_SHOW: {
      tieuDe: `Lượt đặt bàn ${r.reservation_code} đã đóng`,
      than: `Chúng tôi đã giữ bàn cho bạn nhưng không đón được bạn vào ${gio} ngày ${ngayVN}.

Lượt đặt đã được đóng để nhường bàn cho khách khác. Nếu có nhầm lẫn, xin liên hệ nhà hàng.`,
    },
    RESERVATION_WAITLISTED: {
      tieuDe: `Bạn đang trong danh sách chờ — ${r.reservation_code}`,
      than: `Khung giờ ${gio} ngày ${ngayVN} hiện đã kín bàn, yêu cầu của bạn đang ở danh sách chờ.

Ngay khi có bàn trống, nhà hàng sẽ liên hệ để xác nhận với bạn.`,
    },
    DEPOSIT_PAID: {
      tieuDe: `Đã nhận tiền cọc — ${r.reservation_code}`,
      than: `Nhà hàng đã nhận tiền cọc ${Number(duLieu.so_tien || r.deposit_amount).toLocaleString('vi-VN')}đ cho lượt đặt ${r.reservation_code} (${gio} ngày ${ngayVN}).

Lượt đặt của bạn đã được xác nhận.`,
    },
  };
  return mau[suKien] || null;
}

/**
 * Phat cac thong bao dang xep hang.
 *
 * Moi thong bao di hai duong: socket cho man hinh nhan vien (luon luon) va
 * email cho khach (chi khi co dia chi va co mau noi dung). Thong bao gui hong
 * duoc danh dau FAILED chu khong xoa - de con biet ma goi dien bu.
 */
async function phatThongBao() {
  const [rows] = await db.query(
    `SELECT n.id, n.reservation_id, n.event_key, n.recipient, n.channel, n.payload,
            r.reservation_code, r.customer_name, r.phone, r.email, r.reservation_date,
            r.start_time, r.guest_count, r.status, r.deposit_amount,
            GROUP_CONCAT(b.number_ban ORDER BY b.number_ban SEPARATOR ', ') AS table_names
       FROM reservation_notifications n
       LEFT JOIN reservations r ON r.id = n.reservation_id
       LEFT JOIN reservation_tables rt ON rt.reservation_id = r.id
       LEFT JOIN ban b ON b.Id_ban = rt.table_id
      WHERE n.status = 'PENDING'
      GROUP BY n.id
      ORDER BY n.id ASC LIMIT 50`);

  for (const tb of rows) {
    let duLieu = {};
    try { duLieu = typeof tb.payload === 'string' ? JSON.parse(tb.payload) : (tb.payload || {}); }
    catch (e) { duLieu = {}; }

    // Socket: man hinh nhan vien tu tai lai phan lien quan.
    realtime.doi(realtime.MIEN.DAT_BAN, {
      su_kien: tb.event_key,
      reservation_id: tb.reservation_id,
      ma: tb.reservation_code,
      khach: tb.customer_name,
      ngay: tb.reservation_date ? qt.ngayChuoi(tb.reservation_date) : null,
      gio: tb.start_time ? qt.gioNgan(String(tb.start_time)) : null,
    });

    let trangThai = 'SENT';
    const mau = tb.reservation_id ? soanMail(tb.event_key, tb, duLieu) : null;
    const nhan = tb.recipient || tb.email;

    if (mau && nhan && mailer.daCauHinh()) {
      try {
        // `sendMail` nhan ba tham so vi tri (to, subject, content) - khong phai
        // mot doi tuong. Goi sai thu tu thi nodemailer nem loi "No recipients".
        await mailer.sendMail(nhan, mau.tieuDe, mau.than);
      } catch (e) {
        trangThai = 'FAILED';
        console.error(`[dat-ban] gửi mail ${tb.event_key} thất bại:`, e.message);
      }
    }

    await db.query('UPDATE reservation_notifications SET status = ?, sent_at = NOW() WHERE id = ?',
      [trangThai, tb.id]);
  }
  return rows.length;
}

// -------------------------------------------------------------- no-show

/**
 * Canh bao va tu dong chuyen no-show (muc 7).
 *
 * Hai moc, khong phai mot:
 *   hold_until                          -> CANH BAO. Nhan vien con quyet dinh:
 *                                          goi dien, giu them, hay dong.
 *   hold_until + auto_no_show_minutes    -> TU DONG dong. Chi khi quan ly bat
 *                                          (dat = 0 la tat han).
 *
 * Tu dong dong ngay tai moc dau la sai: khach ket xe 10 phut khong phai la
 * khach bo bua. Nhung khong bao gio tu dong dong cung sai: 22h dem khong con ai
 * ngoi don nhung ban vang.
 */
async function quetNoShow() {
  const ch = await qt.docCauHinh();
  const tuDongSau = Number(ch.auto_no_show_minutes) || 0;
  const ketQua = { canh_bao: 0, no_show: 0 };

  // 1. Canh bao - chi mot lan cho moi luot dat (`no_show_warned_at`).
  const [canhBao] = await db.query(
    `SELECT id, reservation_code, customer_name, phone, guest_count, start_time,
            reservation_date, hold_until
       FROM reservations
      WHERE status IN ('CONFIRMED','PENDING')
        AND hold_until IS NOT NULL AND hold_until < NOW()
        AND no_show_warned_at IS NULL
        AND reservation_date >= CURDATE() - INTERVAL 1 DAY`);

  for (const r of canhBao) {
    await db.query('UPDATE reservations SET no_show_warned_at = NOW() WHERE id = ?', [r.id]);
    realtime.doi(realtime.MIEN.DAT_BAN, {
      su_kien: 'NO_SHOW_WARNING',
      reservation_id: r.id,
      ma: r.reservation_code,
      khach: r.customer_name,
      dien_thoai: r.phone,
      gio: qt.gioNgan(String(r.start_time)),
      thong_diep: `${r.customer_name} (${qt.gioNgan(String(r.start_time))}, ${r.guest_count} khách) đã quá giờ giữ bàn`,
    });
    ketQua.canh_bao += 1;
  }

  // 2. Tu dong dong.
  if (tuDongSau > 0) {
    const [quaHan] = await db.query(
      `SELECT id FROM reservations
        WHERE status IN ('CONFIRMED','PENDING')
          AND hold_until IS NOT NULL
          AND hold_until < DATE_SUB(NOW(), INTERVAL ? MINUTE)
          AND reservation_date >= CURDATE() - INTERVAL 1 DAY`, [tuDongSau]);

    for (const r of quaHan) {
      try {
        await dv.doiTrangThai(r.id, 'NO_SHOW', {
          ghiChu: `Tự động sau ${tuDongSau} phút quá hạn giữ bàn`,
        });
        ketQua.no_show += 1;
      } catch (e) {
        // Nhan vien vua xu ly tay trong cung nhip quet - khong phai loi.
        if (e.ma !== 'BAD_TRANSITION') console.error('[dat-ban] no-show tự động lỗi:', e.message);
      }
    }
  }
  return ketQua;
}

/**
 * Coc qua han thanh toan -> tu huy, tra ban ve (BR-005).
 *
 * Chi ap cho luot dat CHUA duoc xac nhan bang duong khac. Da CONFIRMED nghia la
 * co nguoi that da dong y giu ban du chua thu tien - khong duoc phep tu huy
 * quyet dinh cua ho.
 */
async function quetCocQuaHan() {
  const [rows] = await db.query(
    `SELECT id FROM reservations
      WHERE status = 'PENDING' AND deposit_status = 'UNPAID'
        AND deposit_due_at IS NOT NULL AND deposit_due_at < NOW()
        AND deposit_amount > 0`);

  let dem = 0;
  for (const r of rows) {
    try {
      await dv.doiTrangThai(r.id, 'CANCELLED', {
        lyDo: 'Quá hạn thanh toán tiền cọc',
        boiAi: 'SYSTEM',
        ghiChu: 'Tự động hủy do chưa nhận được tiền cọc trong thời hạn',
      });
      dem += 1;
    } catch (e) {
      if (e.ma !== 'BAD_TRANSITION') console.error('[dat-ban] hủy do quá hạn cọc lỗi:', e.message);
    }
  }
  return dem;
}

/** Nhac khach truoc gio dat (mac dinh 120 phut). */
async function quetNhacLich() {
  const ch = await qt.docCauHinh();
  const truoc = Number(ch.reminder_lead_minutes) || 0;
  if (truoc <= 0) return 0;

  const [rows] = await db.query(
    `SELECT id, email FROM reservations
      WHERE status = 'CONFIRMED' AND reminder_sent_at IS NULL
        AND reservation_date = CURDATE()
        AND TIMESTAMP(reservation_date, start_time) BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? MINUTE)`,
    [truoc]);

  const conn = await db.getConnection();
  try {
    for (const r of rows) {
      await conn.query('UPDATE reservations SET reminder_sent_at = NOW() WHERE id = ?', [r.id]);
      await dv.xepThongBao(conn, {
        reservationId: r.id,
        suKien: 'RESERVATION_REMINDER',
        nguoiNhan: r.email,
        kenh: 'EMAIL',
        duLieu: { grace: ch.grace_period_minutes },
      });
    }
  } finally {
    conn.release();
  }
  return rows.length;
}

/**
 * Dong bo trang thai vat ly cua ban voi lich dat sap toi.
 *
 * Ban co luot dat bat dau trong `turnaround_minutes` toi duoc danh dau 2 (Da
 * dat truoc) de nhan vien phuc vu nhin so do la biet khong duoc xep khach vang
 * lai vao do. Va khi luot dat qua di, ban duoc tra lai 0.
 *
 * Chi dong tu 0 <-> 2. Ban dang 1 (co khach) hay 3 (dang don) thuoc luong goi
 * mon - module nay khong duoc phep ghi de.
 */
async function dongBoTrangThaiBan() {
  const ch = await qt.docCauHinh();
  const truoc = Math.max(15, Number(ch.turnaround_minutes) || 15);

  const [danhDau] = await db.query(
    `UPDATE ban SET trangthai = 2
      WHERE trangthai = 0 AND Id_ban IN (
        SELECT rt.table_id FROM reservation_tables rt JOIN reservations r ON r.id = rt.reservation_id
         WHERE r.status IN ('CONFIRMED','ARRIVED')
           AND r.reservation_date = CURDATE()
           AND TIMESTAMP(r.reservation_date, r.start_time)
               BETWEEN DATE_SUB(NOW(), INTERVAL 15 MINUTE) AND DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [truoc]);

  /*
    Tra ban ve Trong - nhung CHI nhung ban chinh module nay da danh dau.

    Dieu kien "Id_ban IN (co luot dat hom nay)" la quan trong, khong phai thua.
    Man hinh /staff/so-do-ban co nut cho nhan vien danh dau tay mot ban la "Da
    dat truoc" (khach goi dien giu cho, chua kip nhap don). Neu o day chi hoi
    "ban nao dang o trang thai 2 ma khong co luot dat sap toi" thi nhung ban do
    bi xoa nhan trong vong 60 giay - nhan vien bam nut, quay di, quay lai thay
    nhan bien mat, va khong hieu tai sao.

    Nen thu hep pham vi: chi dong den ban da tung co luot dat TRONG NGAY HOM NAY.
    Do la nhung ban chac chan do module nay dat nhan.
  */
  const [traLai] = await db.query(
    `UPDATE ban SET trangthai = 0
      WHERE trangthai = 2
        AND Id_ban IN (
          SELECT rt.table_id FROM reservation_tables rt JOIN reservations r ON r.id = rt.reservation_id
           WHERE r.reservation_date = CURDATE())
        AND Id_ban NOT IN (
          SELECT rt.table_id FROM reservation_tables rt JOIN reservations r ON r.id = rt.reservation_id
           WHERE r.status IN ('CONFIRMED','ARRIVED','SEATED')
             AND r.reservation_date = CURDATE()
             AND TIMESTAMP(r.reservation_date, r.expected_end_time) > NOW()
             AND TIMESTAMP(r.reservation_date, r.start_time) < DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [truoc]);

  return { danh_dau: danhDau.affectedRows, tra_lai: traLai.affectedRows };
}

/**
 * Don o luoi cua nhung ngay da qua tu lau.
 *
 * `reservation_slot_locks` chi co gia tri cho hien tai va tuong lai; lich su
 * nam o `reservations`. Khong don thi bang nay lon vo han va cham dan - moi
 * luot dat de lai ~9 dong, mot nha hang dong khach sinh vai tram nghin dong
 * moi nam.
 *
 * Giu lai 7 ngay de con doi chieu khi co khieu nai.
 */
async function donLuoiCu() {
  const [kq] = await db.query(
    'DELETE FROM reservation_slot_locks WHERE slot_start < DATE_SUB(CURDATE(), INTERVAL 7 DAY)');
  return kq.affectedRows;
}

// ------------------------------------------------------------- dieu phoi

/**
 * Mot nhip quet. Tach ham rieng de goi tay duoc tu route kiem tra.
 *
 * Moi buoc duoc bao trong try rieng: mot buoc hong khong duoc lam cac buoc con
 * lai khong chay. Bo quet nay ma chet lang thi khach se bi giu ban ca ngay.
 */
async function chayMotNhip() {
  const kq = {};
  const buoc = [
    ['no_show', quetNoShow],
    ['coc_qua_han', quetCocQuaHan],
    ['nhac_lich', quetNhacLich],
    ['dong_bo_ban', dongBoTrangThaiBan],
    ['thong_bao', phatThongBao],
  ];

  for (const [ten, ham] of buoc) {
    try { kq[ten] = await ham(); }
    catch (e) {
      kq[ten] = { loi: e.message };
      console.error(`[dat-ban] bước "${ten}" lỗi:`, e.message);
    }
  }

  // Don luoi cu mot lan moi ngay, vao khoang 03:00 - luc nha hang chac chan dong.
  const gio = new Date().getHours();
  if (gio === 3) {
    try { kq.don_luoi = await donLuoiCu(); }
    catch (e) { console.error('[dat-ban] dọn lưới lỗi:', e.message); }
  }
  return kq;
}

/**
 * Bat vong quet. Goi mot lan trong server.js sau khi Socket.IO da san sang.
 *
 * `unref()` de vong quet khong giu tien trinh song khi Node muon thoat - nham
 * vao truong hop chay script/test, khong phai may chu that.
 */
function batDau() {
  if (dongHo) return dongHo;
  dongHo = setInterval(async () => {
    if (dangChay) return; // Nhip truoc chua xong (CSDL cham) - bo qua nhip nay.
    dangChay = true;
    try { await chayMotNhip(); }
    finally { dangChay = false; }
  }, CHU_KY_MS);
  if (typeof dongHo.unref === 'function') dongHo.unref();

  // Chay ngay mot nhip sau 10 giay: may chu vua khoi dong lai sau mot su co co
  // the da bo lo vai chuc phut canh bao.
  setTimeout(() => { chayMotNhip().catch(() => {}); }, 10000).unref?.();

  console.log(`[dat-ban] vòng quét nền đã bật (mỗi ${CHU_KY_MS / 1000}s)`);
  return dongHo;
}

function dungLai() {
  if (dongHo) clearInterval(dongHo);
  dongHo = null;
}

module.exports = {
  CHU_KY_MS,
  batDau,
  dungLai,
  chayMotNhip,
  quetNoShow,
  quetCocQuaHan,
  quetNhacLich,
  dongBoTrangThaiBan,
  phatThongBao,
  donLuoiCu,
  soanMail,
  // Dung o script kiem tra
  _ngayCucBo: ngayCucBo,
};
