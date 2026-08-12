const fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const than=fs.readFileSync(path.join(__dirname,'so-do-he-thong.html'),'utf8');
fs.writeFileSync(path.join(__dirname,'xem.html'),
`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${than}</body></html>`,'utf8');
(async()=>{
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox']});
const p=await b.newPage(); const loi=[];
p.on('pageerror',e=>loi.push('JS: '+e.message));
p.on('console',m=>{if(m.type()==='error')loi.push('console: '+m.text());});
await p.setViewport({width:1420,height:1100,deviceScaleFactor:2});
await p.goto('file:///'+path.join(__dirname,'xem.html').replace(/\\/g,'/'),{waitUntil:'load'});
const bao=await p.evaluate(()=>{
 const r={hinh:[],tranNgang:document.body.scrollWidth>window.innerWidth+1};
 document.querySelectorAll('figure.khoi-hinh').forEach((f,i)=>{
  const svg=f.querySelector('svg'); const vb=svg.getAttribute('viewBox').split(' ').map(Number);
  let tran=[],tranElip=[],tranHop=[],xuyenElip=[];
  svg.querySelectorAll('text').forEach(t=>{ if(t.getAttribute('transform'))return;
   const bb=t.getBBox();
   if(bb.x<-2||bb.y<-2||bb.x+bb.width>vb[2]+2||bb.y+bb.height>vb[3]+2) tran.push(t.textContent.trim().slice(0,30));});
  svg.querySelectorAll('g.uc').forEach(g=>{const e=g.querySelector('ellipse');
   const cx=+e.getAttribute('cx'),cy=+e.getAttribute('cy'),rx=+e.getAttribute('rx'),ry=+e.getAttribute('ry');
   g.querySelectorAll('text').forEach(t=>{const bb=t.getBBox();const dy=(bb.y+bb.height/2)-cy;
    const nua=rx*Math.sqrt(Math.max(0,1-(dy/ry)**2));
    if(bb.width/2>nua-8) tranElip.push(t.textContent.trim().slice(0,40));});});
  svg.querySelectorAll('g.viec').forEach(g=>{const box=g.querySelector('rect').getBBox();
   g.querySelectorAll('text').forEach(t=>{const bb=t.getBBox();
    if(bb.x<box.x+2||bb.x+bb.width>box.x+box.width-2) tranHop.push(t.textContent.trim().slice(0,30));});});
  const elips=[...svg.querySelectorAll('g.uc ellipse')].map(e=>({cx:+e.getAttribute('cx'),cy:+e.getAttribute('cy'),
   rx:+e.getAttribute('rx'),ry:+e.getAttribute('ry'),ten:e.parentNode.textContent.replace(/\s+/g,' ').trim().slice(0,26)}));
  svg.querySelectorAll('line.lk').forEach(ln=>{
   const x1=+ln.getAttribute('x1'),y1=+ln.getAttribute('y1'),x2=+ln.getAttribute('x2'),y2=+ln.getAttribute('y2');
   const d=Math.hypot(x2-x1,y2-y1);
   for(let k=1;k<120;k++){const u=k/120; if(u*d<6||(1-u)*d<6)continue;
    const x=x1+(x2-x1)*u,y=y1+(y2-y1)*u;
    for(const e of elips){ if(((x-e.cx)/e.rx)**2+((y-e.cy)/e.ry)**2<0.94){xuyenElip.push(e.ten);break;} }}});
  // e-lip co de len nhau khong
  let deNhau=[];
  for(let a=0;a<elips.length;a++)for(let c=a+1;c<elips.length;c++){
   const A=elips[a],B=elips[c];
   if(Math.abs(A.cx-B.cx)<A.rx+B.rx-4 && Math.abs(A.cy-B.cy)<A.ry+B.ry-4) deNhau.push(A.ten+' / '+B.ten);}
  r.hinh.push({so:i+1,vb:vb[2]+'x'+vb[3],tran,tranElip,tranHop,
   xuyenElip:[...new Set(xuyenElip)],deNhau:[...new Set(deNhau)]});});
 return r;});
console.log(JSON.stringify(bao.hinh.filter(x=>x.tran.length||x.tranElip.length||x.tranHop.length||x.xuyenElip.length||x.deNhau.length),null,1));
console.log('So hinh:',bao.hinh.length,'| tran ngang trang:',bao.tranNgang,'| loi:',loi.length?loi:'khong co');
console.log('Kich thuoc:',bao.hinh.map(x=>x.so+':'+x.vb).join('  '));
const dir=path.join(__dirname,'anh'); fs.mkdirSync(dir,{recursive:true});
const hs=await p.$$('figure.khoi-hinh .hinh-hop');
for(let i=0;i<hs.length;i++) await hs[i].screenshot({path:path.join(dir,'hinh-'+(i+1)+'.png')});
await b.close(); process.exit(0);})().catch(e=>{console.error('LOI:',e.message);process.exit(1);});
