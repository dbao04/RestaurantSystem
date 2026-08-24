/**
 * Kiem tra module dat ban - chay: `npm run datban:check`
 *
 * Chia lam hai phan:
 *
 *   PHAN A - LOGIC THUAN TUY   khong can CSDL, luon chay duoc
 *   PHAN B - CSDL VA LUONG THAT can MySQL dang bat va da chay migration 030
 *
 * Phan B tao du lieu that roi DON SACH lai o cuoi (moi ban ghi tao ra deu ghi
 * ma nhan `_KIEMTRA_` va bi xoa trong khoi finally). Van khong nen chay tren
 * CSDL that dang van hanh - no se tao ra vai luot dat ma nhan vien nhin thay
 * trong khoang thoi gian script chay.
 *
 * PHEP THU QUAN TRONG NHAT: DAT TRUNG (muc B6)
 * --------------------------------------------
 * Ba lop duoc thu rieng, vi chung bao ve o ba do sau khac nhau:
 *
 *   1. Hai yeu cau cung ban cung gio, ban song song  -> ca hai bi tu choi
 *   2. Goi thang `chiemO` len o da co chu            -> RACE_LOST tu KHOA CHINH
 *   3. Luot chong lan MOT PHAN (15:00 va 16:00)      -> bi tu choi
 *
 * Phep thu 2 la quan trong nhat: no bo qua toan bo tang ung dung va hoi thang
 * CSDL. Neu no hong thi moi lop bao ve con lai chi la quy uoc lap trinh - va se
 * co ngay mot doan ma moi quen mat quy uoc do.
 */
const qt = require('../services/reservationRules');
const xb = require('../services/reservationTables');

let soDat = 0;
let soHong = 0;
const loiChiTiet = [];

function ok(ten, dieuKien, chiTiet) {
  if (dieuKien) {
    soDat += 1;
    console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  } else {
    soHong += 1;
    loiChiTiet.push(ten);
    console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  }
}

function nhom(ten) {
  console.log(`\n${ten}`);
  console.log('-'.repeat(ten.length));
}

// ===========================================================================
// PHAN A - LOGIC THUAN TUY
// ===========================================================================

function phanA() {
  nhom('A1. Lưới ô thời gian (hàng rào chống đặt trùng)');

  const o = qt.dayO('2026-08-25', '19:00:00', '21:00:00', 15);
  ok('19:00–21:00 + 15 phút dọn = 9 ô', o.length === 9, `${o.length} ô`);
  ok('Ô đầu đúng giờ bắt đầu', o[0] === '2026-08-25 19:00:00', o[0]);
  ok('Ô cuối phủ hết cả thời gian dọn', o[o.length - 1] === '2026-08-25 21:00:00', o[o.length - 1]);

  // Hai luot le nhau ve gio nhung PHAI dam vao cung o - do la muc dich cua
  // viec lam tron. Khong lam tron thi 19:07 va 19:14 sinh hai day o roi nhau.
  const a = qt.dayO('2026-08-25', '19:07:00', '20:07:00', 0);
  const b = qt.dayO('2026-08-25', '19:14:00', '20:14:00', 0);
  ok('19:07 và 19:14 cùng rơi vào ô 19:00', a[0] === b[0] && a[0] === '2026-08-25 19:00:00', a[0]);
  ok('Hai lượt lệch giờ vẫn giao nhau ở ít nhất 1 ô',
    a.some((x) => b.includes(x)), `${a.filter((x) => b.includes(x)).length} ô chung`);

  const dem = qt.dayO('2026-08-25', '23:00:00', '00:30:00', 0);
  ok('Qua nửa đêm sinh ô sang ngày hôm sau',
    dem[dem.length - 1].startsWith('2026-08-26'), dem[dem.length - 1]);

  nhom('A2. Thời lượng theo số khách');
  ok('1–2 khách → 90 phút', qt.thoiLuongMacDinh(2) === 90);
  ok('3–6 khách → 120 phút', qt.thoiLuongMacDinh(5) === 120);
  ok('7–10 khách → 150 phút', qt.thoiLuongMacDinh(9) === 150);
  ok('Trên 10 khách → 180 phút', qt.thoiLuongMacDinh(15) === 180);

  nhom('A3. Chuẩn hóa số điện thoại (khóa hồ sơ khách)');
  ok("'0918 484 042' → '0918484042'", qt.chuanHoaDienThoai('0918 484 042') === '0918484042');
  ok("'+84918484042' → '0918484042'", qt.chuanHoaDienThoai('+84918484042') === '0918484042');
  ok("'84918484042' → '0918484042'", qt.chuanHoaDienThoai('84918484042') === '0918484042');
  ok("'(091) 848-4042' → '0918484042'", qt.chuanHoaDienThoai('(091) 848-4042') === '0918484042');

  nhom('A4. Máy trạng thái');
  ok('PENDING → CONFIRMED được', qt.chuyenDuoc('PENDING', 'CONFIRMED'));
  ok('CONFIRMED → SEATED được (khách đến thẳng bàn)', qt.chuyenDuoc('CONFIRMED', 'SEATED'));
  ok('SEATED → COMPLETED được', qt.chuyenDuoc('SEATED', 'COMPLETED'));
  ok('COMPLETED không quay lại được', !qt.chuyenDuoc('COMPLETED', 'SEATED'));
  ok('CANCELLED không hồi sinh được', !qt.chuyenDuoc('CANCELLED', 'CONFIRMED'));
  ok('PENDING không nhảy thẳng sang COMPLETED', !qt.chuyenDuoc('PENDING', 'COMPLETED'));
  ok('SEATED không chuyển thành NO_SHOW (khách đang ngồi đó)', !qt.chuyenDuoc('SEATED', 'NO_SHOW'));
  ok('WAITLIST → CONFIRMED được (có bàn trống)', qt.chuyenDuoc('WAITLIST', 'CONFIRMED'));

  nhom('A5. Thuật toán ghép bàn');

  // Đúng ví dụ trong yêu cầu: 15 khách → bàn 6 + bàn 6 + bàn 4 = 16 ghế.
  const ban = [
    { id: 1, ten: 'S01', so_cho: 2, co_the_ghep: true, khu_vuc_id: 2, khu_vuc: 'Sảnh', nhom_ghep: 'KV2' },
    { id: 2, ten: 'S09', so_cho: 6, co_the_ghep: true, khu_vuc_id: 2, khu_vuc: 'Sảnh', nhom_ghep: 'KV2' },
    { id: 3, ten: 'S10', so_cho: 6, co_the_ghep: true, khu_vuc_id: 2, khu_vuc: 'Sảnh', nhom_ghep: 'KV2' },
    { id: 4, ten: 'S11', so_cho: 4, co_the_ghep: true, khu_vuc_id: 2, khu_vuc: 'Sảnh', nhom_ghep: 'KV2' },
    { id: 5, ten: 'P06', so_cho: 12, co_the_ghep: false, khu_vuc_id: 1, khu_vuc: 'VIP', nhom_ghep: 'KV1', uu_tien_vip: true },
  ];

  const pa15 = xb.timToHop(ban, 15, { choGhep: true, toiDaBan: 4, chungKhuThoi: true });
  ok('15 khách → 6+6+4 = 16 ghế', pa15.length && pa15[0].tong_cho === 16 && pa15[0].so_ban === 3,
    pa15.length ? pa15[0].ban.map((x) => x.ten).join('+') + ' = ' + pa15[0].tong_cho : 'không có');

  const pa4 = xb.timToHop(ban, 4, { choGhep: true, toiDaBan: 4, chungKhuThoi: true });
  ok('4 khách → một bàn 4 chỗ, không ghép hai bàn 2 chỗ',
    pa4[0].so_ban === 1 && pa4[0].tong_cho === 4, pa4[0].ban.map((x) => x.ten).join('+'));

  const pa8 = xb.timToHop(ban, 8, { choGhep: false, toiDaBan: 4, chungKhuThoi: true });
  ok('Tắt ghép bàn → chỉ nhận phương án một bàn',
    pa8.every((p) => p.so_ban === 1), pa8.length ? pa8[0].ban[0].ten : 'không có');

  const paVip = xb.timToHop(ban, 10, { choGhep: true, toiDaBan: 4, chungKhuThoi: false });
  ok('Bàn không ghép được (P06) không bao giờ đứng chung tổ hợp',
    paVip.every((p) => p.so_ban === 1 || !p.ban.some((x) => x.id === 5)));

  const paKhac = xb.timToHop(ban, 16, { choGhep: true, toiDaBan: 4, chungKhuThoi: true });
  ok('Bật "chỉ ghép cùng khu" → không có tổ hợp trộn hai khu',
    paKhac.every((p) => p.chung_khu), `${paKhac.length} phương án`);

  ok('Vượt sức chứa → không có phương án nào',
    xb.timToHop(ban, 200, { choGhep: true, toiDaBan: 4, chungKhuThoi: true }).length === 0);

  nhom('A6. Chấm điểm — ưu tiên ít bàn hơn ít ghế thừa');
  const motBanThua2 = xb.chamDiem([{ so_cho: 6, uu_tien_vip: false }], 4, {});
  const haiBanVuaKhit = xb.chamDiem(
    [{ so_cho: 2, uu_tien_vip: false }, { so_cho: 2, uu_tien_vip: false }], 4, {});
  ok('Một bàn 6 chỗ (thừa 2) thắng hai bàn 2 chỗ (vừa khít)',
    motBanThua2 < haiBanVuaKhit, `${motBanThua2} < ${haiBanVuaKhit}`);

  const vipDungBanVip = xb.chamDiem([{ so_cho: 6, uu_tien_vip: true }], 4, { laVip: true });
  const vipDungBanThuong = xb.chamDiem([{ so_cho: 6, uu_tien_vip: false }], 4, { laVip: true });
  ok('Khách VIP được ưu tiên bàn VIP', vipDungBanVip < vipDungBanThuong,
    `${vipDungBanVip} < ${vipDungBanThuong}`);

  const thuongDungBanVip = xb.chamDiem([{ so_cho: 6, uu_tien_vip: true }], 4, { laVip: false });
  ok('Khách thường tránh chiếm bàn VIP', thuongDungBanVip > vipDungBanThuong);

  const hopSoThich = xb.chamDiem([{ so_cho: 6, gan_cua_so: true }], 4, { soThich: ['gan_cua_so'] });
  ok('Đáp ứng sở thích được cộng điểm', hopSoThich < motBanThua2, `${hopSoThich} < ${motBanThua2}`);

  nhom('A7. Hiệu năng với 40 bàn thật');
  const ban40 = [];
  for (let i = 1; i <= 40; i += 1) {
    ban40.push({
      id: i, ten: `B${i}`, so_cho: [2, 4, 6, 8, 10, 12][i % 6], co_the_ghep: true,
      khu_vuc_id: (i % 4) + 1, khu_vuc: `K${(i % 4) + 1}`, nhom_ghep: `KV${(i % 4) + 1}`,
    });
  }
  const batDau = Date.now();
  for (const n of [2, 8, 15, 30]) xb.timToHop(ban40, n, { choGhep: true, toiDaBan: 4, chungKhuThoi: true });
  const mili = Date.now() - batDau;
  ok('Bốn lần tìm tổ hợp dưới 500ms', mili < 500, `${mili}ms`);
}

// ===========================================================================
// PHAN B - CSDL
// ===========================================================================

const NHAN = '_KIEMTRA_';
const daTao = [];

async function phanB() {
  const db = require('../config/db');
  const dv = require('../services/reservationService');
  const { ngayCucBo } = require('../utils/thoiGian');

  nhom('B1. Lược đồ cơ sở dữ liệu');
  const bangCan = ['reservations', 'reservation_tables', 'reservation_slot_locks',
    'reservation_history', 'reservation_deposits', 'reservation_settings',
    'reservation_customers', 'reservation_opening_hours', 'reservation_closed_dates',
    'reservation_deposit_rules', 'reservation_status_catalog', 'table_status_catalog',
    'reservation_tag_catalog', 'cancellation_policies'];
  const [bang] = await db.query(
    'SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)',
    [bangCan]);
  const coBang = new Set(bang.map((r) => r.t));
  for (const b of bangCan) ok(`Bảng ${b}`, coBang.has(b));

  const [khoa] = await db.query(
    `SELECT COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation_slot_locks'
        AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION`);
  ok('Khóa chính (table_id, slot_start) — hàng rào chống đặt trùng',
    khoa.map((r) => r.c).join(',') === 'table_id,slot_start', khoa.map((r) => r.c).join(','));

  const [cot] = await db.query(
    `SELECT COLUMN_NAME c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ban'
        AND COLUMN_NAME IN ('cho_dat_truoc','co_the_ghep','gan_cua_so','yen_tinh','phong_rieng','xe_lan','uu_tien_vip','nhom_ghep')`);
  ok('Bàn có đủ 8 thuộc tính đặt bàn', cot.length === 8, `${cot.length}/8`);

  nhom('B2. Cấu hình');
  const cf = await qt.docCauHinh();
  ok('Đọc được cấu hình', !!cf.grace_period_minutes, `giữ bàn ${cf.grace_period_minutes} phút`);
  ok('Thời gian dọn bàn > 0 (chống hai lượt sát nhau)', Number(cf.turnaround_minutes) > 0,
    `${cf.turnaround_minutes} phút`);
  const lich = await qt.lichMoCua(ngayCucBo());
  ok('Đọc được lịch mở cửa hôm nay', lich.dong || (!!lich.mo && !!lich.dong_cua),
    lich.dong ? lich.lyDo : `${qt.gioNgan(lich.mo)}–${qt.gioNgan(lich.dong_cua)}`);

  nhom('B3. Bàn và khu vực');
  const dsKhu = await xb.docKhuVuc();
  ok('Có ít nhất một khu vực nhận đặt trước', dsKhu.length > 0, `${dsKhu.length} khu vực`);
  const dsBan = await xb.docBan();
  ok('Có bàn nhận đặt trước', dsBan.length > 0, `${dsBan.length} bàn · ${dsBan.reduce((s, b) => s + b.so_cho, 0)} chỗ`);
  ok('Bàn có tọa độ để vẽ sơ đồ',
    dsBan.some((b) => b.x > 0 || b.y > 0),
    `${dsBan.filter((b) => b.x > 0 || b.y > 0).length} bàn đã có tọa độ`);

  // Ngay thu: 3 ngay nua, gio 15:00 - xa gio cao diem de it dung do voi du lieu that.
  const ngayThu = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return ngayCucBo(d);
  })();

  nhom(`B4. Kiểm tra khả dụng (${ngayThu} 15:00)`);
  let kha;
  try {
    kha = await dv.kiemTraKhaDung({
      reservation_date: ngayThu, start_time: '15:00', guest_count: 2,
    }, { laOnline: false });
    ok('Gọi được kiểm tra khả dụng', true,
      kha.con_ban ? `còn bàn: ${kha.goi_y.ban.map((b) => b.ten).join(', ')}` : 'hết bàn');
    ok('Có tính tiền cọc', kha.coc !== undefined, kha.coc.lyDo);
  } catch (e) {
    ok('Gọi được kiểm tra khả dụng', false, e.message);
    return;
  }
  if (!kha.con_ban) {
    console.log('  ! Không còn bàn trống — bỏ qua các phép thử ghi.');
    return;
  }

  nhom('B5. Vòng đời một lượt đặt');
  const kq = await dv.taoLuotDat({
    customer_name: `${NHAN} Khách thử`, phone: '0900000001',
    reservation_date: ngayThu, start_time: '15:00', guest_count: 2, source: 'STAFF',
    notes: `${NHAN} script kiểm tra`,
  }, { laNhanVien: true, nhanVienId: null });
  daTao.push(kq.id);
  ok('Tạo được lượt đặt', !!kq.id, `${kq.ma} · bàn ${kq.ban.map((b) => b.ten).join(', ')}`);
  ok('Nhân viên tạo → vào thẳng CONFIRMED', kq.trang_thai === 'CONFIRMED', kq.trang_thai);

  const [oDaChiem] = await db.query(
    'SELECT COUNT(*) n FROM reservation_slot_locks WHERE reservation_id = ?', [kq.id]);
  ok('Đã chiếm ô lưới', Number(oDaChiem[0].n) > 0, `${oDaChiem[0].n} ô`);

  const ct = await dv.chiTiet(kq.id);
  ok('Có ghi nhật ký lúc tạo', ct.nhat_ky.length > 0, ct.nhat_ky[0].note);
  ok('Đã cập nhật hồ sơ khách', !!ct.ho_so_khach && !ct.ho_so_khach.la_khach_moi);

  nhom('B6. Chống đặt trùng (phép thử quan trọng nhất)');
  const banDaChiem = kq.ban.map((b) => b.id);
  const [thu1, thu2] = await Promise.allSettled([
    dv.taoLuotDat({
      customer_name: `${NHAN} Đua 1`, phone: '0900000002', reservation_date: ngayThu,
      start_time: '15:00', guest_count: 2, table_ids: banDaChiem, source: 'STAFF',
    }, { laNhanVien: true }),
    dv.taoLuotDat({
      customer_name: `${NHAN} Đua 2`, phone: '0900000003', reservation_date: ngayThu,
      start_time: '15:00', guest_count: 2, table_ids: banDaChiem, source: 'STAFF',
    }, { laNhanVien: true }),
  ]);
  for (const t of [thu1, thu2]) if (t.status === 'fulfilled') daTao.push(t.value.id);
  const soThanhCong = [thu1, thu2].filter((t) => t.status === 'fulfilled').length;
  ok('Hai yêu cầu cùng bàn cùng giờ → cả hai đều bị từ chối', soThanhCong === 0,
    [thu1, thu2].map((t) => t.status === 'rejected' ? t.reason.ma : 'TẠO ĐƯỢC(!)').join(' / '));

  /*
    Phep thu HANG RAO CSDL, khong qua tang ung dung.

    Hai phep thu tren deu bi tang ung dung chan truoc (`TABLE_TAKEN`) - dung, nhung
    chua chung minh duoc dieu quan trong nhat: neu tang ung dung SAI thi CSDL co
    con chan khong. O day goi thang `chiemO` tren mot ban da co chu, trong mot
    transaction rieng. Ket qua dung la RACE_LOST - tuc khoa chinh (table_id,
    slot_start) da tra ve ER_DUP_ENTRY.

    Neu phep thu nay hong thi moi lop bao ve con lai chi la quy uoc lap trinh.
  */
  const khungThu = qt.phanTichKhungGio({
    reservation_date: ngayThu, start_time: '15:00', guest_count: 2,
  }, await qt.docCauHinh());

  const connThu = await db.getConnection();
  let maHangRao = null;
  try {
    await connThu.beginTransaction();
    // Muon tam id cua chinh reservation vua tao lam khoa ngoai; day la lan chiem
    // THU HAI tren cung cap (ban, o) nen phai bi khoa chinh chan lai.
    await xb.chiemO(connThu, kq.id, banDaChiem, khungThu);
    maHangRao = 'GHI DUOC(!)';
    await connThu.rollback();
  } catch (e) {
    maHangRao = e.ma || e.code || e.message;
    await connThu.rollback().catch(() => {});
  } finally {
    connThu.release();
  }
  ok('Ghi đè ô lưới bị khóa chính chặn (hàng rào CSDL)',
    maHangRao === 'RACE_LOST', maHangRao);

  // Chong len MOT PHAN: 15:00-16:30 va 16:00-17:30 giao nhau o cac o 16:00-16:30.
  let chongMotPhan = null;
  try {
    const r = await dv.taoLuotDat({
      customer_name: `${NHAN} Chồng lấn`, phone: '0900000004', reservation_date: ngayThu,
      start_time: '16:00', guest_count: 2, table_ids: banDaChiem, source: 'STAFF',
    }, { laNhanVien: true });
    daTao.push(r.id);
    chongMotPhan = 'TẠO ĐƯỢC(!)';
  } catch (e) { chongMotPhan = e.ma; }
  ok('Lượt chồng lấn một phần cũng bị chặn',
    chongMotPhan !== 'TẠO ĐƯỢC(!)', chongMotPhan);

  nhom('B7. Chuyển trạng thái và hoàn tiền');
  await dv.doiTrangThai(kq.id, 'ARRIVED', { ghiChu: `${NHAN}` });
  await dv.doiTrangThai(kq.id, 'SEATED', { ghiChu: `${NHAN}` });
  const sauKhiNgoi = await dv.chiTiet(kq.id);
  ok('CONFIRMED → ARRIVED → SEATED', sauKhiNgoi.status === 'SEATED');
  ok('Đã ghi mốc thời gian khách đến', !!sauKhiNgoi.arrived_at);
  ok('Hết hạn giữ bàn khi khách đã ngồi', sauKhiNgoi.hold_until === null);

  let chanSai = null;
  try { await dv.doiTrangThai(kq.id, 'NO_SHOW', {}); chanSai = 'CHO PHÉP(!)'; }
  catch (e) { chanSai = e.ma; }
  ok('Không cho NO_SHOW khi khách đang ngồi', chanSai === 'BAD_TRANSITION', chanSai);

  await dv.doiTrangThai(kq.id, 'COMPLETED', { ghiChu: `${NHAN}` });
  ok('SEATED → COMPLETED', (await dv.chiTiet(kq.id)).status === 'COMPLETED');

  nhom('B7b. Khách vãng lai (walk-in)');
  /*
    Walk-in la duong de vo nhat: gio bat dau bi lam tron XUONG dau o luoi, nen
    ngay khi tao no da nam trong qua khu vai phut. Ban dau tien cua module chan
    dung truong hop nay bang IN_PAST - loi chi lo ra khi thu that qua HTTP.
  */
  let walkIn = null;
  try {
    walkIn = await dv.taoWalkIn({
      customer_name: `${NHAN} Vãng lai`, phone: '0900000005', guest_count: 2,
    }, { nhanVienId: null });
    daTao.push(walkIn.id);
  } catch (e) {
    walkIn = { loi: e.ma || e.message };
  }
  ok('Tạo được khách vãng lai', !!walkIn.id, walkIn.id ? `${walkIn.ma} · ${walkIn.trang_thai}` : walkIn.loi);
  ok('Walk-in vào thẳng trạng thái đã xếp bàn',
    walkIn.trang_thai === 'SEATED', walkIn.trang_thai || '—');
  ok('Walk-in được gán bàn ngay',
    !!(walkIn.ban && walkIn.ban.length), walkIn.ban ? walkIn.ban.map((b) => b.ten).join(', ') : '—');

  nhom('B8. Báo cáo');
  const bang2 = await dv.bangDieuKhien(ngayThu);
  ok('Bảng điều khiển chạy được', typeof bang2.tong_luot === 'number',
    `${bang2.tong_luot} lượt · lấp đầy ${bang2.ty_le_lap_day}%`);
  const tl = await dv.duongThoiGian(ngayThu);
  ok('Đường thời gian chạy được', Array.isArray(tl.hang), `${tl.hang.length} hàng bàn`);
  const pt = await dv.phanTich(ngayThu, ngayThu);
  ok('Phân tích chạy được', !!pt.tong_quan, `${pt.tong_quan.tong} lượt trong khoảng`);
  const sd = await xb.soDoBan({ ngay: ngayThu, gio: '15:00', choKhach: true });
  ok('Sơ đồ bàn cho khách chạy được', Array.isArray(sd.ban), `${sd.ban.length} bàn`);
  ok('Sơ đồ cho khách KHÔNG kèm thông tin khách khác',
    sd.ban.every((b) => b.reservation === null));
  const sdNv = await xb.soDoBan({ ngay: ngayThu, gio: '15:00', choKhach: false });
  ok('Sơ đồ cho nhân viên có kèm lượt đặt',
    sdNv.ban.some((b) => b.reservation !== null) || bang2.tong_luot === 0);

  nhom('B9. Vòng quét nền không phá dữ liệu của màn hình khác');
  /*
    Nhan vien danh dau tay mot ban la "Da dat truoc" tren /staff/so-do-ban (khach
    goi dien giu cho, chua kip nhap don). Vong quet dong bo trang thai ban KHONG
    duoc phep xoa nhan do.

    Ban dau tien cua vong quet xoa - va no xoa toan bo nhan danh dau tay cua ca
    nha hang trong vong 60 giay. Phep thu nay giu cho loi do khong quay lai.
  */
  const [truocQuet] = await db.query('SELECT Id_ban, number_ban FROM ban WHERE trangthai = 2');
  const jobs = require('../services/reservationJobs');
  await jobs.dongBoTrangThaiBan();
  await jobs.dongBoTrangThaiBan();
  const [sauQuet] = await db.query('SELECT Id_ban FROM ban WHERE trangthai = 2');
  const conDu = truocQuet.every((b) => sauQuet.some((x) => x.Id_ban === b.Id_ban));
  ok('Nhãn "Đã đặt trước" đánh dấu tay sống sót qua vòng quét',
    conDu, `${truocQuet.length} bàn trước → ${sauQuet.length} bàn sau`);

  const nhip = await jobs.chayMotNhip();
  ok('Chạy trọn một nhịp quét không lỗi',
    !Object.values(nhip).some((v) => v && v.loi),
    Object.entries(nhip).map(([k, v]) => `${k}:${v && v.loi ? 'LỖI' : 'ok'}`).join(' '));
}

async function donDep() {
  if (!daTao.length) return;
  const db = require('../config/db');
  console.log(`\nDọn ${daTao.length} bản ghi thử…`);
  /*
    Tra trang thai vat ly cua ban ve Trong TRUOC khi xoa reservation.

    Xep khach vao ban (SEATED) dat `ban.trangthai = 1`, va hoan tat (COMPLETED)
    doi tiep thanh 3 (Dang don). Xoa dong reservation khong tu dong hoan tac hai
    buoc do - mot ban ket o "Dang phuc vu" hay "Dang don" ma khong co don nao la
    thu nhan vien phai vao so do go tay.

    Phai lam TRUOC khi xoa: sau khi xoa thi `reservation_tables` da bi CASCADE
    cuon theo, khong con duong nao lan ra cac ban lien quan nua.

    Bao gom ca 3, khong chi 1 va 2 - ban dau tien cua doan don nay bo sot trang
    thai 3 va de lai dung mot ban ket sau moi lan chay.
  */
  await db.query(
    `UPDATE ban SET trangthai = 0
      WHERE trangthai IN (1, 2, 3)
        AND Id_ban IN (SELECT table_id FROM reservation_tables WHERE reservation_id IN (?))`,
    [daTao]);
  // ON DELETE CASCADE lo cac bang con (slot_locks, tables, history, deposits).
  await db.query('DELETE FROM reservations WHERE id IN (?)', [daTao]);
  await db.query('DELETE FROM reservation_notifications WHERE reservation_id IN (?)', [daTao]);
  /*
    Xoa theo MAU so, khong theo danh sach liet ke.

    Ban dau doan nay liet ke tay bon so 0900000001-04. Khi phep thu walk-in duoc
    them vao (dung 0900000005) thi danh sach khong con day du, va moi lan chay
    lai de sot mot ho so khach trong CSDL that. Danh sach cung phai duoc nho ma
    cap nhat; mot mau so thi khong.
  */
  await db.query("DELETE FROM reservation_customers WHERE phone LIKE '09000000%'");
  console.log('Đã dọn xong.');
}

// ===========================================================================

async function main() {
  console.log('========================================');
  console.log('  KIỂM TRA MODULE ĐẶT BÀN');
  console.log('========================================');

  console.log('\n### PHẦN A — LOGIC THUẦN TÚY (không cần CSDL)');
  phanA();

  console.log('\n\n### PHẦN B — CƠ SỞ DỮ LIỆU');
  let coDb = true;
  try {
    const db = require('../config/db');
    await db.query('SELECT 1');
  } catch (e) {
    coDb = false;
    console.log(`\n  ! Không kết nối được MySQL (${e.code || e.message}).`);
    console.log('    Bật MySQL rồi chạy lại để kiểm tra phần này.');
  }

  if (coDb) {
    try { await phanB(); }
    catch (e) {
      soHong += 1;
      loiChiTiet.push(`Phần B dừng giữa chừng: ${e.message}`);
      console.log(`\n  ✗ Phần B dừng: ${e.message}`);
      if (e.ma === undefined) console.log(e.stack);
    } finally {
      try { await donDep(); } catch (e) { console.log(`  ! Dọn dẹp lỗi: ${e.message}`); }
      await require('../config/db').end().catch(() => {});
    }
  }

  console.log('\n========================================');
  console.log(`  ĐẠT ${soDat} · HỎNG ${soHong}`);
  if (soHong) {
    console.log('\n  Các mục hỏng:');
    for (const l of loiChiTiet) console.log(`    - ${l}`);
  }
  console.log('========================================');
  process.exitCode = soHong ? 1 : 0;
}

if (require.main === module) main();
module.exports = { phanA };
