(function (LG) {
  const DMY_RE = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/;
  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function pad(n, w) {
    return String(n).padStart(w, '0');
  }

  function build(y, m, d) {
    if (!(y >= 1 && m >= 1 && m <= 12 && d >= 1)) return null;
    const dim = new Date(Date.UTC(2000, m, 0)).getUTCDate();
    const feb = m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : dim;
    if (d > feb) return null;
    return pad(y, 4) + '-' + pad(m, 2) + '-' + pad(d, 2);
  }

  function parseDate(v) {
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      return build(v.getFullYear(), v.getMonth() + 1, v.getDate());
    }
    if (typeof v === 'number') {
      if (!(v >= 1 && v <= 2958465)) return null;
      const p = XLSX.SSF.parse_date_code(v);
      return p ? build(p.y, p.m, p.d) : null;
    }
    if (typeof v === 'string') {
      const s = v.trim();
      let m = DMY_RE.exec(s);
      if (m) return build(+m[3], +m[2], +m[1]);
      m = ISO_RE.exec(s);
      if (m) return build(+m[1], +m[2], +m[3]);
    }
    return null;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return d + '-' + m + '-' + y;
  }

  function todayISO(now = new Date()) {
    return pad(now.getFullYear(), 4) + '-' + pad(now.getMonth() + 1, 2) + '-' + pad(now.getDate(), 2);
  }

  function addDaysISO(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return pad(t.getUTCFullYear(), 4) + '-' + pad(t.getUTCMonth() + 1, 2) + '-' + pad(t.getUTCDate(), 2);
  }

  LG.dates = { parseDate, formatDate, todayISO, addDaysISO };
})(globalThis.LG = globalThis.LG || {});
