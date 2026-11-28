/**
 * Trang loi ngan "bao loi roi quay lai form": thay cho
 *   res.send('<script>alert("..."); history.back();</script>')
 * Nap thong-bao-dep.js truoc nen alert() dung hop thong bao moi; hang doi luu
 * sessionStorage nen thong bao hien tren chinh trang form sau khi quay lai.
 */
function baoLoiQuayLai(res, noiDung, status = 200) {
  const m = JSON.stringify(String(noiDung == null ? '' : noiDung)).replace(/</g, '\\u003c');
  return res.status(status).send(
    '<!doctype html><meta charset="utf-8"><script src="/thong-bao-dep.js?v=3"></script>'
    + `<script>alert(${m}); history.back();</script>`);
}
module.exports = baoLoiQuayLai;
