/**
 * Tang XEP BAN cua module dat ban.
 *
 * Tra loi mot cau hoi duy nhat: "voi khung gio nay va nhung nhu cau nay, nhung
 * ban nao dung duoc, va nen chon to hop nao?" - roi cung cap hai thao tac ghi
 * la chiem o / nha o tren luoi chong dat trung.
 *
 * ---------------------------------------------------------------------------
 * MOT NGUON SU THAT DUY NHAT VE "BAN CON TRONG"
 * ---------------------------------------------------------------------------
 * Truoc day cau hoi nay duoc tra loi bang mot cau NOT EXISTS so sanh khoang
 * thoi gian tren `reservations`. Bay gio no duoc tra loi bang bang
 * `reservation_slot_locks` - dung CHINH bang ma CSDL dung de chan dat trung.
 *
 * Diem quan trong khong phai la nhanh hon, ma la KHONG THE LECH: neu ham
 * `banKhaDung` bao "ban B05 con trong" thi lenh INSERT ngay sau do chac chan
 * thanh cong, vi ca hai deu nhin vao dung mot tap dong. Khi cau truy van kiem
 * tra va rang buoc CSDL la hai thu khac nhau, se den luc chung tra loi khac
 * nhau - va luc do he thong bao khach "con ban" roi bao loi ngay sau do.
 *
 * ---------------------------------------------------------------------------
 * VI SAO TRANG THAI VAT LY CUA BAN KHONG CHAN MOI LUOT DAT
 * ---------------------------------------------------------------------------
 * `ban.trangthai` mo ta ban NGAY LUC NAY (dang phuc vu, dang don...). Mot ban
 * dang co khach luc 19h hom nay khong lien quan gi den viec no co the nhan
 * khach luc 19h ngay mai. Neu chan theo `trangthai = 0` nhu ban truoc thi mot
 * nha hang dong khach se khong dat truoc duoc bat ky ban nao - loi nay am tham
 * va rat kho nhin ra vi he thong chi bao "het ban".
 *
 * Nen quy tac la:
 *   - BAO TRI (4): chan moi luot, moi ngay. Ban khong dung duoc.
 *   - DANG PHUC VU (1) / DANG DON (3): chi chan cac luot bat dau TRONG VONG
 *     `occupied_hold_minutes` toi - vi khong ai biet chac khach hien tai roi
 *     ban luc nao, hua ban do trong 30 phut toi la hua lieu.
 *   - Xa hon moc do: khong chan, luoi o lo phan con lai.
 */
const db = require('../config/db');
const qt = require('./reservationRules');

const { LoiDatBan } = qt;

/** Ma loi trung khoa cua MySQL/MariaDB - "o nay da co chu". */
const LOI_TRUNG = 'ER_DUP_ENTRY';

/**
 * Trong so cham diem to hop ban.
 *
 * SO_BAN lon hon nhieu so voi GHE_THUA co chu dich: mot ban 6 cho cho 4 khach
 * (thua 2 ghe, diem 2) luon phai thang phuong an hai ban 2 cho (thua 0 ghe
 * nhung 2 ban, diem 120). Nguoi that thich ngoi mot ban hon la ngoi ghep hai
 * ban vua khit - va ghep ban ton cong nhan vien ke ban, doi khan.
 */
const DIEM = {
  SO_BAN: 60,        // moi ban them vao to hop
  GHE_THUA: 1,       // moi ghe thua
  TRAI_KHU: 40,      // ghep ban khac khu vuc (khi cau hinh cho phep)
  HOP_SO_THICH: -25, // moi so thich duoc dap ung (diem am = tot)
  UU_TIEN_VIP: -35,  // ban danh cho khach VIP, khi khach la VIP
  PHI_VIP: 30,       // chiem ban VIP cho khach thuong - tranh, nhung khong cam
};

/** Thuoc tinh ban co the duoc yeu cau qua the dac biet. */
const THUOC_TINH_BAN = ['gan_cua_so', 'yen_tinh', 'phong_rieng', 'xe_lan'];

// --------------------------------------------------------------- doc ban

/**
 * Doc toan bo ban kem thuoc tinh khu vuc.
 *
 * `client` cho phep chay trong transaction dang mo; mac dinh la pool.
 * `khoa = true` them FOR UPDATE - chi dung khi dang chuan bi ghi.
 */
async function docBan({ areaId = null, chiNhanhId = null, client = db, chiChoDat = true } = {}) {
  const dieuKien = [];
  const thamSo = [];
  if (chiChoDat) dieuKien.push('b.cho_dat_truoc = 1 AND v.cho_dat_truoc = 1');
  if (areaId) { dieuKien.push('b.id_vitri = ?'); thamSo.push(areaId); }
  // `branches` moi duoc them o 029 va `ban` chua co cot chi nhanh. Tham so giu
  // san cho luc mo rong nhieu chi nhanh; hien tai khong loc.
  void chiNhanhId;

  const [rows] = await client.query(
    `SELECT b.Id_ban            AS id,
            b.number_ban        AS ten,
            COALESCE(b.so_cho, 4) AS so_cho,
            b.trangthai         AS trang_thai,
            b.toa_do_x          AS x,
            b.toa_do_y          AS y,
            b.ghichu            AS ghi_chu,
            b.ghi_chu_bao_tri   AS ghi_chu_bao_tri,
            b.cho_dat_truoc, b.co_the_ghep, b.nhom_ghep,
            b.gan_cua_so, b.yen_tinh, b.phong_rieng, b.xe_lan, b.uu_tien_vip,
            b.sesis_hien_tai    AS phien_hien_tai,
            v.id_vitri          AS khu_vuc_id,
            v.Name_vitri        AS khu_vuc,
            v.thu_tu            AS khu_vuc_thu_tu,
            v.la_vip            AS khu_vip,
            v.ngoai_troi        AS khu_ngoai_troi,
            v.mau_sac           AS khu_mau
       FROM ban b
       JOIN vitri v ON v.id_vitri = b.id_vitri
      ${dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : ''}
      ORDER BY v.thu_tu, b.number_ban`, thamSo);

  return rows.map((r) => ({
    ...r,
    so_cho: Number(r.so_cho),
    x: Number(r.x) || 0,
    y: Number(r.y) || 0,
    co_the_ghep: !!r.co_the_ghep,
    gan_cua_so: !!r.gan_cua_so,
    yen_tinh: !!r.yen_tinh,
    phong_rieng: !!r.phong_rieng,
    xe_lan: !!r.xe_lan,
    uu_tien_vip: !!r.uu_tien_vip,
    khu_vip: !!r.khu_vip,
    khu_ngoai_troi: !!r.khu_ngoai_troi,
  }));
}

/** Danh sach khu vuc cho bo loc va tab tren so do. */
async function docKhuVuc({ chiChoDat = true } = {}) {
  const [rows] = await db.query(
    `SELECT v.id_vitri AS id, v.Name_vitri AS ten, v.Ghichu AS mo_ta, v.thu_tu,
            v.la_vip, v.ngoai_troi, v.cho_dat_truoc, v.mau_sac AS mau,
            COUNT(b.Id_ban) AS so_ban,
            COALESCE(SUM(CASE WHEN b.cho_dat_truoc = 1 THEN b.so_cho ELSE 0 END), 0) AS tong_cho
       FROM vitri v
       LEFT JOIN ban b ON b.id_vitri = v.id_vitri
      ${chiChoDat ? 'WHERE v.cho_dat_truoc = 1' : ''}
      GROUP BY v.id_vitri
      ORDER BY v.thu_tu, v.Name_vitri`);
  return rows.map((r) => ({
    ...r,
    so_ban: Number(r.so_ban),
    tong_cho: Number(r.tong_cho),
    la_vip: !!r.la_vip,
    ngoai_troi: !!r.ngoai_troi,
  }));
}

// ------------------------------------------------------- ban dang bi chiem

/**
 * Tap id ban da bi chiem trong day o cua mot khung gio.
 *
 * `boQuaId` la reservation dang duoc SUA: khi khach doi tu 4 len 8 khach, cac
 * o cu cua chinh ho khong duoc tinh la vat can, neu khong he thong se bao "ban
 * ban dang ngoi da co nguoi dat" - chinh la ho.
 */
async function banBiChiem(dsO, { boQuaId = null, client = db } = {}) {
  if (!dsO.length) return new Map();
  const thamSo = [dsO];
  let loc = '';
  if (boQuaId) { loc = ' AND l.reservation_id <> ?'; thamSo.push(boQuaId); }

  const [rows] = await client.query(
    `SELECT l.table_id, MIN(l.reservation_id) AS reservation_id
       FROM reservation_slot_locks l
      WHERE l.slot_start IN (?) ${loc}
      GROUP BY l.table_id`, thamSo);

  return new Map(rows.map((r) => [Number(r.table_id), Number(r.reservation_id)]));
}

/**
 * Ly do mot ban khong dung duoc cho khung gio nay, hoac null neu dung duoc.
 *
 * Tach thanh ham rieng vi ca so do ban (hien "vi sao mo") lan bo loc xep ban
 * (loai ra khoi ung vien) deu can dung mot cau tra loi. Hai noi tu suy luan
 * doc lap la duong dan toi mot so do bao "trong" con he thong bao "het ban".
 */
function lyDoKhongDung(ban, { biChiem, khung, ch, bayGio = new Date() }) {
  if (Number(ban.trang_thai) === 4) {
    return { ma: 'MAINTENANCE', mo_ta: ban.ghi_chu_bao_tri || 'Bàn đang bảo trì' };
  }
  if (!ban.cho_dat_truoc) return { ma: 'NOT_BOOKABLE', mo_ta: 'Bàn không nhận đặt trước' };
  if (biChiem) return { ma: 'RESERVED', mo_ta: 'Đã có khách đặt trong khung giờ này' };

  const trangThai = Number(ban.trang_thai);
  if (trangThai === 1 || trangThai === 3) {
    const hanGiu = Number(ch.occupied_hold_minutes) || 90;
    const cach = (khung.mocBatDau.getTime() - bayGio.getTime()) / 60000;
    if (cach <= hanGiu) {
      return {
        ma: trangThai === 1 ? 'OCCUPIED' : 'CLEANING',
        mo_ta: trangThai === 1
          ? 'Bàn đang có khách, chưa rõ giờ trống'
          : 'Bàn đang được dọn',
      };
    }
  }
  return null;
}

/**
 * Danh sach ban dung duoc cho mot khung gio, da kem ly do voi ban bi loai.
 *
 * Tra ve CA HAI danh sach chu khong chi ban trong: so do ban phai ve duoc ca
 * o mau do va giai thich duoc vi sao no do.
 */
async function banKhaDung(khung, {
  areaId = null, boQuaId = null, client = db, chiChoDat = true, bayGio = new Date(),
} = {}) {
  const ch = await qt.docCauHinh();
  const dsO = qt.dayO(khung.ngay, khung.batDau, khung.ketThuc, khung.demDon);
  const [dsBan, chiem] = await Promise.all([
    docBan({ areaId, client, chiChoDat }),
    banBiChiem(dsO, { boQuaId, client }),
  ]);

  const kem = [];
  const trong = [];
  for (const ban of dsBan) {
    const ly = lyDoKhongDung(ban, { biChiem: chiem.get(ban.id), khung, ch, bayGio });
    if (ly) kem.push({ ...ban, kha_dung: false, ly_do: ly, reservation_id: chiem.get(ban.id) || null });
    else trong.push({ ...ban, kha_dung: true, ly_do: null, reservation_id: null });
  }
  return { trong, kem, tatCa: [...trong, ...kem], dsO };
}

// ------------------------------------------------------------ tim to hop

/**
 * So thich suy ra tu the yeu cau dac biet + loai khach.
 *
 * Bang `reservation_tag_catalog.table_hint` la cau noi: the WINDOW tro toi cot
 * `gan_cua_so`. Nho vay quan ly them mot the moi kem goi y ban ma khong phai
 * sua ma nguon.
 */
async function soThichTu({ dsThe = [], loaiKhach = 'REGULAR', khuVip = false }) {
  const thich = new Set();
  if (dsThe.length) {
    const [rows] = await db.query(
      'SELECT table_hint FROM reservation_tag_catalog WHERE code IN (?) AND table_hint IS NOT NULL', [dsThe]);
    for (const r of rows) if (THUOC_TINH_BAN.includes(r.table_hint)) thich.add(r.table_hint);
  }
  // Khach VIP mac dinh duoc uu tien khong gian yen tinh, ke ca khong tich the.
  if (loaiKhach === 'VIP' && khuVip) thich.add('yen_tinh');
  return [...thich];
}

/**
 * Cham diem mot to hop ban. Diem THAP hon = tot hon.
 *
 * Thu tu uu tien cua de bai (muc 14) duoc ma hoa thanh trong so chu khong
 * thanh chuoi if lồng nhau: doi chinh sach ("ghep ban khac khu la chap nhan
 * duoc") chi la doi mot con so, khong phai viet lai thuat toan.
 */
function chamDiem(dsBan, soKhach, { soThich = [], laVip = false, chungKhu = true }) {
  const tongCho = dsBan.reduce((s, b) => s + b.so_cho, 0);
  let diem = dsBan.length * DIEM.SO_BAN + (tongCho - soKhach) * DIEM.GHE_THUA;

  if (!chungKhu) diem += DIEM.TRAI_KHU;

  for (const thuocTinh of soThich) {
    // Chi tinh diem khi TOAN BO ban trong to hop dap ung: khach xin ban gan
    // cua so ma duoc ghep mot ban trong va mot ban khuat thi khong tinh la dap ung.
    if (dsBan.every((b) => b[thuocTinh])) diem += DIEM.HOP_SO_THICH;
  }

  const coBanVip = dsBan.some((b) => b.uu_tien_vip);
  if (laVip && coBanVip) diem += DIEM.UU_TIEN_VIP;
  if (!laVip && coBanVip) diem += DIEM.PHI_VIP;

  return diem;
}

/**
 * Tim cac to hop ban phu hop, sap theo diem tang dan.
 *
 * Thuat toan: duyet sau (DFS) tren danh sach ban da sap giam dan theo so cho.
 * Ba cach cat nhanh giu chi phi trong tam kiem soat voi vai chuc ban:
 *   1. Du cho roi thi dung - khong them ban thua vao to hop.
 *   2. Khong vuot qua `max_tables_per_reservation` ban.
 *   3. Tran so nut duyet - chan cuoi cung, khong bao gio treo may chu.
 *
 * `chiMotBan` (khi tat ghep ban) chi xet tung ban le.
 */
function timToHop(dsBan, soKhach, {
  choGhep = true, toiDaBan = 4, chungKhuThoi = true, soThich = [], laVip = false, toiDaKetQua = 6,
} = {}) {
  const ungVien = [...dsBan].sort((a, b) => b.so_cho - a.so_cho || a.ten.localeCompare(b.ten));
  const ketQua = [];
  let soNut = 0;

  const chungNhom = (ds) => {
    if (!chungKhuThoi) return true;
    // `nhom_ghep` mac dinh la 'KV<id khu vuc>', nen kiem tra nhom la du - no
    // vua chan ghep khac khu vua chan ghep hai ban cung khu nhung bi loi di
    // chia cat (quan ly dat nhom rieng cho truong hop do).
    const nhom = ds[0].nhom_ghep || `KV${ds[0].khu_vuc_id}`;
    return ds.every((b) => (b.nhom_ghep || `KV${b.khu_vuc_id}`) === nhom);
  };

  function duyet(batDau, daChon, tongCho) {
    if (soNut > 40000) return;
    if (tongCho >= soKhach) {
      if (!chungNhom(daChon)) return;
      const chungKhu = daChon.every((b) => b.khu_vuc_id === daChon[0].khu_vuc_id);
      ketQua.push({
        ban: [...daChon],
        tong_cho: tongCho,
        so_ban: daChon.length,
        ghe_thua: tongCho - soKhach,
        chung_khu: chungKhu,
        khu_vuc: chungKhu ? daChon[0].khu_vuc : 'Nhiều khu vực',
        diem: chamDiem(daChon, soKhach, { soThich, laVip, chungKhu }),
      });
      return;
    }
    if (daChon.length >= toiDaBan) return;
    for (let i = batDau; i < ungVien.length; i += 1) {
      soNut += 1;
      if (soNut > 40000) return;
      const ban = ungVien[i];
      // Ban khong the ghep chi duoc dung mot minh.
      if (daChon.length && !ban.co_the_ghep) continue;
      if (daChon.length === 0 && !choGhep) {
        // Khong cho ghep: chi xet phuong an mot ban.
        if (ban.so_cho >= soKhach) {
          ketQua.push({
            ban: [ban],
            tong_cho: ban.so_cho,
            so_ban: 1,
            ghe_thua: ban.so_cho - soKhach,
            chung_khu: true,
            khu_vuc: ban.khu_vuc,
            diem: chamDiem([ban], soKhach, { soThich, laVip, chungKhu: true }),
          });
        }
        continue;
      }
      if (daChon.length && !daChon[daChon.length - 1].co_the_ghep) continue;
      duyet(i + 1, [...daChon, ban], tongCho + ban.so_cho);
    }
  }

  duyet(0, [], 0);

  // Loai to hop trung nhau (cung tap id) - DFS co the sinh lai qua nhieu nhanh.
  const daThay = new Set();
  return ketQua
    .filter((p) => {
      const khoa = p.ban.map((b) => b.id).sort((a, b) => a - b).join('-');
      if (daThay.has(khoa)) return false;
      daThay.add(khoa);
      return true;
    })
    .sort((a, b) => a.diem - b.diem)
    .slice(0, toiDaKetQua);
}

/**
 * Goi y xep ban day du cho mot yeu cau dat ban.
 *
 * Tra ve to hop tot nhat + cac phuong an thay the + danh sach ban trong de ve
 * so do. Khong ghi gi vao CSDL.
 */
async function goiYXepBan(khung, {
  soKhach, areaId = null, dsThe = [], loaiKhach = 'REGULAR', boQuaId = null,
  banChiDinh = null, client = db,
} = {}) {
  const ch = await qt.docCauHinh();
  const { trong, kem, tatCa } = await banKhaDung(khung, { areaId, boQuaId, client });

  // Khach (hoac nhan vien) chi dinh san ban: khong tu chon nua, chi kiem tra.
  if (Array.isArray(banChiDinh) && banChiDinh.length) {
    const chon = trong.filter((b) => banChiDinh.map(Number).includes(b.id));
    const thieu = banChiDinh.map(Number).filter((id) => !chon.some((b) => b.id === id));
    if (thieu.length) {
      const ten = tatCa.filter((b) => thieu.includes(b.id)).map((b) => b.ten).join(', ') || thieu.join(', ');
      const ly = tatCa.find((b) => thieu.includes(b.id) && b.ly_do);
      throw new LoiDatBan(
        `Bàn ${ten} không còn khả dụng${ly ? ` (${ly.ly_do.mo_ta.toLowerCase()})` : ''}. `
        + 'Vui lòng chọn bàn khác.', 'TABLE_TAKEN');
    }
    const tongCho = chon.reduce((s, b) => s + b.so_cho, 0);
    // BR-002: khong duoc vuot suc chua.
    if (tongCho < soKhach) {
      throw new LoiDatBan(
        `Bàn bạn chọn có ${tongCho} chỗ, không đủ cho ${soKhach} khách. `
        + 'Vui lòng chọn thêm bàn hoặc đổi bàn lớn hơn.', 'NOT_ENOUGH_SEATS');
    }
    if (chon.length > 1 && ch.allow_table_combination === 0) {
      throw new LoiDatBan('Nhà hàng hiện không nhận ghép bàn', 'NO_COMBINATION');
    }
    const chungKhu = chon.every((b) => b.khu_vuc_id === chon[0].khu_vuc_id);
    return {
      chon: {
        ban: chon,
        tong_cho: tongCho,
        so_ban: chon.length,
        ghe_thua: tongCho - soKhach,
        chung_khu: chungKhu,
        khu_vuc: chungKhu ? chon[0].khu_vuc : 'Nhiều khu vực',
        diem: 0,
        do_khach_chon: true,
      },
      phuongAn: [],
      banTrong: trong,
      banKem: kem,
    };
  }

  const soThich = await soThichTu({
    dsThe,
    loaiKhach,
    khuVip: trong.some((b) => b.uu_tien_vip),
  });

  const phuongAn = timToHop(trong, soKhach, {
    choGhep: Number(ch.allow_table_combination) === 1,
    toiDaBan: Number(ch.max_tables_per_reservation) || 4,
    chungKhuThoi: Number(ch.combine_same_area_only) === 1,
    soThich,
    laVip: loaiKhach === 'VIP',
  });

  return {
    chon: phuongAn[0] || null,
    phuongAn: phuongAn.slice(1),
    banTrong: trong,
    banKem: kem,
    soThich,
  };
}

// ------------------------------------------------- goi y khung gio thay the

/**
 * Khi khong con ban: goi y cac khung gio gan nhat con nhan duoc (case 1).
 *
 * Quet ±`phamVi` gio quanh gio khach muon, buoc `slot_step_minutes`, dung lai
 * khi du `soLuong` goi y. Chi tra ve khung gio THAT SU dat duoc - da qua ca
 * kiem tra gio mo cua lan kiem tra ban trong, de khach bam vao la dat duoc
 * ngay chu khong gap them mot man bao loi nua.
 */
async function khungGioThayThe(khungGoc, {
  soKhach, areaId = null, dsThe = [], loaiKhach = 'REGULAR', soLuong = 6, phamVi = 3,
} = {}) {
  const ch = await qt.docCauHinh();
  const buoc = Number(ch.slot_step_minutes) || 15;
  const goc = qt.phutTuChuoi(khungGoc.batDau);

  // Sinh cac moc theo khoang cach tang dan tu gio goc: -15, +15, -30, +30...
  // Khach quan tam khung gan nhat truoc, khong phai khung som nhat trong ngay.
  const lech = [];
  for (let d = buoc; d <= phamVi * 60; d += buoc) { lech.push(-d); lech.push(d); }

  const goiY = [];
  for (const d of lech) {
    if (goiY.length >= soLuong) break;
    const phut = goc + d;
    if (phut < 0 || phut >= 1440) continue;

    const khung = {
      ...khungGoc,
      batDau: qt.chuoiTuPhut(phut),
      ketThuc: qt.chuoiTuPhut(phut + khungGoc.thoiLuong),
      mocBatDau: qt.ghepMoc(khungGoc.ngay, qt.chuoiTuPhut(phut)),
    };

    try {
      qt.kiemTraQuaKhu(khung);
      await qt.kiemTraGioMoCua(khung);
      qt.kiemTraDatSatGio(khung, ch);
    } catch (e) {
      continue; // Ngoai gio mo cua hoac qua sat - bo qua, khong phai loi.
    }

    const kq = await goiYXepBan(khung, { soKhach, areaId, dsThe, loaiKhach });
    if (kq.chon) {
      goiY.push({
        gio: qt.gioNgan(khung.batDau),
        den: qt.gioNgan(khung.ketThuc),
        lech_phut: d,
        so_ban: kq.chon.so_ban,
        khu_vuc: kq.chon.khu_vuc,
        ban: kq.chon.ban.map((b) => b.ten),
      });
    }
  }
  return goiY.sort((a, b) => Math.abs(a.lech_phut) - Math.abs(b.lech_phut));
}

/**
 * Goi y KHU VUC khac trong cung khung gio (case 1 - "bàn thay thế").
 *
 * Khach chon Phong VIP het cho nhung San vuon con - phai noi ra, thay vi chi
 * bao "het ban" roi de khach tu doan.
 */
async function khuVucThayThe(khung, { soKhach, boQuaAreaId = null, dsThe = [], loaiKhach = 'REGULAR' } = {}) {
  const dsKhu = await docKhuVuc();
  const kq = [];
  for (const khu of dsKhu) {
    if (boQuaAreaId && Number(khu.id) === Number(boQuaAreaId)) continue;
    const goi = await goiYXepBan(khung, { soKhach, areaId: khu.id, dsThe, loaiKhach });
    if (goi.chon) {
      kq.push({
        khu_vuc_id: khu.id,
        khu_vuc: khu.ten,
        so_ban: goi.chon.so_ban,
        tong_cho: goi.chon.tong_cho,
        ban: goi.chon.ban.map((b) => b.ten),
      });
    }
  }
  return kq;
}

// ------------------------------------------------------------- so do ban

/**
 * So do ban cho mot khung gio - du lieu de ve mat bang nha hang.
 *
 * `choKhach = true` la ban cong khai: KHONG kem ten khach, so dien thoai hay
 * ma reservation cua nguoi khac. Mot so do ban tren trang cong khai ma hien ten
 * nguoi dat la ro ri du lieu ca nhan, du no chi nam trong mot the div.
 */
async function soDoBan({
  ngay, gio, thoiLuong = null, soKhach = 2, areaId = null, choKhach = false, boQuaId = null,
}) {
  const ch = await qt.docCauHinh();
  const khung = qt.phanTichKhungGio({
    reservation_date: ngay,
    start_time: gio,
    guest_count: soKhach,
    duration_minutes: thoiLuong || undefined,
  }, ch);

  const { tatCa, dsO } = await banKhaDung(khung, { areaId, boQuaId, chiChoDat: false });

  // Thong tin luot dat dang chiem tung ban - chi doc khi la man hinh nhan vien.
  let theoban = new Map();
  if (!choKhach) {
    const [rows] = await db.query(
      `SELECT DISTINCT l.table_id, r.id, r.reservation_code, r.customer_name, r.phone,
              r.guest_count, r.status, r.customer_type, r.start_time, r.expected_end_time,
              r.special_requests, r.occasion
         FROM reservation_slot_locks l
         JOIN reservations r ON r.id = l.reservation_id
        WHERE l.slot_start IN (?)`, [dsO]);
    theoban = new Map(rows.map((r) => [Number(r.table_id), r]));
  }

  const dsKhu = await docKhuVuc({ chiChoDat: false });

  const ban = tatCa.map((b) => {
    const r = theoban.get(b.id) || null;
    return {
      id: b.id,
      ten: b.ten,
      so_cho: b.so_cho,
      x: b.x,
      y: b.y,
      khu_vuc_id: b.khu_vuc_id,
      khu_vuc: b.khu_vuc,
      trang_thai_ban: Number(b.trang_thai),
      kha_dung: b.kha_dung,
      ly_do: b.ly_do,
      thuoc_tinh: {
        gan_cua_so: b.gan_cua_so,
        yen_tinh: b.yen_tinh,
        phong_rieng: b.phong_rieng,
        xe_lan: b.xe_lan,
        uu_tien_vip: b.uu_tien_vip,
        co_the_ghep: b.co_the_ghep,
        cho_dat_truoc: !!b.cho_dat_truoc,
      },
      ghi_chu: b.ghi_chu,
      reservation: r ? {
        id: r.id,
        ma: r.reservation_code,
        khach: r.customer_name,
        dien_thoai: r.phone,
        so_khach: r.guest_count,
        trang_thai: r.status,
        loai_khach: r.customer_type,
        tu: qt.gioNgan(String(r.start_time)),
        den: qt.gioNgan(String(r.expected_end_time)),
        dip: r.occasion,
        yeu_cau: r.special_requests,
      } : null,
    };
  });

  return {
    khung: {
      ngay: khung.ngay,
      tu: qt.gioNgan(khung.batDau),
      den: qt.gioNgan(khung.ketThuc),
      thoi_luong: khung.thoiLuong,
      dem_don: khung.demDon,
    },
    khu_vuc: dsKhu,
    ban,
    tong_ket: {
      tong_ban: ban.length,
      trong: ban.filter((b) => b.kha_dung).length,
      tong_cho_trong: ban.filter((b) => b.kha_dung).reduce((s, b) => s + b.so_cho, 0),
    },
  };
}

// ------------------------------------------------------------ chiem / nha o

/**
 * Ghi day o cho mot reservation - day la HANG RAO chong dat trung.
 *
 * Phai goi TRONG transaction dang mo cua nguoi goi. Neu bat ky o nao da co chu,
 * MySQL nem ER_DUP_ENTRY va ham nay doi thanh loi nghiep vu doc duoc. Khong bat
 * roi bo qua: mot o khong ghi duoc nghia la ban do da bi nguoi khac lay, va
 * reservation nay khong duoc phep ton tai.
 */
async function chiemO(conn, reservationId, dsBanId, khung) {
  const dsO = qt.dayO(khung.ngay, khung.batDau, khung.ketThuc, khung.demDon);
  if (!dsO.length) throw new LoiDatBan('Khung giờ không hợp lệ', 'BAD_SLOT');

  const gia = [];
  for (const banId of dsBanId) {
    for (const o of dsO) gia.push([Number(banId), o, reservationId]);
  }

  try {
    await conn.query(
      'INSERT INTO reservation_slot_locks (table_id, slot_start, reservation_id) VALUES ?', [gia]);
  } catch (e) {
    if (e.code === LOI_TRUNG || e.errno === 1062) {
      throw new LoiDatBan(
        'Rất tiếc, bàn vừa có khách khác đặt trong lúc bạn thao tác. '
        + 'Vui lòng chọn lại bàn hoặc khung giờ khác.', 'RACE_LOST');
    }
    throw e;
  }
}

/** Tra o ve cho he thong - dung khi huy, tu choi, no-show hoac doi lich. */
async function nhaO(conn, reservationId) {
  await conn.query('DELETE FROM reservation_slot_locks WHERE reservation_id = ?', [reservationId]);
}

/**
 * Ghi lai anh xa reservation <-> ban trong `reservation_tables`.
 *
 * Bang nay la ban doc de bao cao va hien thi; `reservation_slot_locks` moi la
 * bang chan trung. Giu ca hai vi mot cau JOIN de lay "reservation nay ngoi ban
 * nao" khong nen phai gom 8 dong o luoi lai.
 */
async function ghiBan(conn, reservationId, dsBan) {
  await conn.query('DELETE FROM reservation_tables WHERE reservation_id = ?', [reservationId]);
  if (!dsBan.length) return;
  await conn.query(
    'INSERT INTO reservation_tables (reservation_id, table_id, seats) VALUES ?',
    [dsBan.map((b) => [reservationId, b.id, b.so_cho])]);
}

module.exports = {
  DIEM,
  docBan,
  docKhuVuc,
  banBiChiem,
  lyDoKhongDung,
  banKhaDung,
  soThichTu,
  chamDiem,
  timToHop,
  goiYXepBan,
  khungGioThayThe,
  khuVucThayThe,
  soDoBan,
  chiemO,
  nhaO,
  ghiBan,
};
