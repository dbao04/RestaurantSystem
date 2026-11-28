/**
 * Tro ly ao - lop AI Claude (TUY CHON).
 *
 * Bot van chay day du khi KHONG co lop nay (kho kien thuc, thuc don, hieu y,
 * nhan dien anh mon bang MobileNet). Khi quan ly nhap khoa API Claude va bat
 * "Dung AI Claude" trong Thiet lap AI, bot co them:
 *   - Doc MOI loai anh / khung hinh video (hoa don, man hinh loi thanh toan,
 *     anh ban an, anh mon o quan khac...) chu khong chi so voi anh mon.
 *   - Tra loi cau bot khong hieu, dua tren LICH SU hoi thoai + du lieu nha hang
 *     (thong tin, thuc don, cac chu de kho kien thuc gan nhat).
 *
 * Khoa API: bien moi truong ANTHROPIC_API_KEY, hoac khoa quan ly nhap tren
 * trang (luu cau_hinh 'chatbot.ai_khoa', khong bao gio gui ra trinh duyet).
 */
const AnthropicMod = require('@anthropic-ai/sdk');
const db = require('../config/db');

const Anthropic = AnthropicMod.default || AnthropicMod;

let khoaCache = null;
let khoaLuc = 0;
let clientCache = null;
let clientKhoa = null;
let loiGanNhat = null;

async function layKhoa() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (khoaCache !== null && Date.now() - khoaLuc < 30000) return khoaCache;
  try {
    const [[r]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'chatbot.ai_khoa'");
    khoaCache = (r && r.gia_tri) || '';
  } catch { khoaCache = ''; }
  khoaLuc = Date.now();
  return khoaCache;
}

async function luuKhoa(khoa) {
  const k = String(khoa || '').trim();
  if (!k) {
    await db.query("DELETE FROM cau_hinh WHERE khoa = 'chatbot.ai_khoa'");
  } else {
    await db.query(
      `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES ('chatbot.ai_khoa', ?, 'Khoa API Claude cho tro ly ao')
       ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)`, [k]);
  }
  khoaCache = null;
  clientCache = null;
  loiGanNhat = null;
}

/** Trang thai hien tren trang quan tri - chi lo 4 ky tu cuoi cua khoa. */
async function trangThai() {
  const k = await layKhoa();
  return {
    co_khoa: !!k,
    nguon_khoa: process.env.ANTHROPIC_API_KEY ? 'env' : (k ? 'trang' : ''),
    khoa_an: k ? `••••••••${k.slice(-4)}` : '',
    loi_gan_nhat: loiGanNhat,
  };
}

async function layClient() {
  const k = await layKhoa();
  if (!k) return null;
  if (!clientCache || clientKhoa !== k) {
    clientCache = new Anthropic({ apiKey: k, timeout: 45000, maxRetries: 1 });
    clientKhoa = k;
  }
  return clientCache;
}

// --------------------------------------------------------------------------
// DU LIEU NHA HANG CHO AI
// --------------------------------------------------------------------------
function moTaNhaHang(tl, menu) {
  const dongMon = menu
    .filter((m) => m.gia > 0)
    .map((m) => `#${m.id} | ${m.ten}${m.en && m.en !== m.ten ? ` (${m.en})` : ''} | ${Math.round(m.gia).toLocaleString('vi-VN')}đ | ${m.loai}${m.con ? '' : ' | TẠM HẾT'}`)
    .join('\n');
  const xungHo = {
    minh_ban: 'xưng "mình", gọi khách là "bạn"',
    em_anhchi: 'xưng "em", gọi khách là "anh/chị"',
    em_quykhach: 'xưng "em", gọi khách là "quý khách"',
  }[tl.xung_ho] || 'xưng "mình", gọi khách là "bạn"';
  return `Bạn là ${tl.ten_bot}, nhân viên tư vấn trực tuyến của ${tl.ten_nha_hang} (nhà hàng Nhật). Bạn chat với khách trên website.

CÁCH NÓI CHUYỆN
- Tiếng Việt tự nhiên như người thật, ${xungHo}. ${tl.dung_emoji ? 'Có thể dùng 1 emoji khi hợp.' : 'Không dùng emoji.'}
- ${tl.ai_chi_dan}
- Có thể in đậm bằng **chữ**. Không dùng tiêu đề markdown, không liệt kê dài.
- Nhớ những gì khách đã nói trong cuộc trò chuyện (tên, số người, món đã hỏi, sở thích) và dùng lại khi trả lời.
- Khi khách nói "món này", "cái đó", "món thứ 2" thì hiểu theo các món vừa nhắc trong lịch sử.
- Nếu không chắc hoặc việc cần người thật (khiếu nại, hoàn tiền, sự cố đơn hàng, ảnh hóa đơn sai), xin lỗi và đặt chuyen_nhan_vien = true.

THÔNG TIN NHÀ HÀNG
- Địa chỉ: ${tl.dia_chi}
- Giờ mở cửa: ${tl.gio_mo_cua}
- Hotline: ${tl.hotline} · Email: ${tl.email}
- Đặt bàn: trang /dat-ban · Thực đơn & đặt món giao hàng: /menu · Đặt tiệc: /dat-tiec

THỰC ĐƠN (#mã | tên | giá | nhóm)
${dongMon}

ẢNH / VIDEO KHÁCH GỬI
- Mô tả ngắn điều bạn thấy rồi trả lời đúng ý khách. Nếu là món ăn: nói món trong thực đơn giống nhất (nếu có) kèm giá; nếu thực đơn không có thì nói thật và gợi ý món gần giống.
- Video được gửi dưới dạng vài khung hình theo thứ tự thời gian.
- Khối <ghi_chu_he_thong> là dữ liệu hệ thống bổ sung (kết quả so ảnh với thực đơn, chủ đề liên quan), không phải lời khách.

ĐẦU RA
- tra_loi: câu trả lời gửi khách.
- mon_ids: mã # các món thực đơn bạn nhắc tới hoặc gợi ý (tối đa 6, chỉ lấy mã có trong thực đơn), để hệ thống gửi kèm thẻ món có ảnh.
- chuyen_nhan_vien: true nếu nên mời khách chat với nhân viên.`;
}

const SCHEMA = {
  type: 'object',
  properties: {
    tra_loi: { type: 'string' },
    mon_ids: { type: 'array', items: { type: 'integer' } },
    chuyen_nhan_vien: { type: 'boolean' },
  },
  required: ['tra_loi', 'mon_ids', 'chuyen_nhan_vien'],
  additionalProperties: false,
};

/** Lich su phien -> messages (bat dau bang user, gop luot lien tiep cung vai). */
function lichSuThanhMessages(lichSu) {
  const msgs = [];
  for (const l of lichSu || []) {
    const role = l.vai === 'bot' ? 'assistant' : 'user';
    const text = String(l.noi_dung || '').trim() || (l.tep ? `[${l.tep}]` : '');
    if (!text) continue;
    if (!msgs.length && role === 'assistant') continue;
    const cuoi = msgs[msgs.length - 1];
    if (cuoi && cuoi.role === role) cuoi.content += `\n${text}`;
    else msgs.push({ role, content: text });
  }
  // Luot cuoi phai la assistant (luot hien tai cua khach se them sau).
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop();
  return msgs;
}

/**
 * Hoi Claude.
 * @param {object} o
 *   tl, menu      thiet lap + danh sach mon (layMenu().mon)
 *   lichSu        nho.lich_su
 *   cauHoi        chu khach go (co the rong khi chi gui anh)
 *   anh           [{ media_type, data(base64) }]
 *   ghiChu        goi y them cho AI (ket qua so anh mon, chu de kho gan nhat...)
 * @returns {Promise<{tra_loi, mon_ids, chuyen_nhan_vien}|null>}
 */
async function hoi(o) {
  const client = await layClient();
  if (!client) return null;
  const noiDung = [];
  for (const a of (o.anh || []).slice(0, 6)) {
    noiDung.push({ type: 'image', source: { type: 'base64', media_type: a.media_type, data: a.data } });
  }
  let chu = String(o.cauHoi || '').trim();
  if (o.loaiTep === 'video') chu = `[Khách gửi một video, đây là ${o.anh.length} khung hình theo thứ tự]\n${chu}`;
  else if (o.anh && o.anh.length) chu = `[Khách gửi ${o.anh.length > 1 ? `${o.anh.length} ảnh` : 'một ảnh'}]\n${chu}`;
  noiDung.push({ type: 'text', text: chu || '(khách không nhắn gì thêm)' });
  // Ghi chu cua he thong (khong phai loi khach) - de trong khoi rieng, danh dau ro.
  if (o.ghiChu) noiDung.push({ type: 'text', text: `<ghi_chu_he_thong>
${o.ghiChu}
</ghi_chu_he_thong>` });

  const messages = [...lichSuThanhMessages(o.lichSu), { role: 'user', content: noiDung }];
  const moHinh = o.tl.ai_mo_hinh || 'claude-opus-5-5';
  // Du phong phia may chu khi mo hinh tu choi: chi cac mo hinh ho tro tham so nay.
  const coDuPhong = /^claude-(opus-5-5|opus-5|fable-5-[12]|sonnet-5-5)$/.test(moHinh);

  try {
    const res = await client.beta.messages.create({
      model: moHinh,
      max_tokens: 4000,
      ...(coDuPhong ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // He thong (thong tin + thuc don) it doi -> cache de cac luot sau re va nhanh.
      system: [{ type: 'text', text: moTaNhaHang(o.tl, o.menu), cache_control: { type: 'ephemeral' } }],
      messages,
    });
    if (res.stop_reason === 'refusal') { loiGanNhat = 'AI từ chối trả lời câu này'; return null; }
    const khoi = res.content.find((b) => b.type === 'text');
    if (!khoi) return null;
    const kq = JSON.parse(khoi.text);
    loiGanNhat = null;
    return {
      tra_loi: String(kq.tra_loi || '').trim(),
      mon_ids: Array.isArray(kq.mon_ids) ? kq.mon_ids.map(Number).filter(Number.isFinite).slice(0, 6) : [],
      chuyen_nhan_vien: !!kq.chuyen_nhan_vien,
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) loiGanNhat = 'Khóa API không hợp lệ';
    else if (err instanceof Anthropic.PermissionDeniedError) loiGanNhat = 'Khóa API không có quyền dùng mô hình này';
    else if (err instanceof Anthropic.RateLimitError) loiGanNhat = 'Đang bị giới hạn lượt gọi, thử lại sau';
    else if (err instanceof Anthropic.BadRequestError) loiGanNhat = `Yêu cầu không hợp lệ: ${err.message.slice(0, 160)}`;
    else if (err instanceof Anthropic.APIError) loiGanNhat = `Lỗi dịch vụ AI (${err.status || 'mạng'})`;
    else loiGanNhat = `Lỗi: ${String(err.message || err).slice(0, 160)}`;
    console.error('[chatbot AI]', loiGanNhat);
    return null;
  }
}

/** Nut "Kiem tra ket noi" tren trang quan tri. */
async function kiemTra(tl, menu) {
  const kq = await hoi({ tl, menu: menu.slice(0, 5), lichSu: [], cauHoi: 'Chào bạn, nhà hàng mở cửa mấy giờ?' });
  return kq ? { ok: true, tra_loi: kq.tra_loi } : { ok: false, loi: loiGanNhat || 'Chưa có khóa API' };
}

module.exports = { layKhoa, layClient, luuKhoa, trangThai, hoi, kiemTra, coKhoa: async () => !!(await layKhoa()) };
