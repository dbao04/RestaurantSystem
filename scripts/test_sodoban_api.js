const http = require('http');

function postLogin() {
  return new Promise((resolve, reject) => {
    const postData = 'username=quanly&password=123456';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/staff/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      const cookie = res.headers['set-cookie'];
      resolve(cookie ? cookie[0] : null);
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJson(path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'GET',
      headers: { Cookie: cookie }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('HTML / Error response: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const cookie = await postLogin();
  console.log('Login OK, cookie:', cookie ? cookie.split(';')[0] : 'None');

  const today = await getJson('/so-do-ban/api/du-lieu', cookie);
  console.log('API Hôm nay: Số bàn =', today.ban.length, ', Thống kê =', today.thong_ke);

  const tomorrow = await getJson('/so-do-ban/api/du-lieu?ngay=2026-10-10', cookie);
  console.log('API Ngày mai (2026-10-10): Số bàn =', tomorrow.ban.length, ', Thống kê =', tomorrow.thong_ke);
}

run().catch(console.error);
