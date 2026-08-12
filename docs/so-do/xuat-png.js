// Ket xuat tung file SVG roi thanh PNG do phan giai cao de chen vao Word.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const thuMucSvg = path.join(__dirname, 'svg');
const thuMucPng = path.join(__dirname, 'png');
fs.mkdirSync(thuMucPng, { recursive: true });

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const loi = [];
  p.on('pageerror', (e) => loi.push(e.message));
  for (const ten of fs.readdirSync(thuMucSvg).filter((f) => f.endsWith('.svg'))) {
    const duong = 'file:///' + path.join(thuMucSvg, ten).replace(/\\/g, '/');
    await p.goto(duong, { waitUntil: 'load' });
    const vb = await p.evaluate(() => {
      const s = document.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
      document.documentElement.style.background = '#fff';
      return { w: Math.ceil(s[2]), h: Math.ceil(s[3]) };
    });
    await p.setViewport({ width: vb.w, height: vb.h, deviceScaleFactor: 3 });
    await p.goto(duong, { waitUntil: 'load' });
    const ra = path.join(thuMucPng, ten.replace('.svg', '.png'));
    await p.screenshot({ path: ra, omitBackground: false });
    const kb = (fs.statSync(ra).size / 1024).toFixed(0);
    console.log(ten.padEnd(13), vb.w + 'x' + vb.h, '-> PNG', (vb.w * 3) + 'x' + (vb.h * 3), kb + ' KB');
  }
  console.log('Loi:', loi.length ? loi : 'khong co');
  await b.close(); process.exit(0);
})().catch((e) => { console.error('LOI:', e.message); process.exit(1); });
