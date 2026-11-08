/**
 * Khu QUAN TRI (/admin/*): dang nhap admin, danh muc, mon an, nhan vien, bai viet,
 * thong ke, ho so admin - va duyet lich lam viec cua quan ly (/staff/schedule/*).
 *
 * Tach nguyen van tu server.js (truoc day mot tep ~3.900 dong). Cac phu thuoc
 * dung chung (middleware phan quyen, upload, service...) do server.js truyen vao
 * de khong tao ban sao thu hai. Mount o DUNG vi tri cu trong server.js nen thu
 * tu middleware khong doi.
 */
const express = require('express');

module.exports = function ({ gioiHanDN, orderService, personnelService, requireAdmin, upload }) {
  const router = express.Router();

  // --- Admin Routes ---
  router.get('/admin/login', (req, res) => {
    res.render('admin/login', { layout: false });
  });

  router.post('/admin/login', async (req, res) => {
    const { adminuser, adminpass } = req.body;
    const biKhoa = gioiHanDN.soGiayBiKhoa(req, 'admin', adminuser);
    if (biKhoa) {
      return res.status(429).render('admin/login', { error: gioiHanDN.thongBaoKhoa(biKhoa), layout: false });
    }
    try {
      const admin = await personnelService.adminLogin(adminuser, adminpass);
      if (!admin) gioiHanDN.ghiThatBai(req, 'admin', adminuser);
      if (admin) {
        gioiHanDN.xoaDem(req, 'admin', adminuser);
        req.session.adminlogin = true;
        req.session.idadmin = admin.id_admin;
        req.session.adminuser = admin.adminuser;
        req.session.adminname = admin.Name_admin;
        res.redirect('/admin');
      } else {
        res.render('admin/login', { error: 'Incorrect username or password!', layout: false });
      }
    } catch (err) {
      console.error(err);
      res.render('admin/login', { error: 'Server error occurred.', layout: false });
    }
  });

  router.get('/admin', requireAdmin, async (req, res) => {
    try {
      const stats = await personnelService.getDashboardStats();
      res.render('admin/index', { title: 'Admin Dashboard', stats });
    } catch (err) {
      console.error(err);
      res.render('admin/index', { title: 'Admin Dashboard', stats: { revenue: 0, orders: 0, customers: 0, staff: 0 } });
    }
  });

  router.get('/admin/logout', (req, res) => {
    req.session.adminlogin = false;
    res.redirect('/admin/login');
  });

  // Category Management
  router.get('/admin/catlist', requireAdmin, async (req, res) => {
    try {
      const categories = await personnelService.getAllCategories();
      res.render('admin/catlist', { categories });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/catadd', requireAdmin, (req, res) => {
    res.render('admin/catadd');
  });

  router.post('/admin/catadd', requireAdmin, async (req, res) => {
    const { name_loai, ghichu } = req.body;
    try {
      await personnelService.addCategory(name_loai, ghichu);
      res.redirect('/admin/catlist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/catedit/:id', requireAdmin, async (req, res) => {
    try {
      const category = await personnelService.getCategoryById(req.params.id);
      if (!category) return res.redirect('/admin/catlist');
      res.render('admin/catedit', { category });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/catedit/:id', requireAdmin, async (req, res) => {
    const { name_loai, ghichu } = req.body;
    try {
      await personnelService.updateCategory(req.params.id, name_loai, ghichu);
      res.redirect('/admin/catlist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/catdel/:id', requireAdmin, async (req, res) => {
    try {
      await personnelService.deleteCategory(req.params.id);
      res.redirect('/admin/catlist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Product Management
  router.get('/admin/productlist', requireAdmin, async (req, res) => {
    try {
      const products = await personnelService.getAllProducts();
      res.render('admin/productlist', { products });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/productadd', requireAdmin, async (req, res) => {
    try {
      const categories = await personnelService.getAllCategories();
      res.render('admin/productadd', { categories });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/productadd', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      const { gia } = req.body;
      if (Number(gia) <= 0) {
        return res.send('<script>alert("Giá món ăn phải lớn hơn 0!"); history.back();</script>');
      }
      const productData = {
        name: req.body.name_mon,
        categoryId: req.body.loaimon,
        note: req.body.ghichu,
        price: req.body.gia,
        image: req.file ? req.file.filename : null
      };
      await personnelService.addProduct(productData);
      res.redirect('/admin/productlist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/productedit/:id', requireAdmin, async (req, res) => {
    try {
      const product = await personnelService.getProductById(req.params.id);
      const categories = await personnelService.getAllCategories();
      if (!product) return res.redirect('/admin/productlist');
      res.render('admin/productedit', { product, categories });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/productedit/:id', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      const { name_mon, loaimon, gia, ghichu, tinhtrang } = req.body;
      const image = req.file ? req.file.filename : null;

      if (Number(gia) <= 0) {
        return res.send('<script>alert("Giá món ăn phải lớn hơn 0!"); history.back();</script>');
      }

      await personnelService.updateProduct(req.params.id, {
        name: name_mon,
        categoryId: loaimon,
        note: ghichu,
        price: gia,
        image: image,
        tinhtrang: tinhtrang
      });
      res.redirect('/admin/productlist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/productdel/:id', requireAdmin, async (req, res) => {
    try {
      await personnelService.deleteProduct(req.params.id);
      res.redirect('/admin/productlist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });



  // --- Admin: Staff Management ---
  router.get('/admin/stafflist', requireAdmin, async (req, res) => {
    try {
      const staff = await personnelService.getAllStaff();
      res.render('admin/stafflist', { staff });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/staffadd', requireAdmin, (req, res) => {
    res.render('admin/staffadd');
  });

  router.post('/admin/staffadd', requireAdmin, async (req, res) => {
    try {
      await personnelService.addStaff(req.body);
      res.redirect('/admin/stafflist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/staffedit/:id', requireAdmin, async (req, res) => {
    try {
      const staff = await personnelService.getStaffById(req.params.id);
      res.render('admin/staffedit', { staff });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/staffedit/:id', requireAdmin, async (req, res) => {
    try {
      await personnelService.updateStaff(req.params.id, req.body);
      res.redirect('/admin/stafflist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/staffdel/:id', requireAdmin, async (req, res) => {
    try {
      await personnelService.deleteStaff(req.params.id);
      res.redirect('/admin/stafflist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // --- Admin: Blog Management ---
  router.get('/admin/bloglist', requireAdmin, async (req, res) => {
    try {
      const posts = await personnelService.getAllPosts();
      res.render('admin/bloglist', { posts });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Middleware for Manager or Admin (Chi Quan ly nha hang hoac Admin moi duoc quan ly / duyet lich)
  const requireManagerOrAdmin = (req, res, next) => {
    if (req.session && req.session.adminlogin) return next();
    if (req.session && req.session.stafflogin) {
      const vaiTro = (req.session.staffRole || '').toLowerCase();
      if (/quan ly|quanly|manager/.test(vaiTro) || (req.hoSo && req.hoSo.cap_bac <= 2 && !/ke toan|ketoan/.test(vaiTro))) return next();
    }
    return res.redirect('/admin/login');
  };

  // --- MANAGER: SCHEDULE APPROVAL ---
  router.get('/staff/schedule/approval', requireManagerOrAdmin, async (req, res) => {
    try {
      const schedules = await personnelService.getAllSchedules();
      res.render('staff/schedule-approval', { title: 'Duyệt lịch làm việc', schedules, isStaff: true });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/schedule/update/:id', requireManagerOrAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      await personnelService.updateScheduleStatus(req.params.id, status);
      res.redirect('/staff/schedule/approval');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/blogadd', requireAdmin, (req, res) => {
    res.render('admin/blogadd');
  });

  router.post('/admin/blogadd', requireAdmin, upload.single('hinh_anh'), async (req, res) => {
    const hinh_anh = req.file ? req.file.filename : null;
    try {
      await personnelService.addPost({ ...req.body, hinh_anh });
      res.redirect('/admin/bloglist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/admin/blogedit/:id', requireAdmin, async (req, res) => {
    try {
      const post = await personnelService.getPostById(req.params.id);
      res.render('admin/blogedit', { post });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/blogedit/:id', requireAdmin, upload.single('hinh_anh'), async (req, res) => {
    const hinh_anh = req.file ? req.file.filename : null;
    try {
      await personnelService.updatePost(req.params.id, { ...req.body, hinh_anh });
      res.redirect('/admin/bloglist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/blogdel/:id', requireAdmin, async (req, res) => {
    try {
      await personnelService.deletePost(req.params.id);
      res.redirect('/admin/bloglist');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });



  // --- Admin: Statistics ---
  router.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await personnelService.getDashboardStats();
      const revenueByMonth = await personnelService.getRevenueByMonth();
      const topDishes = await orderService.getTopDishes();
      res.render('admin/stats', { stats, revenueByMonth, topDishes });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // --- Admin: Profile & Password ---
  router.get('/admin/profile', requireAdmin, async (req, res) => {
    try {
      const admin = await personnelService.getAdminById(req.session.idadmin);
      res.render('admin/profile', { admin, msg: null });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/admin/profile', requireAdmin, async (req, res) => {
    const { Name_admin, adminuser } = req.body;
    try {
      await personnelService.updateAdminProfile(req.session.idadmin, { name: Name_admin, adminuser });
      // Update session
      req.session.adminname = Name_admin;
      req.session.adminuser = adminuser;

      const admin = await personnelService.getAdminById(req.session.idadmin);
      res.render('admin/profile', { admin, msg: 'Cập nhật thông tin thành công!', msgType: 'success' });
    } catch (err) {
      console.error(err);
      const admin = await personnelService.getAdminById(req.session.idadmin);
      res.render('admin/profile', { admin, msg: 'Lỗi cập nhật thông tin.', msgType: 'danger' });
    }
  });

  router.get('/admin/changepassword', requireAdmin, (req, res) => {
    res.render('admin/changepassword', { msg: null });
  });

  router.post('/admin/changepassword', requireAdmin, async (req, res) => {
    const { oldpass, newpass, repass } = req.body;
    try {
      if (newpass !== repass) {
        return res.render('admin/changepassword', { msg: 'Mật khẩu xác nhận không khớp!', msgType: 'danger' });
      }
      await personnelService.changeAdminPassword(req.session.idadmin, oldpass, newpass);
      res.render('admin/changepassword', { msg: 'Đổi mật khẩu thành công!', msgType: 'success' });
    } catch (err) {
      res.render('admin/changepassword', { msg: err.message, msgType: 'danger' });
    }
  });

  return router;
};
