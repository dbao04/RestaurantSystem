/**
 * Cau hinh pm2: chay web Node va dich vu AI Python, tu bat lai khi loi hoac
 * khi VPS khoi dong lai. Dung: pm2 startOrReload deploy/ecosystem.config.js
 */
const path = require('path');
const GOC = path.join(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'nhahang',
      cwd: GOC,
      script: 'server.js',
      // Mot tien trinh: Socket.IO, gioi han dang nhap va tac vu nen dang giu
      // trang thai trong bo nho, chay nhieu ban (cluster) se lech nhau.
      instances: 1,
      max_memory_restart: '700M',
      env: { NODE_ENV: 'production' },
      time: true,
    },
    {
      name: 'ml',
      cwd: GOC,
      script: path.join(GOC, '.venv', 'bin', 'python'),
      args: '-m uvicorn ml_service.main:app --host 127.0.0.1 --port 8000',
      interpreter: 'none',
      max_memory_restart: '1G',
      time: true,
    },
  ],
};
