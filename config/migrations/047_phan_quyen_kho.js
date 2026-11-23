/**
 * Migration 047 - PHAN QUYEN KHO: tach nguoi dung hang (bep) khoi nguoi giu hang (kho).
 *
 * Chay: node config/migrations/047_phan_quyen_kho.js
 * Server cung tu chay MOT LAN khi khoi dong (services/phanQuyenKho.damBao).
 * Chay file nay = ap dung LAI ma tran (ghi de chinh sua tay o trang To chuc cho
 * cac quyen kho.nhap / xuat / kiem_ke / kiem_ke.chot / mua.de_xuat / mua.duyet).
 */
require('dotenv').config({ quiet: true });

(async () => {
  try {
    await require('../../services/phanQuyenKho').damBao({ batBuoc: true });
    await require('../../services/phanQuyenKho').damBaoVaiTroKho({ batBuoc: true });
    await require('../../services/phanQuyenKho').damBaoQuyenNhap({ batBuoc: true });
    await require('../../services/duyetNhapKhoService').damBaoCauTruc();
    console.log('[047] Da ap dung phan quyen kho: thu kho / nv kho nhap-xuat-kiem ke, quan ly chot & duyet, bep xem + de xuat mua.');
    process.exit(0);
  } catch (e) {
    console.error('[047] Loi:', e.message);
    process.exit(1);
  }
})();
