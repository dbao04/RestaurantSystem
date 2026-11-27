/**
 * Khu QUAN LY BEP (/staff/kitchen/*): kho nguyen lieu, don vi tinh, cong thuc,
 * thiet bi, combo, mon, danh muc, chot ca bep. Man hinh bep (KDS) o routes/kds.js.
 *
 * Tach nguyen van tu server.js (truoc day mot tep ~3.900 dong). Cac phu thuoc
 * dung chung (middleware phan quyen, upload, service...) do server.js truyen vao
 * de khong tao ban sao thu hai. Mount o DUNG vi tri cu trong server.js nen thu
 * tu middleware khong doi.
 */
const express = require('express');

module.exports = function ({ db, equipmentService, menuService, personnelService, requireRole, upload }) {
  const router = express.Router();
  // Kho nguyen lieu theo QUYEN chuc danh (services/phanQuyenKho.js): ai co kho.xem
  // thi xem ton; nhap nhanh can kho.nhap (thu kho); danh muc NL / don vi can
  // kho.nguyen_lieu.quan_ly.
  const { canQuyen } = require('../middleware/phanQuyen');
  // Cong thuc: ai co quyen bep.cong_thuc.xem (khong gom tap vu bep). Chot ca bep:
  // truong bo phan bep / bar. Ban dieu hanh luon xem duoc.
  const vaiTroPq = require('../services/phanQuyenVaiTro');
  const phanQuyenSv = require('../services/phanQuyenService');
  const canXemCongThuc = vaiTroPq.canHoac((req) => phanQuyenSv.coQuyen(req.hoSo, 'bep.cong_thuc.xem'), 'Công thức món dành cho bộ phận chế biến (bếp, bar).');
  const canTruongBep = vaiTroPq.canHoac((req) => vaiTroPq.laTruongBep(req.hoSo), 'Chốt ca bếp dành cho trưởng bộ phận Bếp / Bar.');
  // Du lieu danh muc (mon, loai mon, gia ban): chi truong bep / bar va ban dieu hanh
  // duoc them, sua, xoa. Dau bep thuong chi bao "Tam het" tren trang mon.
  const canSuaThucDon = vaiTroPq.canHoac((req) => vaiTroPq.laTruongBep(req.hoSo), 'Thêm, sửa, xóa món và loại món dành cho Bếp trưởng / Trưởng bar.');
  const duocSuaThucDon = (req) => vaiTroPq.laDieuHanh(req.session || {}, req.hoSo) || vaiTroPq.laTruongBep(req.hoSo);

  const phanQuyen = require('../services/phanQuyenService');
  const quyenKho = (req) => {
    const c = (ma) => !!req.session.adminlogin || phanQuyen.coQuyen(req.hoSo, ma);
    return { nhap: c('kho.nhap'), xuat: c('kho.xuat'), danhMuc: c('kho.nguyen_lieu.quan_ly') };
  };

  // --- KITCHEN MANAGEMENT (Role: 'Bep') ---
  router.get('/staff/kitchen/inventory', canQuyen('kho.xem'), async (req, res) => {
    try {
      const ingredients = await menuService.getAllIngredients();
      const units = await menuService.getAllUnits();
      res.render('staff/kitchen/inventory', {
        title: 'Quản lý Kho',
        ingredients,
        units,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'inventory',
        quyenKho: quyenKho(req)
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/ingredient/add', canQuyen('kho.nguyen_lieu.quan_ly'), async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.new_dvt && data.new_dvt.trim()) {
        const ten_new = data.new_dvt.trim();
        const [existing] = await db.query('SELECT id_dvt FROM don_vi_tinh WHERE LOWER(ten_dvt) = LOWER(?)', [ten_new]);
        if (existing.length > 0) {
          data.id_dvt = existing[0].id_dvt;
        } else {
          const [result] = await db.query('INSERT INTO don_vi_tinh (ten_dvt) VALUES (?)', [ten_new]);
          data.id_dvt = result.insertId;
        }
      }
      await menuService.addIngredient(data);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/inventory/stock-in', canQuyen('kho.nhap'), async (req, res) => {
    try {
      const { id_nl, so_luong, gia_nhap, han_su_dung } = req.body;
      if (Number(so_luong) <= 0 || Number(gia_nhap) <= 0) {
        return res.send('<script>alert("Số lượng và Giá nhập phải lớn hơn 0!"); history.back();</script>');
      }
      /*
        Nhap nhanh tu trang kho cung phai sinh PHIEU NHAP that (khoBepService):
        co lo, han dung, gia von binh quan. Truoc day chi cong so luong vao
        nguyen_lieu va ghi bang nhap_kho - tong ton lech voi tong cac lo, canh
        bao het han va tru kho FIFO sai.
      */
      const kho = require('../services/khoBepService');
      try {
        // Nhap nhanh cung la mua hang that -> di qua quy trinh duyet (cho bep
        // truong kiem chat luong roi moi vao kho). Khong co o so hoa don tren
        // form nhanh nen ghi ly do; can hoa don thi dung trang Lap phieu nhap.
        var phieuMoi = await kho.taoPhieuNhap({
          ly_do_khong_chung_tu: 'Nhập nhanh từ trang Kho nguyên liệu (mua lẻ)',
          ghi_chu: 'Nhập nhanh từ trang Kho nguyên liệu',
          dong: [{ id_nl, so_luong, don_gia: gia_nhap, han_su_dung: han_su_dung || '' }],
        }, req.session.staffId);
      } catch (e) {
        if (e instanceof kho.LoiKho) {
          return res.send(`<script>alert(${JSON.stringify(e.message)}); history.back();</script>`);
        }
        throw e;
      }
      // Sang trang phieu de thay trang thai (cho kiem tra chat luong...).
      res.redirect(`/staff/kitchen/kho/phieu-nhap/${phieuMoi.id}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/ingredient/edit/:id', canQuyen('kho.nguyen_lieu.quan_ly'), async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.new_dvt && data.new_dvt.trim()) {
        const ten_new = data.new_dvt.trim();
        const [existing] = await db.query('SELECT id_dvt FROM don_vi_tinh WHERE LOWER(ten_dvt) = LOWER(?)', [ten_new]);
        if (existing.length > 0) {
          data.id_dvt = existing[0].id_dvt;
        } else {
          const [result] = await db.query('INSERT INTO don_vi_tinh (ten_dvt) VALUES (?)', [ten_new]);
          data.id_dvt = result.insertId;
        }
      }
      await menuService.updateIngredient(req.params.id, data);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/ingredient/delete/:id', canQuyen('kho.nguyen_lieu.quan_ly'), async (req, res) => {
    try {
      await menuService.deleteIngredient(req.params.id);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Unit CRUD
  router.post('/staff/kitchen/unit/add', canQuyen('kho.nguyen_lieu.quan_ly'), async (req, res) => {
    try {
      await menuService.addUnit(req.body.ten_dvt);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/unit/delete/:id', canQuyen('kho.nguyen_lieu.quan_ly'), async (req, res) => {
    try {
      await menuService.deleteUnit(req.params.id);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/unit/edit/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await menuService.updateUnit(req.params.id, req.body.ten_dvt);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Recipe delete
  router.post('/staff/kitchen/recipe/delete/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await menuService.deleteRecipeItem(req.params.id);
      res.redirect('/staff/kitchen/recipes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/stock-history', requireRole(['Bep']), async (req, res) => {
    try {
      const history = await menuService.getStockHistory();
      res.render('staff/kitchen/stock-history', {
        title: 'Lịch sử Kho',
        history,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'inventory'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/recipes', canXemCongThuc, async (req, res) => {
    try {
      const dishes = await personnelService.getAllProducts();
      const ingredients = await menuService.getAllIngredients();
      res.render('staff/kitchen/recipes', {
        title: 'Quản lý Công thức',
        dishes,
        ingredients,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'recipes'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/recipe/:dishId', requireRole(['Bep']), async (req, res) => {
    try {
      const recipe = await menuService.getRecipeByDish(req.params.dishId);
      res.json(recipe);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/staff/kitchen/recipe/add', requireRole(['Bep']), async (req, res) => {
    try {
      const { id_mon, id_nl, so_luong_tieu_hao } = req.body;
      await menuService.addRecipeItem(id_mon, id_nl, so_luong_tieu_hao);
      res.redirect('/staff/kitchen/recipes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/recipe/edit/:id', requireRole(['Bep']), async (req, res) => {
    try {
      const { id_mon, id_nl, so_luong } = req.body;
      await menuService.updateRecipeItem(req.params.id, id_mon, id_nl, so_luong);
      res.redirect('/staff/kitchen/recipes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/equipment', requireRole(['Bep']), async (req, res) => {
    try {
      const equipment = await equipmentService.getAllEquipment();
      res.render('staff/kitchen/equipment', {
        title: 'Quản lý Thiết bị',
        equipment,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'equipment'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/equipment/add', requireRole(['Bep']), async (req, res) => {
    try {
      await equipmentService.addEquipment(req.body);
      res.redirect('/staff/kitchen/equipment');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/equipment/edit/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await equipmentService.updateEquipment(req.params.id, req.body);
      res.redirect('/staff/kitchen/equipment');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/equipment/delete/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await equipmentService.deleteEquipment(req.params.id);
      res.redirect('/staff/kitchen/equipment');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Combo CRUD
  router.post('/staff/kitchen/combo/add', requireRole(['Bep']), upload.single('hinh_anh'), async (req, res) => {
    try {
      const hinh_anh = req.file ? req.file.filename : null;
      await menuService.addCombo({ ...req.body, hinh_anh });
      res.redirect('/staff/kitchen/combos');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/combo/edit/:id', requireRole(['Bep']), upload.single('hinh_anh'), async (req, res) => {
    try {
      const hinh_anh = req.file ? req.file.filename : null;
      await menuService.updateCombo(req.params.id, { ...req.body, hinh_anh });
      res.redirect('/staff/kitchen/combos');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/combo/delete/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await menuService.deleteCombo(req.params.id);
      res.redirect('/staff/kitchen/combos');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Tram quan ly mon: Bar chi do uong (loai DRINK / SAKE - BEER), Bep chi mon an, Ban dieu hanh tat ca.
  const LA_DO_UONG = (tenLoai) => /DRINK|SAKE|BEER/i.test(String(tenLoai || ''));
  const tramMon = (req) => {
    const phien = req.session || {};
    if (phien.adminlogin || phien.staffRole === 'Quan ly' || (req.hoSo && req.hoSo.ma_bp === 'DH')) return null;
    return req.hoSo && req.hoSo.ma_bp === 'BAR' ? 'bar' : 'bep';
  };
  const dungTram = (req, tenLoai) => { const t = tramMon(req); return !t || (t === 'bar') === LA_DO_UONG(tenLoai); };
  const tenLoaiCuaMon = async (idMon) => { const [[r]] = await db.query('SELECT m.name_mon, l.name_loai FROM monan m LEFT JOIN loai_mon l ON l.id_loai = m.id_loai WHERE m.id_mon = ?', [idMon]); return r || null; };
  const TU_CHOI_TRAM = (req) => (tramMon(req) === 'bar' ? 'Bar chỉ quản lý đồ uống.' : 'Bếp chỉ quản lý món ăn; đồ uống do Bar quản lý.');

  router.post('/staff/kitchen/dish/:id/trang-thai', requireRole(['Bep']), async (req, res) => {
    try {
      const m = await tenLoaiCuaMon(Number(req.params.id));
      if (!m) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy món.' });
      if (!dungTram(req, m.name_loai)) return res.status(403).json({ ok: false, thong_bao: TU_CHOI_TRAM(req) });
      const ban = Number((req.body || {}).tinhtrang) === 1;
      await personnelService.setTrangThaiMon(Number(req.params.id), ban ? 1 : 0);
      require('../services/thongBaoService').gui('mon_tam_ngung', {
        tieuDe: `${String(m.name_mon).trim()} ${ban ? 'đã bán lại' : 'tạm hết'}`,
        noiDung: ban ? 'Món đã có lại trên thực đơn.' : 'Báo khách khi gọi món này; món đã ẩn khỏi thực đơn.',
        link: '/staff/kitchen/dishes', mucDo: ban ? 'tin' : 'quan_trong', truNv: req.session.staffId,
      }).catch(() => {});
      res.json({ ok: true, tinhtrang: ban ? 1 : 0 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, thong_bao: 'Không cập nhật được, thử lại.' });
    }
  });

  // Dish manage by Kitchen
  router.post('/staff/kitchen/dish/add', canSuaThucDon, upload.single('images'), async (req, res) => {
    try {
      const [[loai]] = await db.query('SELECT name_loai FROM loai_mon WHERE id_loai = ?', [req.body.id_loai]);
      if (!loai || !dungTram(req, loai.name_loai)) return res.status(403).send(TU_CHOI_TRAM(req));
      if (!(Number(req.body.gia_mon) > 0)) return res.status(400).send('<script>alert("Giá món phải lớn hơn 0!"); history.back();</script>');
      const image = req.file ? req.file.filename : null;
      await personnelService.addProduct({ name: req.body.name_mon, categoryId: req.body.id_loai, note: req.body.ghichu_mon, price: req.body.gia_mon, image });
      res.redirect('/staff/kitchen/dishes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Sua mon: kiem tra tram ca loai CU lan loai MOI - Bar khong duoc keo mon an
  // sang loai do uong de sua (va nguoc lai). Giu nguyen trang thai ban hien tai;
  // bat / tat ban da co nut "Tam het" rieng.
  router.post('/staff/kitchen/dish/edit/:id', canSuaThucDon, upload.single('images'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const mon = await personnelService.getProductById(id);
      if (!mon) return res.status(404).send('Không tìm thấy món.');
      const [[loaiCu]] = await db.query('SELECT name_loai FROM loai_mon WHERE id_loai = ?', [mon.id_loai]);
      const [[loaiMoi]] = await db.query('SELECT name_loai FROM loai_mon WHERE id_loai = ?', [req.body.id_loai]);
      if (!loaiMoi || !dungTram(req, loaiMoi.name_loai) || (loaiCu && !dungTram(req, loaiCu.name_loai))) {
        return res.status(403).send(TU_CHOI_TRAM(req));
      }
      if (!(Number(req.body.gia_mon) > 0)) return res.status(400).send('<script>alert("Giá món phải lớn hơn 0!"); history.back();</script>');
      await personnelService.updateProduct(id, {
        name: req.body.name_mon, categoryId: req.body.id_loai, note: req.body.ghichu_mon,
        price: req.body.gia_mon, image: req.file ? req.file.filename : null, tinhtrang: mon.tinhtrang,
      });
      res.redirect('/staff/kitchen/dishes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/dish/delete/:id', canSuaThucDon, async (req, res) => {
    try {
      const m = await tenLoaiCuaMon(Number(req.params.id));
      if (m && !dungTram(req, m.name_loai)) return res.status(403).send(TU_CHOI_TRAM(req));
      await personnelService.deleteProduct(req.params.id);
      res.redirect('/staff/kitchen/dishes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Loai mon cung chia tram nhu mon: Bar chi them / sua / xoa loai do uong.
  const loaiDungTram = async (req, idLoai) => {
    const [[l]] = await db.query('SELECT name_loai FROM loai_mon WHERE id_loai = ?', [idLoai]);
    return !!l && dungTram(req, l.name_loai);
  };

  // Category CRUD by Kitchen
  router.post('/staff/kitchen/categories/add', canSuaThucDon, async (req, res) => {
    try {
      if (!dungTram(req, req.body.name_loai)) return res.status(403).send(TU_CHOI_TRAM(req));
      await personnelService.addCategory(req.body.name_loai, req.body.ghichu);
      res.redirect('/staff/kitchen/categories');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/categories/edit/:id', canSuaThucDon, async (req, res) => {
    try {
      if (!(await loaiDungTram(req, req.params.id)) || !dungTram(req, req.body.name_loai)) return res.status(403).send(TU_CHOI_TRAM(req));
      await personnelService.updateCategory(req.params.id, req.body.name_loai, req.body.ghichu);
      res.redirect('/staff/kitchen/categories');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/categories/delete/:id', canSuaThucDon, async (req, res) => {
    try {
      if (!(await loaiDungTram(req, req.params.id))) return res.status(403).send(TU_CHOI_TRAM(req));
      await personnelService.deleteCategory(req.params.id);
      res.redirect('/staff/kitchen/categories');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/combos', requireRole(['Bep']), async (req, res) => {
    try {
      const combos = await menuService.getAllCombos();
      res.render('staff/kitchen/combos', {
        title: 'Quản lý Combo',
        combos,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'kitchen-menu'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/categories', canSuaThucDon, async (req, res) => {
    try {
      const categories = (await personnelService.getAllCategories()).filter((c) => dungTram(req, c.name_loai));
      res.render('staff/kitchen/categories', {
        title: 'Quản lý Loại món',
        categories,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'kitchen-categories'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/dishes', requireRole(['Bep']), async (req, res) => {
    try {
      const tram = tramMon(req);
      const dishes = (await personnelService.getAllProducts()).filter((d) => dungTram(req, d.name_loai));
      const categories = (await personnelService.getAllCategories()).filter((c) => dungTram(req, c.name_loai));
      res.render('staff/kitchen/dishes', {
        title: tram === 'bar' ? 'Quản lý đồ uống' : 'Quản lý Món ăn',
        tram,
        dishes,
        categories,
        duocSua: duocSuaThucDon(req),
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'kitchen-dishes'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/shift', canTruongBep, async (req, res) => {
    try {
      const [history] = await db.query(`
        SELECT c.*, n.ten as ten_nv 
        FROM chot_ca c 
        JOIN nhan_vien n ON c.staff_id = n.id_nv 
        ORDER BY c.created_at DESC 
        LIMIT 20
      `);
      res.render('staff/kitchen/shift', {
        title: 'Chốt ca Bếp',
        history,
        msg: req.query.msg || null,
        msgType: req.query.msgType || 'success',
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'kitchen-shift'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });


  // --- KITCHEN SHIFT CLOSE (POST) ---
  router.post('/staff/kitchen/shift/close', requireRole(['Bep']), async (req, res) => {
    try {
      const { ngay, ca, tong_tien, ghi_chu } = req.body;
      if (!ngay || !ca) {
        return res.send('<script>alert("Vui lòng điền đầy đủ thông tin chốt ca!"); history.back();</script>');
      }
      await db.query(
        'INSERT INTO chot_ca (staff_id, ngay, ca, tong_tien, ghi_chu) VALUES (?, ?, ?, ?, ?)',
        [req.session.staffId, ngay, ca, tong_tien || 0, ghi_chu || '']
      );
      res.redirect('/staff/kitchen/shift?msg=Chốt+ca+thành+công!&msgType=success');
    } catch (err) {
      console.error('Lỗi chốt ca bếp:', err);
      res.status(500).send('Server Error: ' + err.message);
    }
  });

  return router;
};
