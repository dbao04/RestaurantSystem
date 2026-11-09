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

  // --- KITCHEN MANAGEMENT (Role: 'Bep') ---
  router.get('/staff/kitchen/inventory', requireRole(['Bep']), async (req, res) => {
    try {
      const ingredients = await menuService.getAllIngredients();
      const units = await menuService.getAllUnits();
      res.render('staff/kitchen/inventory', {
        title: 'Quản lý Kho',
        ingredients,
        units,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'inventory'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/ingredient/add', requireRole(['Bep']), async (req, res) => {
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

  router.post('/staff/kitchen/inventory/stock-in', requireRole(['Bep']), async (req, res) => {
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
        await kho.taoPhieuNhap({
          ghi_chu: 'Nhập nhanh từ trang Kho nguyên liệu',
          dong: [{ id_nl, so_luong, don_gia: gia_nhap, han_su_dung: han_su_dung || '' }],
        }, req.session.staffId);
      } catch (e) {
        if (e instanceof kho.LoiKho) {
          return res.send(`<script>alert(${JSON.stringify(e.message)}); history.back();</script>`);
        }
        throw e;
      }
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/ingredient/edit/:id', requireRole(['Bep']), async (req, res) => {
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

  router.post('/staff/kitchen/ingredient/delete/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await menuService.deleteIngredient(req.params.id);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Unit CRUD
  router.post('/staff/kitchen/unit/add', requireRole(['Bep']), async (req, res) => {
    try {
      await menuService.addUnit(req.body.ten_dvt);
      res.redirect('/staff/kitchen/inventory');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/unit/delete/:id', requireRole(['Bep']), async (req, res) => {
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

  router.get('/staff/kitchen/recipes', requireRole(['Bep']), async (req, res) => {
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

  // Dish manage by Kitchen
  router.post('/staff/kitchen/dish/add', requireRole(['Bep']), upload.single('images'), async (req, res) => {
    try {
      const image = req.file ? req.file.filename : null;
      await personnelService.addProduct({ name: req.body.name_mon, categoryId: req.body.id_loai, note: req.body.ghichu_mon, price: req.body.gia_mon, image });
      res.redirect('/staff/kitchen/dishes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/dish/delete/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await personnelService.deleteProduct(req.params.id);
      res.redirect('/staff/kitchen/dishes');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Category CRUD by Kitchen
  router.post('/staff/kitchen/categories/add', requireRole(['Bep']), async (req, res) => {
    try {
      await personnelService.addCategory(req.body.name_loai, req.body.ghichu);
      res.redirect('/staff/kitchen/categories');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/categories/edit/:id', requireRole(['Bep']), async (req, res) => {
    try {
      await personnelService.updateCategory(req.params.id, req.body.name_loai, req.body.ghichu);
      res.redirect('/staff/kitchen/categories');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/kitchen/categories/delete/:id', requireRole(['Bep']), async (req, res) => {
    try {
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

  router.get('/staff/kitchen/categories', requireRole(['Bep']), async (req, res) => {
    try {
      const categories = await personnelService.getAllCategories();
      res.render('staff/kitchen/categories', {
        title: 'Quản lý Loại món',
        categories,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'kitchen-menu'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/dishes', requireRole(['Bep']), async (req, res) => {
    try {
      const dishes = await personnelService.getAllProducts();
      const categories = await personnelService.getAllCategories();
      res.render('staff/kitchen/dishes', {
        title: 'Quản lý Món ăn',
        dishes,
        categories,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'kitchen-menu'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/kitchen/shift', requireRole(['Bep']), async (req, res) => {
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
