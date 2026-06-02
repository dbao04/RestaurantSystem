/**
 * ROUTES: General Staff Features (Nhân viên chung)
 * Common features for all staff members
 */

const express = require('express');
const router = express.Router();
const { requireStaffLogin, requirePermission, auditLog } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const generalStaffService = require('../services/generalStaffService');
const personnelService = require('../services/personnelService');
const auditService = require('../services/auditService');

/**
 * GENERAL STAFF DASHBOARD
 */
router.get('/', requireStaffLogin, asyncHandler(async (req, res) => {
  const stats = await generalStaffService.getDashboardStats(req.session.staffId);
  const schedule = await generalStaffService.getUpcomingSchedule(req.session.staffId, 7);
  const attendance = await generalStaffService.getTodayAttendance(req.session.staffId);
  const unread = await personnelService.countUnread(req.session.staffId);
  
  res.render('staff/general-dashboard', {
    title: 'Bảng điều khiển',
    stats,
    upcomingSchedule: schedule,
    todayAttendance: attendance,
    unread
  });
}));

/**
 * ATTENDANCE MANAGEMENT
 */
router.post('/check-in', requireStaffLogin, auditLog('staff_check_in'), asyncHandler(async (req, res) => {
  await generalStaffService.checkIn(req.session.staffId);
  
  // Log attendance action
  await auditService.log({
    action: 'staff_check_in',
    actor_type: 'staff',
    actor_id: req.session.staffId,
    actor_name: req.session.staffName,
    status: 'success',
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });
  
  res.redirect('/staff?msg=Chấm+công+vào+thành+công&msgType=success');
}));

router.post('/check-out', requireStaffLogin, auditLog('staff_check_out'), asyncHandler(async (req, res) => {
  await generalStaffService.checkOut(req.session.staffId);
  
  // Log attendance action
  await auditService.log({
    action: 'staff_check_out',
    actor_type: 'staff',
    actor_id: req.session.staffId,
    actor_name: req.session.staffName,
    status: 'success',
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });
  
  res.redirect('/staff?msg=Chấm+công+ra+thành+công&msgType=success');
}));

router.get('/attendance', requireStaffLogin, asyncHandler(async (req, res) => {
  const [year, month] = (req.query.thang || new Date().toISOString().slice(0, 7)).split('-').map(Number);
  const report = await generalStaffService.getMonthlyAttendanceReport(req.session.staffId, month, year);
  const unread = await personnelService.countUnread(req.session.staffId);
  
  res.render('staff/general-attendance', {
    title: 'Chấm công cá nhân',
    report,
    month,
    year,
    currentMonth: req.query.thang || new Date().toISOString().slice(0, 7),
    unread
  });
}));

/**
 * SCHEDULE REGISTRATION
 */
router.get('/schedule-register', requireStaffLogin, asyncHandler(async (req, res) => {
  const [year, month] = (req.query.thang || new Date().toISOString().slice(0, 7)).split('-').map(Number);
  const availability = await generalStaffService.getPersonalAvailability(req.session.staffId, month, year);
  const unread = await personnelService.countUnread(req.session.staffId);
  
  res.render('staff/general-schedule-register', {
    title: 'Đăng ký lịch làm việc',
    availability,
    month,
    year,
    unread
  });
}));

router.post('/schedule-register', requireStaffLogin, auditLog('register_shift'), asyncHandler(async (req, res) => {
  const { date, shift, notes } = req.body;
  
  await generalStaffService.registerShift(req.session.staffId, date, shift, notes);
  
  await auditService.log({
    action: 'register_shift',
    actor_type: 'staff',
    actor_id: req.session.staffId,
    actor_name: req.session.staffName,
    details: { date, shift },
    status: 'success',
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });
  
  res.redirect('/staff/general/schedule-register?msg=Đăng+ký+lịch+thành+công&msgType=success');
}));

router.get('/schedule-register/cancel/:id', requireStaffLogin, auditLog('cancel_shift'), asyncHandler(async (req, res) => {
  await generalStaffService.cancelShiftRegistration(req.session.staffId, req.params.id);
  
  await auditService.log({
    action: 'cancel_shift',
    actor_type: 'staff',
    actor_id: req.session.staffId,
    actor_name: req.session.staffName,
    resource_id: req.params.id,
    status: 'success',
    ip_address: req.ip
  });
  
  res.redirect('/staff/general/schedule-register?msg=Hủy+đăng+ký+thành+công&msgType=success');
}));

/**
 * NOTIFICATIONS
 */
router.get('/notifications', requireStaffLogin, asyncHandler(async (req, res) => {
  const notifications = await generalStaffService.getPersonalNotifications(req.session.staffId);
  const unread = await personnelService.countUnread(req.session.staffId);
  
  res.render('staff/general-notifications', {
    title: 'Thông báo',
    notifications,
    unread
  });
}));

router.get('/notifications/:id/read', requireStaffLogin, asyncHandler(async (req, res) => {
  await generalStaffService.markNotificationAsRead(req.params.id, req.session.staffId);
  res.redirect(req.get('referer') || '/staff/general/notifications');
}));

module.exports = router;
