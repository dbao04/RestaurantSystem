/**
 * TRO LY DU BAO NGUYEN VAT LIEU -> LAP PHIEU MUA.
 *
 * Chia hai lop, co chu y:
 *
 * 1. SO LIEU (luon chay, khong can AI) - khoBepService.goiYMuaHang:
 *      tieu hao theo thu trong tuan (8 tuan gan nhat) x he so mua vu
 *      + nguyen lieu cho tiec da dat, doi chieu ton kha dung + hang dang ve
 *      + ton toi thieu, ra so luong de xuat; nha cung cap re nhat trong bang
 *      gia (nhaCungCapService). Moi con so deu tinh lai duoc bang tay.
 *
 * 2. NHAN XET (tuy chon, Claude) - doc bang so lieu o tren roi viet: tom tat
 *    tinh hinh, mat hang nao can dat gap va vi sao, canh bao (MOQ, mot nha
 *    cung cap duy nhat, gia chenh lech, tiec lon...). AI KHONG DUOC DOI SO
 *    LUONG - so luong la cua mo hinh thong ke, giai thich duoc tung buoc; mo
 *    hinh ngon ngu doan so lieu la nguon sai kho kiem soat nhat.
 *    Khong co khoa API / AI loi -> van co nhan xet tu dong viet tu chinh so lieu.
 *
 * Khoa API va mo hinh: dung chung voi tro ly ao (services/chatbotAI.js).
 */
const db = require('../config/db');
const kho = require('./khoBepService');
const nccSvc = require('./nhaCungCapService');

const MO_HINH = 'claude-opus-5-5';
const SO_MON_GUI_AI = 60;

const lam = (n, k = 1) => Math.round(Number(n || 0) * 10 ** k) / 10 ** k;
const vnd = (n) => Math.round(Number(n || 0)).toLocaleString('vi-VN') + 'đ';
const soVN = (n) => lam(n, 2).toLocaleString('vi-VN');
const ngayVN = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : null);

const TEN_MUC = {
  het: 'Đã hết', het_truoc_khi_ve: 'Hết trước khi hàng về', thieu_cho_tiec: 'Thiếu cho tiệc',
  duoi_dinh_muc: 'Dưới định mức', sap_het: 'Sắp hết',
};
const GAP = new Set(['het', 'het_truoc_khi_ve', 'thieu_cho_tiec']);

/** Giai thich tung buoc cho mot mat hang - tu chinh so lieu, khong can AI. */
function giaiThich(g, ts) {
  const dv = g.ten_dvt || '';
  const p = [];
  p.push(`Còn dùng được ${soVN(g.kha_dung)} ${dv}, tiêu hao ~${soVN(g.tieu_hao_ngay)} ${dv}/ngày`
    + (g.con_du_ngay !== null ? ` → đủ khoảng ${soVN(g.con_du_ngay)} ngày` : '')
    + (g.ngay_het_du_kien ? ` (dự kiến hết ${ngayVN(g.ngay_het_du_kien)})` : '') + '.');
  p.push(`Cần ${soVN(g.can_truoc_khi_ve)} ${dv} trong ${ts.so_ngay_giao} ngày chờ hàng về, ${soVN(g.can_ky_toi)} ${dv} cho cả ${ts.so_ngay_giao + ts.so_ngay_du_tru} ngày (chờ + dự trữ)`
    + (g.can_cho_tiec > 0 ? `, trong đó ${soVN(g.can_cho_tiec)} ${dv} cho tiệc đã đặt` : '') + '.');
  p.push(`Đề xuất = ${soVN(g.can_ky_toi)} + tồn tối thiểu ${soVN(g.dinh_muc_min)} − còn ${soVN(g.kha_dung)} − đang về ${soVN(g.dang_ve)} = ${soVN(g.de_xuat)} ${dv}.`);
  const c = g.ncc_de_xuat;
  if (c) {
    p.push(`${c.ten_ncc} rẻ nhất ${vnd(c.don_gia)}/${dv}` + (c.so_lua_chon > 1 ? ` (${c.so_lua_chon} nơi bán)` : ' (nơi duy nhất bán)') + '.');
    if (c.duoi_moq) p.push(`Không nơi nào bán dưới mức tối thiểu → làm tròn lên ${soVN(c.moq)} ${dv}.`);
  } else {
    p.push('Chưa nhà cung cấp nào có mặt hàng này trong bảng giá – cần thêm ở trang Nhà cung cấp.');
  }
  return p.join(' ');
}

/** Nhan xet tu dong khi khong dung AI. */
function nhanXetTuDong(ds, tong, theoNcc) {
  if (!ds.length) {
    return {
      nguon: 'tu_dong', uu_tien: [], canh_bao: [], goi_y: [],
      tom_tat: 'Tồn kho cộng hàng đang về (kể cả các đơn mua đang chờ duyệt / đã đặt) đủ dùng tới khi lô hàng kế tiếp về và vẫn trên tồn tối thiểu – chưa cần đặt thêm mặt hàng nào.',
    };
  }
  const gap = ds.filter((g) => GAP.has(g.muc_do));
  const chuaNcc = ds.filter((g) => !g.ncc_de_xuat);
  const moq = ds.filter((g) => g.ncc_de_xuat && g.ncc_de_xuat.duoi_moq);
  const mot = ds.filter((g) => g.ncc_de_xuat && g.ncc_de_xuat.so_lua_chon === 1);
  const canhBao = [];
  if (chuaNcc.length) canhBao.push(`${chuaNcc.length} mặt hàng chưa có trong bảng giá nhà cung cấp nào: ${chuaNcc.slice(0, 5).map((g) => g.ten_nl).join(', ')}${chuaNcc.length > 5 ? '…' : ''}.`);
  if (moq.length) canhBao.push(`${moq.length} mặt hàng phải mua tròn lên mức đặt tối thiểu của nhà cung cấp: ${moq.slice(0, 5).map((g) => g.ten_nl).join(', ')}.`);
  if (mot.length) canhBao.push(`${mot.length} mặt hàng chỉ có một nơi bán – nên tìm thêm nguồn dự phòng: ${mot.slice(0, 5).map((g) => g.ten_nl).join(', ')}${mot.length > 5 ? '…' : ''}.`);
  return {
    nguon: 'tu_dong',
    tom_tat: `${ds.length} mặt hàng cần đặt, trong đó ${gap.length} mặt hàng gấp (đã hết, sẽ hết trước khi hàng về hoặc thiếu cho tiệc). `
      + `Tổng dự kiến ${vnd(tong)}, chia cho ${theoNcc.length} nhà cung cấp theo giá rẻ nhất.`,
    uu_tien: gap.slice(0, 8).map((g) => ({ id_nl: g.id_nl, ly_do: `${TEN_MUC[g.muc_do]}${g.ngay_het_du_kien ? ` – dự kiến hết ${ngayVN(g.ngay_het_du_kien)}` : ''}` })),
    canh_bao: canhBao,
    goi_y: [],
  };
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tom_tat', 'uu_tien', 'canh_bao', 'goi_y'],
  properties: {
    tom_tat: { type: 'string', description: '2-4 câu tiếng Việt: tình hình kho và kế hoạch mua.' },
    uu_tien: {
      type: 'array',
      description: 'Tối đa 8 mặt hàng cần đặt trước nhất, gấp nhất trước.',
      items: {
        type: 'object', additionalProperties: false, required: ['id_nl', 'ly_do'],
        properties: { id_nl: { type: 'integer' }, ly_do: { type: 'string' } },
      },
    },
    canh_bao: { type: 'array', items: { type: 'string' }, description: 'Rủi ro cần quản lý chú ý, tối đa 5.' },
    goi_y: { type: 'array', items: { type: 'string' }, description: 'Gợi ý hành động cụ thể, tối đa 4.' },
  },
};

const HUONG_DAN = `Bạn là trợ lý mua hàng của bếp nhà hàng Nhật "Bảo Đoàn".
Bạn nhận bảng dự báo nguyên vật liệu do hệ thống thống kê tính sẵn (JSON) và viết nhận xét cho bếp trưởng / quản lý.

Quy tắc:
- KHÔNG đổi, không tự tính lại số lượng đề xuất, không bịa số liệu. Chỉ dùng số trong dữ liệu.
- Ưu tiên theo mức độ: het > het_truoc_khi_ve > thieu_cho_tiec > duoi_dinh_muc > sap_het; cùng mức thì mặt hàng hết sớm hơn trước.
- Cảnh báo những điều thật sự cần chú ý: mặt hàng chỉ một nhà cung cấp, phải mua tròn lên mức tối thiểu (duoi_moq), chưa có nhà cung cấp, chênh lệch giá lớn giữa các nơi, nhu cầu tiệc lớn, tổng chi cao bất thường.
- Viết tiếng Việt, ngắn gọn, cụ thể, nêu tên mặt hàng. Không chào hỏi.`;

async function nhanXetAI(ds, tong, theoNcc, ts) {
  const ai = require('./chatbotAI');
  const client = await ai.layClient().catch(() => null);
  if (!client) return { loi: 'Chưa cấu hình khóa API Claude (Thiết lập AI của trợ lý ảo).' };
  const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
  const duLieu = {
    tham_so: { so_ngay_cho_hang: ts.so_ngay_giao, so_ngay_du_tru: ts.so_ngay_du_tru, he_so_mua_vu: lam(ts.he_so, 2), du_lieu_den_ngay: ts.neo },
    tong_du_kien_vnd: Math.round(tong),
    theo_nha_cung_cap: theoNcc.map((n) => ({ ten: n.ten_ncc, so_mat_hang: n.dong.length, tong_vnd: Math.round(n.tong) })),
    mat_hang: ds.slice(0, SO_MON_GUI_AI).map((g) => ({
      id_nl: g.id_nl, ten: g.ten_nl, dvt: g.ten_dvt, muc_do: g.muc_do,
      con_dung_duoc: lam(g.kha_dung, 2), tieu_hao_ngay: lam(g.tieu_hao_ngay, 2), du_ngay: g.con_du_ngay,
      ngay_het: g.ngay_het_du_kien, dang_ve: g.dang_ve, ton_toi_thieu: g.dinh_muc_min, cho_tiec: g.can_cho_tiec,
      de_xuat: g.so_luong_mua,
      ncc: g.ncc_de_xuat ? { ten: g.ncc_de_xuat.ten_ncc, gia: g.ncc_de_xuat.don_gia, so_noi_ban: g.ncc_de_xuat.so_lua_chon, duoi_moq: g.ncc_de_xuat.duoi_moq } : null,
      gia_noi_dat_nhat: g.bao_gia && g.bao_gia.length > 1 ? g.bao_gia[g.bao_gia.length - 1].don_gia : null,
    })),
  };
  try {
    const res = await client.beta.messages.create({
      model: MO_HINH,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: [{ type: 'text', text: HUONG_DAN, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `<du_lieu_du_bao>\n${JSON.stringify(duLieu)}\n</du_lieu_du_bao>` }],
    });
    if (res.stop_reason === 'refusal') return { loi: 'AI từ chối trả lời.' };
    const khoi = res.content.find((b) => b.type === 'text');
    if (!khoi) return { loi: 'AI không trả về nội dung.' };
    const kq = JSON.parse(khoi.text);
    const hopLe = new Set(ds.map((g) => g.id_nl));
    return {
      nguon: 'ai', mo_hinh: res.model,
      tom_tat: String(kq.tom_tat || '').trim(),
      uu_tien: (kq.uu_tien || []).filter((u) => hopLe.has(Number(u.id_nl))).slice(0, 8).map((u) => ({ id_nl: Number(u.id_nl), ly_do: String(u.ly_do || '') })),
      canh_bao: (kq.canh_bao || []).map(String).slice(0, 5),
      goi_y: (kq.goi_y || []).map(String).slice(0, 4),
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { loi: 'Khóa API không hợp lệ.' };
    if (err instanceof Anthropic.RateLimitError) return { loi: 'Đang bị giới hạn lượt gọi AI, thử lại sau.' };
    if (err instanceof Anthropic.APIError) return { loi: `Lỗi dịch vụ AI (${err.status || 'mạng'}).` };
    return { loi: `Lỗi: ${String(err.message || err).slice(0, 160)}` };
  }
}

/**
 * Chay du bao + (tuy chon) nhan xet AI.
 * @returns {{tham_so, mat_hang, theo_ncc, tong, nhan_xet, ai_loi}}
 */
async function phanTich({ dungAI = true, homNay = null } = {}) {
  const goiY = await kho.goiYMuaHang({ homNay });
  const ts = goiY.thamSo;
  const ds = goiY.map((g) => ({
    id_nl: g.id_nl, ten_nl: g.ten_nl, ten_dvt: g.ten_dvt, muc_do: g.muc_do, ten_muc: TEN_MUC[g.muc_do],
    kha_dung: g.kha_dung, tieu_hao_ngay: g.tieu_hao_ngay, con_du_ngay: g.con_du_ngay, ngay_het_du_kien: g.ngay_het_du_kien,
    dang_ve: g.dang_ve, can_truoc_khi_ve: g.can_truoc_khi_ve, can_ky_toi: g.can_ky_toi, can_cho_tiec: g.can_cho_tiec,
    dinh_muc_min: g.dinh_muc_min, de_xuat: g.de_xuat, so_luong_mua: g.so_luong_mua || g.de_xuat,
    ncc_de_xuat: g.ncc_de_xuat, bao_gia: g.bao_gia || [],
    don_gia: (g.ncc_de_xuat && g.ncc_de_xuat.don_gia) || Number(g.gia_nhap_gan_nhat) || Number(g.gia_von) || 0,
  }));
  for (const g of ds) {
    g.thanh_tien = Math.round(g.so_luong_mua * g.don_gia);
    g.giai_thich = giaiThich(g, ts);
  }
  const nhom = new Map();
  for (const g of ds) {
    const k = g.ncc_de_xuat ? g.ncc_de_xuat.id_ncc : 0;
    if (!nhom.has(k)) nhom.set(k, { id_ncc: k || null, ten_ncc: g.ncc_de_xuat ? g.ncc_de_xuat.ten_ncc : 'Chưa có nhà cung cấp', dong: [], tong: 0 });
    const n = nhom.get(k);
    n.dong.push(g.id_nl);
    n.tong += g.thanh_tien;
  }
  const theoNcc = [...nhom.values()].sort((a, b) => (a.id_ncc ? 0 : 1) - (b.id_ncc ? 0 : 1) || b.tong - a.tong);
  const tong = ds.reduce((s, g) => s + g.thanh_tien, 0);

  let nhanXet = null;
  let aiLoi = null;
  if (dungAI && ds.length) {
    const kq = await nhanXetAI(ds, tong, theoNcc, ts);
    if (kq.loi) aiLoi = kq.loi; else nhanXet = kq;
  }
  if (!nhanXet) nhanXet = nhanXetTuDong(ds, tong, theoNcc);
  // Don mua chua nhan - da tinh vao "dang ve"; hien ra de nguoi dung hieu vi sao khong de xuat them.
  const [donMo] = await db.query(`
    SELECT d.id_dmh, d.ma_don, d.trang_thai, n.ten_ncc, COUNT(c.id) AS so_dong
      FROM don_mua_hang d LEFT JOIN nha_cung_cap n ON n.id_ncc = d.id_ncc JOIN chi_tiet_don_mua c ON c.id_dmh = d.id_dmh
     WHERE d.trang_thai IN ('cho_duyet','da_duyet','da_dat','nhan_mot_phan')
     GROUP BY d.id_dmh ORDER BY d.created_at DESC LIMIT 20`);
  return {
    don_mo: donMo.map((d) => ({ ...d, so_dong: Number(d.so_dong), ten_trang_thai: kho.TRANG_THAI_DON[d.trang_thai] })),
    tham_so: { so_ngay_giao: ts.so_ngay_giao, so_ngay_du_tru: ts.so_ngay_du_tru, he_so_mua_vu: lam(ts.he_so, 2), du_lieu_den_ngay: ts.neo },
    mat_hang: ds, theo_ncc: theoNcc, tong: Math.round(tong), nhan_xet: nhanXet, ai_loi: aiLoi,
  };
}

/**
 * Lap phieu mua tu cac dong nguoi dung chon: gom theo nha cung cap, moi nha
 * mot don "Cho duyet". Don gia lay tu BANG GIA tren may chu (khong tin so
 * trinh duyet gui len); mat hang NCC do khong ban thi bao loi.
 */
async function lapPhieu(dong, idNv) {
  if (!Array.isArray(dong) || !dong.length) throw new kho.LoiKho('Chọn ít nhất một mặt hàng để lập phiếu.');
  const bangGia = await nccSvc.giaTheoNl();
  const nhom = new Map();
  const [nlRows] = await db.query('SELECT id_nl, ten_nl FROM nguyen_lieu WHERE id_nl IN (?)', [dong.map((d) => Number(d.id_nl) || 0)]);
  const tenNl = new Map(nlRows.map((r) => [Number(r.id_nl), r.ten_nl]));
  for (const d of dong) {
    const idNl = Number(d.id_nl);
    const sl = Number(d.so_luong);
    const idNcc = Number(d.id_ncc) || 0;
    if (!tenNl.has(idNl)) throw new kho.LoiKho('Có mặt hàng không tồn tại.');
    if (!(sl > 0)) throw new kho.LoiKho(`Số lượng của ${tenNl.get(idNl)} phải lớn hơn 0.`);
    let gia = 0;
    if (idNcc) {
      const g = (bangGia.get(idNl) || []).find((x) => x.id_ncc === idNcc);
      if (!g) throw new kho.LoiKho(`Nhà cung cấp đã chọn không bán ${tenNl.get(idNl)} – chọn nơi khác hoặc thêm vào bảng giá.`);
      gia = g.don_gia;
    } else {
      gia = Math.max(0, Number(d.don_gia) || 0);
    }
    if (!nhom.has(idNcc)) nhom.set(idNcc, []);
    if (nhom.get(idNcc).some((x) => x.id_nl === idNl)) throw new kho.LoiKho(`${tenNl.get(idNl)} bị chọn hai lần cho cùng nhà cung cấp.`);
    nhom.get(idNcc).push({ id_nl: idNl, so_luong: Math.ceil(sl * 1000) / 1000, don_gia: gia });
  }
  const luc = new Date();
  const ghi = `Lập từ Trợ lý dự báo NVL lúc ${String(luc.getHours()).padStart(2, '0')}:${String(luc.getMinutes()).padStart(2, '0')} ${luc.getDate()}/${luc.getMonth() + 1}`;
  const ts = await kho.thamSoMua();
  const d0 = new Date(); d0.setDate(d0.getDate() + ts.so_ngay_giao);
  const ngayGiao = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
  const don = [];
  for (const [idNcc, ds] of nhom) {
    const kq = await kho.taoDonMua({ id_ncc: idNcc || null, dong: ds, ngay_giao_du_kien: ngayGiao, ghi_chu: ghi + (idNcc ? '' : ' - CHƯA CHỌN NCC') }, idNv);
    don.push({ ...kq, id_ncc: idNcc || null, so_dong: ds.length, tong: Math.round(ds.reduce((s, x) => s + x.so_luong * x.don_gia, 0)) });
  }
  return { don };
}

module.exports = { phanTich, lapPhieu, giaiThich, TEN_MUC };
