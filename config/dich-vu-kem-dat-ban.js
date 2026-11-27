/**
 * Dich vu kem theo khi DAT BAN - hien ngay duoi the "Dip dac biet / yeu cau rieng"
 * khach vua tich (buoc Thong tin, trang /datban).
 *
 * Moi muc:
 *   ma        : ma duy nhat (luu vao reservations.dich_vu_kem)
 *   ten       : ten hien cho khach
 *   gia       : don gia (0 = mien phi - chi de nha hang chuan bi)
 *   don_vi    : 'lan' (tinh 1 lan) | 'khach' (x so khach) | 'cai' (khach chon so luong)
 *   nhom      : cac muc cung nhom chi chon duoc 1 (vd. co banh kem)
 *   toi_da    : so luong toi da khi don_vi = 'cai'
 *
 * Tien dich vu duoc THANH TOAN TRUOC cung tien coc / mon dat truoc, va KHONG
 * tru vao tien mon luc tinh hoa don tai ban (xem thanhToanService: tienDaCoc
 * tru di dich_vu_kem_tong). Gia do may chu tinh lai tu file nay, khong tin gia client.
 */
const DANH_MUC = {
  BIRTHDAY: [
    { ma: 'SN_BANH_16', ten: 'Bánh kem sinh nhật 16cm (4–6 người)', gia: 350000, don_vi: 'lan', nhom: 'banh' },
    { ma: 'SN_BANH_20', ten: 'Bánh kem sinh nhật 20cm (8–10 người)', gia: 480000, don_vi: 'lan', nhom: 'banh' },
    { ma: 'SN_BONG_BAY', ten: 'Trang trí bàn bóng bay & dây chữ Happy Birthday', gia: 250000, don_vi: 'lan' },
    { ma: 'SN_NEN_NHAC', ten: 'Tắt đèn, nến & nhạc chúc mừng khi ra bánh', gia: 0, don_vi: 'lan' },
    { ma: 'SN_THIEP', ten: 'Thiệp chúc mừng viết tay', gia: 30000, don_vi: 'lan' },
  ],
  ANNIVERSARY: [
    { ma: 'KN_HOA', ten: 'Bó hoa hồng tươi', gia: 350000, don_vi: 'lan' },
    { ma: 'KN_NEN', ten: 'Nến & cánh hoa trang trí bàn', gia: 200000, don_vi: 'lan' },
    { ma: 'KN_VANG', ten: 'Rượu vang đỏ chúc mừng (chai)', gia: 650000, don_vi: 'cai', toi_da: 6 },
    { ma: 'KN_BANH', ten: 'Bánh kem kỷ niệm 16cm', gia: 350000, don_vi: 'lan' },
  ],
  PROPOSAL: [
    { ma: 'CH_SETUP', ten: 'Gói setup cầu hôn (hoa, nến, chữ "Marry me")', gia: 1500000, don_vi: 'lan' },
    { ma: 'CH_HOA', ten: 'Bó 99 hoa hồng', gia: 1200000, don_vi: 'lan' },
    { ma: 'CH_VIOLIN', ten: 'Nghệ sĩ violin biểu diễn (2 bài)', gia: 800000, don_vi: 'lan' },
    { ma: 'CH_ANH', ten: 'Chụp ảnh khoảnh khắc (30 phút)', gia: 500000, don_vi: 'lan' },
  ],
  CORPORATE: [
    { ma: 'CT_MAY_CHIEU', ten: 'Máy chiếu / màn hình trình chiếu', gia: 500000, don_vi: 'lan' },
    { ma: 'CT_MICRO', ten: 'Micro & loa phát biểu', gia: 300000, don_vi: 'lan' },
    { ma: 'CT_BANG_TEN', ten: 'Bảng tên công ty trên bàn', gia: 200000, don_vi: 'lan' },
    { ma: 'CT_NUOC', ten: 'Nước ngọt không giới hạn', gia: 60000, don_vi: 'khach' },
  ],
  KIDS: [
    { ma: 'TE_GHE', ten: 'Ghế ăn trẻ em', gia: 0, don_vi: 'cai', toi_da: 6 },
    { ma: 'TE_TO_MAU', ten: 'Bộ tô màu & đồ chơi nhỏ', gia: 0, don_vi: 'cai', toi_da: 6 },
    { ma: 'TE_SUAT', ten: 'Suất ăn trẻ em (cơm cá hồi, súp, nước ép)', gia: 120000, don_vi: 'cai', toi_da: 10 },
  ],
  ELDERLY: [
    { ma: 'NLT_MON_MEM', ten: 'Chế biến món mềm, ít muối', gia: 0, don_vi: 'lan' },
    { ma: 'NLT_GHE', ten: 'Ghế có tay vịn, chỗ ngồi gần lối đi', gia: 0, don_vi: 'lan' },
  ],
  WHEELCHAIR: [
    { ma: 'XL_LOI_DI', ten: 'Bàn sát lối đi, bỏ bớt ghế cho xe lăn', gia: 0, don_vi: 'lan' },
  ],
  ALLERGY: [
    { ma: 'DU_HAI_SAN', ten: 'Dị ứng hải sản có vỏ (tôm, cua, sò)', gia: 0, don_vi: 'lan' },
    { ma: 'DU_CA_SONG', ten: 'Không ăn cá sống (sashimi)', gia: 0, don_vi: 'lan' },
    { ma: 'DU_DAU_PHONG', ten: 'Dị ứng đậu phộng / các loại hạt', gia: 0, don_vi: 'lan' },
    { ma: 'DU_GLUTEN', ten: 'Không dùng gluten (bột mì)', gia: 0, don_vi: 'lan' },
    { ma: 'DU_SUA', ten: 'Không dùng sữa / trứng', gia: 0, don_vi: 'lan' },
  ],
};

const THEO_MA = {};
for (const [the, ds] of Object.entries(DANH_MUC)) for (const m of ds) THEO_MA[m.ma] = { ...m, the };

/**
 * Chuan hoa lua chon cua khach.
 *   dsThe   : cac the khach da tich (chi nhan dich vu thuoc the da tich)
 *   chon    : [{ ma, so_luong }]
 *   soKhach : de tinh muc don_vi = 'khach'
 * Tra ve { ds: [...], tong }.
 */
function tinh(dsThe, chon, soKhach) {
  const coThe = new Set((dsThe || []).map(String));
  const daNhom = new Set();
  const ds = [];
  for (const c of Array.isArray(chon) ? chon : []) {
    const m = THEO_MA[String(c && c.ma)];
    if (!m || !coThe.has(m.the) || ds.some((x) => x.ma === m.ma)) continue;
    if (m.nhom) { if (daNhom.has(m.the + m.nhom)) continue; daNhom.add(m.the + m.nhom); }
    let sl = 1;
    if (m.don_vi === 'cai') sl = Math.min(m.toi_da || 10, Math.max(1, Math.floor(Number(c.so_luong) || 1)));
    if (m.don_vi === 'khach') sl = Math.max(1, Math.floor(Number(soKhach) || 1));
    ds.push({ ma: m.ma, the: m.the, ten: m.ten, gia: m.gia, don_vi: m.don_vi, so_luong: sl, thanh_tien: m.gia * sl });
  }
  return { ds, tong: ds.reduce((s, x) => s + x.thanh_tien, 0) };
}

/** Dong mo ta ngan de nhan vien doc o moi man hinh (ghi vao dau special_requests). */
function moTa(ds) {
  if (!ds || !ds.length) return '';
  return 'Dịch vụ kèm: ' + ds.map((x) => x.ten + (x.so_luong > 1 ? ' ×' + x.so_luong : '') + (x.gia ? ` (${x.thanh_tien.toLocaleString('vi-VN')}đ)` : ' (miễn phí)')).join('; ');
}

module.exports = { DANH_MUC, THEO_MA, tinh, moTa };
