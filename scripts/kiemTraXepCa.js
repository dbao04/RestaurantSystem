/**
 * Kiem thu thuat toan xep ca - chay bang du lieu tu dat ra, khong dung CSDL.
 *
 * Thuat toan xep ca la loai ma nhin vao thi thay dung nhung sai rat kin: chia
 * lech vai ca giua nguoi nay voi nguoi kia, hay xep mot nguoi lam ca toi roi
 * ca sang hom sau, deu khong lo ra khi bam thu vai lan tren giao dien. Nen moi
 * rang buoc o day co mot phep thu rieng.
 *
 * Chay:  npm run xepca:test
 */
const { xepCa, dsNgay, thuHaiCuaTuan, ngayISO } = require('../services/xepCa');

/**
 * Ngay hom sau cua `ngay`.
 *
 * Phai dung `ngayISO` chu tuyet doi khong dung `toISOString()`: Date tao tu
 * chuoi 'YYYY-MM-DDT00:00:00' la gio DIA PHUONG, con `toISOString` doi sang
 * UTC. O mui gio +07 thi nua dem 17/08 tro thanh 16/08 theo UTC - phep kiem tra
 * se so sanh nham ngay va bao DAT trong khi khong he kiem tra dung thu can
 * kiem tra.
 */
function homSau(ngay) {
  const d = new Date(ngay + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return ngayISO(d);
}

function homTruoc(ngay) {
  const d = new Date(ngay + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return ngayISO(d);
}

let soDat = 0;
let soHong = 0;

function dat(ten, dieuKien, chiTiet) {
  if (dieuKien) {
    soDat += 1;
    console.log(`  [OK]  ${ten}`);
  } else {
    soHong += 1;
    console.log(`  [HỎNG] ${ten}`);
    if (chiTiet !== undefined) console.log('        ' + JSON.stringify(chiTiet));
  }
}

const CA = [
  { ma_ca: 'sang',  ten_ca: 'Ca sáng',  gio_bat_dau: '07:00:00', gio_ket_thuc: '12:00:00', thu_tu: 1 },
  { ma_ca: 'chieu', ten_ca: 'Ca chiều', gio_bat_dau: '12:00:00', gio_ket_thuc: '17:00:00', thu_tu: 2 },
  { ma_ca: 'toi',   ten_ca: 'Ca tối',   gio_bat_dau: '17:00:00', gio_ket_thuc: '21:00:00', thu_tu: 3 },
];

/** Tuan bat dau thu Hai 17/08/2026 cho moi phep thu deu co moc co dinh. */
const TUAN = dsNgay('2026-08-17', '2026-08-23');

function nhanVien(n, chucvu = 'Phuc vu') {
  return Array.from({ length: n }, (_, i) => ({
    id_nv: i + 1,
    ten: `NV${i + 1}`,
    chucvu,
  }));
}

/** Dinh muc giong nhau moi ngay. */
function dinhMucDeu(ma_ca, chucvu, so_luong) {
  return Array.from({ length: 7 }, (_, thu) => ({ thu, ma_ca, chucvu, so_luong }));
}

console.log('\n=== Kiểm thử thuật toán xếp ca ===\n');

// ---------------------------------------------------------------- 1
console.log('1. Phủ đủ định mức khi thừa người');
{
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: dinhMucDeu('toi', 'Phuc vu', 1),
    nhanVien: nhanVien(7),
    nghiPhep: [], daDangKy: [], caTruocKhoang: [],
  });
  dat('xếp đủ 7 ca', kq.phanCa.length === 7, kq.thongKe);
  dat('không báo thiếu', kq.thieu.length === 0, kq.thieu);
}

// ---------------------------------------------------------------- 2
console.log('\n2. Chia đều giữa các nhân viên');
{
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: dinhMucDeu('toi', 'Phuc vu', 2),   // 14 lượt
    nhanVien: nhanVien(7),                       // 7 người -> mỗi người 2
    nghiPhep: [], daDangKy: [], caTruocKhoang: [],
  });
  const soCa = kq.thongKe.theo_nguoi.map((x) => x.so_ca);
  const chenh = Math.max(...soCa) - Math.min(...soCa);
  dat('xếp đủ 14 lượt', kq.phanCa.length === 14, kq.thongKe);
  dat('chênh lệch giữa người nhiều nhất và ít nhất ≤ 1', chenh <= 1, soCa);
  dat('không ai bị bỏ quên', soCa.every((n) => n > 0), soCa);
}

// ---------------------------------------------------------------- 3
console.log('\n3. Không xếp người đang nghỉ phép');
{
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: dinhMucDeu('toi', 'Phuc vu', 1),
    nhanVien: nhanVien(3),
    nghiPhep: [{ id_nv: 1, tu_ngay: '2026-08-17', den_ngay: '2026-08-19' }],
    daDangKy: [], caTruocKhoang: [],
  });
  const viPham = kq.phanCa.filter(
    (p) => p.id_nv === 1 && p.ngay >= '2026-08-17' && p.ngay <= '2026-08-19'
  );
  dat('NV1 không bị xếp trong 3 ngày nghỉ', viPham.length === 0, viPham);
  dat('các ca đó vẫn có người khác', kq.phanCa.length === 7, kq.thongKe);
}

// ---------------------------------------------------------------- 4
console.log('\n4. Tôn trọng ca nhân viên tự đăng ký');
{
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: dinhMucDeu('toi', 'Phuc vu', 1),
    nhanVien: nhanVien(7),
    nghiPhep: [],
    // NV7 nằm cuối danh sách, không có điểm ưu tiên nào khác.
    daDangKy: [{ id_nv: 7, ngay: '2026-08-20', ca: 'toi' }],
    caTruocKhoang: [],
  });
  const o = kq.phanCa.find((p) => p.ngay === '2026-08-20' && p.ca === 'toi');
  dat('ca đã đăng ký được giao đúng người', o && o.id_nv === 7, o);
  dat('được đánh dấu là do đăng ký', o && o.tu_dang_ky === true, o);
}

// ---------------------------------------------------------------- 5
console.log('\n5. Nghỉ tối thiểu giữa hai ca (ca tối → ca sáng hôm sau)');
{
  // Hai nguoi, moi ngay can mot ca sang va mot ca toi. Ai lam ca toi hom nay
  // thi hom sau khong duoc lam ca sang (21h -> 7h chi cach 10 tieng), nen buoc
  // phai doi vai cho nhau. Cac tran khac duoc nang len de co lap dung rang buoc
  // nghi giua hai ca - neu de tran 6 ca/tuan thi thuat toan het nguoi truoc khi
  // kip sinh ra tinh huong can kiem tra.
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: [...dinhMucDeu('toi', 'Phuc vu', 1), ...dinhMucDeu('sang', 'Phuc vu', 1)],
    nhanVien: nhanVien(2),
    nghiPhep: [], daDangKy: [], caTruocKhoang: [],
  }, { soCaToiDaTuan: 99, soNgayLienTiepToiDa: 99 });
  let viPham = 0;
  for (const p of kq.phanCa) {
    if (p.ca !== 'sang') continue;
    const truoc = homTruoc(p.ngay);
    if (kq.phanCa.some((q) => q.id_nv === p.id_nv && q.ngay === truoc && q.ca === 'toi')) viPham += 1;
  }
  dat('không có cặp ca tối → ca sáng hôm sau', viPham === 0, { viPham });
  // Phai co ca sang lan ca toi trong ket qua, khong thi phep thu tren dung vi
  // khong co gi de doi chieu chu khong phai vi thuat toan lam dung.
  dat('kết quả có cả ca sáng và ca tối để đối chiếu',
    kq.phanCa.some((p) => p.ca === 'sang') && kq.phanCa.some((p) => p.ca === 'toi'),
    kq.thongKe);
}

// ---------------------------------------------------------------- 6
console.log('\n6. Báo thiếu khi không đủ người, không tự hạ định mức');
{
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: dinhMucDeu('toi', 'Phuc vu', 3),   // cần 21 lượt
    nhanVien: nhanVien(2),                       // 2 người, tối đa 6 ca/tuần
    nghiPhep: [], daDangKy: [], caTruocKhoang: [],
  });
  dat('có báo thiếu', kq.thieu.length > 0, kq.thieu.length);
  dat('không xếp quá số ca tối đa mỗi người',
    kq.thongKe.theo_nguoi.every((x) => x.so_ca <= 6), kq.thongKe.theo_nguoi);
  dat('tổng đã xếp + thiếu = tổng cần',
    kq.thongKe.da_xep + kq.thongKe.thieu === kq.thongKe.tong_can, kq.thongKe);
}

// ---------------------------------------------------------------- 7
console.log('\n7. Giới hạn số ngày làm liên tiếp');
{
  const kq = xepCa({
    ngayList: dsNgay('2026-08-17', '2026-08-30'),   // 14 ngày
    caList: CA,
    dinhMuc: dinhMucDeu('toi', 'Phuc vu', 1),
    nhanVien: nhanVien(2),
    nghiPhep: [], daDangKy: [], caTruocKhoang: [],
  }, { soCaToiDaTuan: 99 });                         // bỏ trần tuần để cô lập ràng buộc này

  const theoNguoi = {};
  for (const p of kq.phanCa) (theoNguoi[p.id_nv] = theoNguoi[p.id_nv] || []).push(p.ngay);

  let maxChuoi = 0;
  for (const ds of Object.values(theoNguoi)) {
    ds.sort();
    let chuoi = 1;
    maxChuoi = Math.max(maxChuoi, 1);
    for (let i = 1; i < ds.length; i++) {
      chuoi = homSau(ds[i - 1]) === ds[i] ? chuoi + 1 : 1;
      maxChuoi = Math.max(maxChuoi, chuoi);
    }
  }
  dat('không ai làm quá 6 ngày liên tiếp', maxChuoi <= 6, { maxChuoi });
  // Neu chuoi dai nhat chi la 1 thi phep thu tren khong chung minh duoc gi -
  // 14 ngay voi 2 nguoi phai sinh ra chuoi nhieu ngay lien tiep.
  dat('có phát sinh chuỗi ngày liên tiếp để kiểm tra', maxChuoi >= 2, { maxChuoi });
}

// ---------------------------------------------------------------- 8
console.log('\n8. Không lẫn chức vụ');
{
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: [...dinhMucDeu('toi', 'Phuc vu', 1), ...dinhMucDeu('toi', 'Bep', 1)],
    nhanVien: [...nhanVien(3, 'Phuc vu'), { id_nv: 90, ten: 'Bếp A', chucvu: 'Bep' }],
    nghiPhep: [], daDangKy: [], caTruocKhoang: [],
  });
  const lan = kq.phanCa.filter((p) =>
    (p.chucvu === 'Bep' && p.id_nv !== 90) || (p.chucvu === 'Phuc vu' && p.id_nv === 90));
  dat('mỗi ca được giao đúng chức vụ', lan.length === 0, lan);
}

// ---------------------------------------------------------------- 9
console.log('\n9. Cùng dữ liệu vào cho cùng kết quả (không dùng số ngẫu nhiên)');
{
  const dl = () => ({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: dinhMucDeu('toi', 'Phuc vu', 2),
    nhanVien: nhanVien(5),
    nghiPhep: [], daDangKy: [], caTruocKhoang: [],
  });
  const a = JSON.stringify(xepCa(dl()).phanCa);
  const b = JSON.stringify(xepCa(dl()).phanCa);
  dat('chạy hai lần ra kết quả giống hệt', a === b);
}

// ---------------------------------------------------------------- 10
console.log('\n10. Nối tiếp tuần trước (ràng buộc vắt qua ranh giới tuần)');
{
  // Chu nhat 16/08 NV1 lam ca toi. Thu Hai 17/08 ca sang khong duoc la NV1.
  const kq = xepCa({
    ngayList: TUAN,
    caList: CA,
    dinhMuc: dinhMucDeu('sang', 'Phuc vu', 1),
    nhanVien: nhanVien(2),
    nghiPhep: [], daDangKy: [],
    caTruocKhoang: [{ id_nv: 1, ngay: '2026-08-16', ca: 'toi' }],
  });
  const thuHai = kq.phanCa.find((p) => p.ngay === '2026-08-17');
  dat('không xếp người vừa làm ca tối Chủ nhật', thuHai && thuHai.id_nv !== 1, thuHai);
}

// ---------------------------------------------------------------- 11
console.log('\n11. Hàm phụ trợ');
{
  dat('thuHaiCuaTuan của thứ Tư 19/08/2026', thuHaiCuaTuan('2026-08-19') === '2026-08-17');
  dat('thuHaiCuaTuan của Chủ nhật 23/08/2026', thuHaiCuaTuan('2026-08-23') === '2026-08-17');
  dat('dsNgay đủ 7 ngày', dsNgay('2026-08-17', '2026-08-23').length === 7);
}

console.log(`\n=== ${soDat} đạt, ${soHong} hỏng ===\n`);
process.exit(soHong > 0 ? 1 : 0);
