/* PostgREST จำลองในหน้าเว็บ — ใช้ตอนจับภาพหน้าจอประกอบเอกสารส่งมอบเท่านั้น
   ทับ dg/dp/dpa/dd ด้วยการกรองข้อมูลจาก window.__FIX (fixtures.mjs) ตามไวยากรณ์ query ของ PostgREST
   ที่โค้ดจริงใช้: eq/neq/gt/gte/lt/lte/like/ilike/is/in, not.*, or=(...)/and(...), order, limit, select */
(function () {
  const FIX = window.__FIX;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
  function parseTok(tok) {
    const m = tok.match(/^(and|or)\((.*)\)$/s); if (m) return { logic: m[1], items: splitTop(m[2]).map(parseTok) };
    const i = tok.indexOf('.'); const col = tok.slice(0, i); let rest = tok.slice(i + 1), neg = false;
    if (rest.startsWith('not.')) { neg = true; rest = rest.slice(4); }
    const j = rest.indexOf('.'); const op = rest.slice(0, j); let val = rest.slice(j + 1);
    try { val = decodeURIComponent(val); } catch (e) { }
    return { col, op, val, neg };
  }
  function cmp(a, b) { const na = Number(a), nb = Number(b); if (a !== '' && b !== '' && !isNaN(na) && !isNaN(nb)) return na - nb; a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }
  function test(row, f) {
    if (f.logic) return f.logic === 'and' ? f.items.every(x => test(row, x)) : f.items.some(x => test(row, x));
    const v = row[f.col], val = f.val; let r;
    switch (f.op) {
      case 'eq': r = v != null && String(v) === val; break;
      case 'neq': r = v == null || String(v) !== val; break;
      case 'gt': r = v != null && cmp(v, val) > 0; break;
      case 'gte': r = v != null && cmp(v, val) >= 0; break;
      case 'lt': r = v != null && cmp(v, val) < 0; break;
      case 'lte': r = v != null && cmp(v, val) <= 0; break;
      case 'is': r = val === 'null' ? v == null : val === 'true' ? v === true : val === 'false' ? v === false : false; break;
      case 'in': { const list = val.replace(/^\(|\)$/g, '').split(',').map(x => x.trim().replace(/^"|"$/g, '')); r = v != null && list.includes(String(v)); break; }
      case 'like': case 'ilike': { const re = new RegExp('^' + val.split('*').map(esc).join('.*') + '$', f.op === 'ilike' ? 'i' : ''); r = v != null && re.test(String(v)); break; }
      default: r = true;
    }
    return f.neg ? !r : r;
  }
  function query(table, q) {
    let rows = FIX[table]; if (!rows) return { message: 'relation "' + table + '" does not exist', code: '42P01' };
    const filters = []; let select = null, order = [], limit = null, offset = 0;
    String(q || '').replace(/^\?/, '').split('&').forEach(p => {
      if (!p) return; const i = p.indexOf('='); const k = p.slice(0, i), v = p.slice(i + 1);
      if (k === 'select') select = v; else if (k === 'order') order = v.split(',').map(o => { const parts = o.split('.'); return [parts[0], parts[1] === 'desc' ? -1 : 1]; });
      else if (k === 'limit') limit = Number(v); else if (k === 'offset') offset = Number(v);
      else if (k === 'or' || k === 'and') filters.push(parseTok(k + v)); else filters.push(parseTok(k + '.' + v));
    });
    rows = rows.filter(r => filters.every(f => test(r, f)));
    if (order.length) rows = rows.slice().sort((a, b) => { for (const [c, d] of order) { const x = cmp(a[c] == null ? '' : a[c], b[c] == null ? '' : b[c]); if (x) return x * d; } return 0; });
    if (offset) rows = rows.slice(offset); if (limit != null) rows = rows.slice(0, limit);
    if (select && select !== '*') { const cols = splitTop(select).map(c => c.replace(/\(.*\)$/, '').split(':').pop().trim()).filter(c => c && c !== '*'); if (cols.length) rows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]]))); }
    return JSON.parse(JSON.stringify(rows));
  }
  let seq = 0;
  window.__REST_LOG = [];
  window.dg = async function (t, q) { window.__REST_LOG.push(['GET', t, q]); return query(t, q); };
  window.dp = async function (t, b) { window.__REST_LOG.push(['POST', t, b]); const rows = Array.isArray(b) ? b : [b]; const out = rows.map(r => { const row = Object.assign({ id: t + '-new-' + (++seq), created_at: new Date().toISOString() }, r); (FIX[t] = FIX[t] || []).push(row); return row; }); return JSON.parse(JSON.stringify(out)); };
  window.dpa = async function (t, id, b) { window.__REST_LOG.push(['PATCH', t, id, b]); const row = (FIX[t] || []).find(r => String(r.id) === String(id)); if (!row) throw new Error('RLS/0 rows affected'); Object.assign(row, b); return [JSON.parse(JSON.stringify(row))]; };
  window.dd = async function (t, id) { window.__REST_LOG.push(['DELETE', t, id]); if (t === 'document_history' || t === 'notifications') throw new Error('protected'); const arr = FIX[t] || []; const i = arr.findIndex(r => String(r.id) === String(id)); if (i >= 0) arr.splice(i, 1); return true; };
  window.upFile = async function () { return { ok: true }; };
  window.sendNotifEmail = async function () { };
  window.sendOverdueNotifs = async function () { };
  window.sendLinePush = async function () { return { skipped: 'stub' }; };
  window.sendLineWithLog = async function () { };
  window.sendLineGroupPush = async function () { };
  window.logSysErr = function () { };
  window.__REST_READY = true;
})();
