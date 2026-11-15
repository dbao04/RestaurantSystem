/**
 * Dich THONG BAO do may chu tra ve cho khu khach (loi dat ban, dat tiec, bao
 * gia giao hang, ly do tinh tien coc...).
 *
 * Cac service van nem loi bang tieng Viet - khu nhan vien doc tieng Viet, va
 * doi chu ky cua hang chuc lenh `throw` chi de nhan them ngon ngu la sua lan
 * rong ra nhung cho khong lien quan. Thay vao do route khu khach goi
 * `dich(thongBao, nn)` ngay truoc khi tra JSON.
 *
 * Hai lop:
 *   1. Cau TINH  ('Số điện thoại không hợp lệ')  -> tra bang `dichNd`
 *      (khoa sinh tu chinh chuoi tieng Viet, xem ngonNgu.khoaNoiDung).
 *   2. Cau co SO LIEU ('Chỉ nhận đặt bàn trước tối đa 30 ngày') -> khop mau
 *      regex ben duoi, lay tham so ra roi ghep vao ban dich `tb.*`.
 *
 * Khong khop gi thi tra NGUYEN VAN tieng Viet: thong bao dung nhung sai ngon
 * ngu van tot hon thong bao rong.
 */
const ngonNgu = require('./ngonNgu');

/**
 * [regex, khoa, ten tham so, tham so nao can dich tiep qua dichNd]
 * Thu tu quan trong: mau cu the dat truoc mau chung.
 */
const MAU = [
  [/^Đặt bàn trực tuyến hỗ trợ tối đa (\d+) khách\. Với đoàn đông hơn, vui lòng gọi trực tiếp để nhà hàng sắp xếp\.$/, 'tb.qua_dong_online', ['n']],
  [/^Vui lòng đặt trước ít nhất (\d+) phút để nhà hàng kịp chuẩn bị bàn\. Nếu bạn đang trên đường tới, hãy gọi trực tiếp cho nhà hàng\.$/, 'tb.qua_sat_gio', ['n']],
  [/^Chỉ nhận đặt bàn trước tối đa (\d+) ngày$/, 'tb.qua_xa', ['n']],
  [/^Chỉ có thể đổi món đã đặt trước tối thiểu (\d+) ngày so với giờ đặt bàn\. Vui lòng gọi trực tiếp cho nhà hàng nếu cần đổi món gấp\.$/, 'tb.doi_mon_tre', ['n']],
  [/^Nhà hàng nhận đặt bàn từ ([\d:]+) đến ([\d:]+)\. Vui lòng chọn khung giờ khác\.$/, 'tb.ngoai_gio', ['tu', 'den']],
  [/^Với (\d+) phút sử dụng bàn, lượt đặt sẽ kết thúc lúc ([\d:]+) — sau giờ đóng cửa ([\d:]+)\.$/, 'tb.qua_gio_dong', ['phut', 'gio', 'dong']],
  [/^Bàn (.+?) không còn khả dụng \((.+)\)\. Vui lòng chọn bàn khác\.$/, 'tb.ban_mat', ['ban', 'ly_do'], ['ly_do']],
  [/^Bàn (.+?) không còn khả dụng\. Vui lòng chọn bàn khác\.$/, 'tb.ban_mat_0', ['ban']],
  [/^Bàn bạn chọn có (\d+) chỗ, không đủ cho (\d+) khách\. Vui lòng chọn thêm bàn hoặc đổi bàn lớn hơn\.$/, 'tb.thieu_cho', ['cho', 'khach']],
  [/^Số điện thoại này có (\d+) lần đặt bàn nhưng không đến\. Vui lòng gọi trực tiếp cho nhà hàng để đặt bàn — chúng tôi vẫn rất mong được đón bạn\.$/, 'tb.no_show', ['n']],
  [/^Lượt đặt đang ở trạng thái "(.+)", không thể đổi lịch$/, 'tb.khong_doi_lich', ['tt'], ['tt']],
  [/^Lượt đặt đang ở trạng thái "(.+)", không thể đổi món$/, 'tb.khong_doi_mon', ['tt'], ['tt']],
  [/^Tiệc cần được đặt trước ít nhất (\d+) ngày để nhà hàng chuẩn bị\. Với tiệc gấp, vui lòng gọi Hotline\.$/, 'tb.tiec_dat_truoc', ['n']],
  [/^(.+) nhận tiệc từ (\d+) đến (\d+) khách\.$/, 'tb.tiec_suc_chua', ['sanh', 'tu', 'den'], ['sanh']],
  [/^(.+) đã có tiệc vào (.+) ngày này\. Vui lòng chọn buổi hoặc ngày khác\.$/, 'tb.tiec_kin', ['sanh', 'buoi'], ['sanh', 'buoi']],
  [/^Hiện nhà hàng chỉ giao hàng trong khu vực (.+)\. Địa chỉ của bạn nằm ngoài khu vực này\.$/, 'tb.giao_ngoai_khu', ['khu'], ['khu']],
  [/^Địa chỉ cách nhà hàng ([\d.,]+) km, vượt bán kính giao hàng ([\d.,]+) km\.$/, 'tb.giao_qua_xa', ['km', 'max']],
  // Quy mo ban / suc chua (reservationRules.kiemTraQuyMoBan, kiemTraSucChuaHopLe)
  [/^Bàn đã chọn có (\d+) chỗ, chưa đủ cho (\d+) khách\.$/, 'tb.qm_thieu', ['cho', 'khach']],
  [/^Bàn đã chọn có (\d+) chỗ, không đủ cho (\d+) khách\.$/, 'tb.qm_thieu', ['cho', 'khach']],
  [/^Nhóm (\d+) khách chỉ được đặt 1 bàn \(bàn tối đa (\d+) chỗ\)\.$/, 'tb.qm_mot_ban', ['khach', 'toi_da']],
  [/^Bạn đã chọn thừa bàn: bỏ bớt bàn (\d+) chỗ vẫn đủ cho (\d+) khách\.$/, 'tb.qm_thua', ['cho', 'khach']],
  [/^Bàn (\d+) chỗ quá lớn cho (\d+) khách — chỉ được chọn bàn tối đa (\d+) chỗ\.$/, 'tb.qm_qua_lon', ['cho', 'khach', 'toi_da']],
  [/^Tổng (\d+) chỗ quá nhiều cho (\d+) khách — tổng số chỗ các bàn chỉ được từ (\d+) đến (\d+)\.$/, 'tb.qm_tong', ['cho', 'khach', 'tu', 'den']],
  [/^Trong khung giờ cao điểm, đoàn (\d+) khách chỉ được chọn bàn đúng (\d+) chỗ để đảm bảo phục vụ tối đa lượt khách \(bàn đã chọn có (\d+) chỗ, thừa (\d+) ghế\)\.$/, 'tb.sc_cao_diem', ['khach', 'toi_da', 'cho', 'thua']],
  [/^Bàn đã chọn có (\d+) chỗ là quá lớn so với đoàn (\d+) khách \(tối đa bàn (\d+) chỗ\)\.$/, 'tb.qm_qua_lon', ['cho', 'khach', 'toi_da']],
  // Ly do tinh tien coc (reservationRules.tinhTienCoc)
  [/^Đặt tiệc từ (\d+) khách trở lên \(tối thiểu 150\.000đ\/khách, hoàn tiền thừa lúc thanh toán nếu dùng ít hơn\): 150\.000đ × (\d+) khách$/, 'tb.coc_tiec', ['nguong', 'khach']],
  [/^Đặt món trước — thanh toán 100% tiền món \(([\d.]+)đ\)$/, 'tb.coc_mon', ['tien']],
  [/^(.+): ([\d.]+)đ × (\d+) khách$/, 'tb.coc_moi_khach', ['quy_tac', 'tien', 'khach'], ['quy_tac']],
  [/^(.+): ([\d.]+)đ$/, 'tb.coc_co_dinh', ['quy_tac', 'tien'], ['quy_tac']],
];

/** Dich mot thong bao sang ngon ngu `nn`. Tieng Viet / rong -> giu nguyen. */
function dich(thongBao, nn) {
  if (!thongBao || typeof thongBao !== 'string') return thongBao;
  const ma = ngonNgu.chuanHoa(nn) || ngonNgu.MAC_DINH;
  if (ma === ngonNgu.MAC_DINH) return thongBao;

  const tinh = ngonNgu.dichNd(thongBao, ma);
  if (tinh !== thongBao) return tinh;

  for (const [re, khoa, tenTs, canDich = []] of MAU) {
    const m = re.exec(thongBao);
    if (!m) continue;
    const bien = {};
    tenTs.forEach((ten, i) => {
      const gt = m[i + 1] == null ? '' : m[i + 1];
      bien[ten] = canDich.includes(ten) ? ngonNgu.dichNd(gt, ma) : gt;
    });
    // Danh sach khu giao ghep bang ' và ' (khuVucGiaoService.moTaVung).
    if (bien.khu) bien.khu = bien.khu.replace(/ và /g, ', ');
    const kq = ngonNgu.t(khoa, ma, bien);
    return kq === khoa ? thongBao : kq;
  }
  return thongBao;
}

module.exports = { dich, MAU };
