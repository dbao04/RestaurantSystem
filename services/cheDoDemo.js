/**
 * CHE DO DEMO - tai khoan nhan vien duoc BO QUA cac rang buoc ve GIO GIAC.
 *
 * Dung de trinh bay do an / demo cho giang vien bat ky luc nao trong ngay ma
 * khong phai cho dung gio hen cua luot dat ban. Chi bo qua rang buoc THOI GIAN:
 *   - nhan khach (Da den / Ngoi ban) ngoai khung [gio hen - 60', het luot]
 *   - danh dau "Khong den" truoc khi qua gio hen + thoi gian cho
 *   - giu ban cho khach dat sap den (xep khach vang lai, mo phien, chuyen ban)
 * KHONG bo qua rang buoc bao ve du lieu / tien (tra ban khi con mon chua tinh
 * tien, phan quyen thu tien, hoan coc...) - demo van dung nghiep vu that.
 *
 * Danh sach id nhan vien demo nam o cau_hinh 'demo.nhan_vien_ids' (vd "64,65"),
 * tao bang scripts/taoTaiKhoanDemo.js. Xoa dong cau hinh do = tat che do demo.
 * Moi lan bo qua deu ghi log de bao cao minh bach.
 */
const db = require('../config/db');

const KHOA = 'demo.nhan_vien_ids';
let dem = null;
let hetHan = 0;

async function dsDemo() {
  if (dem && Date.now() < hetHan) return dem;
  try {
    const [[r]] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [KHOA]);
    dem = new Set(String((r && r.gia_tri) || '').split(',').map((x) => Number(x.trim())).filter(Boolean));
  } catch (e) {
    dem = new Set();
  }
  hetHan = Date.now() + 30000;
  return dem;
}

/** Nhan vien `idNv` co dang o che do demo khong. */
async function laDemo(idNv) {
  const id = Number(idNv);
  if (!id) return false;
  return (await dsDemo()).has(id);
}

/** Ghi lai moi lan bo qua rang buoc (xem trong log server). */
function ghiBoQua(idNv, viec) {
  console.log(`[che-do-demo] nhan vien #${idNv} bo qua rang buoc gio: ${viec}`);
}

function xoaDem() { dem = null; hetHan = 0; }

module.exports = { KHOA, laDemo, ghiBoQua, xoaDem };
