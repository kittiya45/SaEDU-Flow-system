#!/usr/bin/env bash
# รัน "บนเซิร์ฟเวอร์คณะ" (root/sudo): ติดตั้งส่วนหัวความปลอดภัยของ SaEDU Flow ลง nginx
#   sudo bash apply-nginx-headers.sh [/path/to/saeduflow-headers.conf]   (ค่าเริ่มต้น: ไฟล์ข้าง ๆ สคริปต์นี้)
# ทำอะไร: 1) วาง snippet ที่ /etc/nginx/snippets/saeduflow-headers.conf
#         2) หาไฟล์ config ที่มี server_name saeduflow.edu.chula.ac.th แล้วแทรก include ใน server {} นั้น
#            และใน location {} ทุกอันของ server นั้นที่มี add_header ของตัวเอง (nginx ไม่สืบทอด add_header
#            เข้า location ที่มี add_header อยู่แล้ว — ถ้าไม่แทรกตรงนั้น ส่วนหัวจะหายเงียบ ๆ เฉพาะ path นั้น)
#         3) nginx -t — ผ่านถึง reload; ไม่ผ่านคืนไฟล์เดิมจาก backup แล้วออก 1
# รันซ้ำได้: มี include อยู่แล้วจะไม่แทรกซ้ำ (snippet ถูกเขียนทับด้วยเวอร์ชันใหม่เสมอ)
set -euo pipefail
HOST='saeduflow.edu.chula.ac.th'
SRC="${1:-$(cd "$(dirname "$0")" && pwd)/saeduflow-headers.conf}"
DEST_DIR=/etc/nginx/snippets
DEST="$DEST_DIR/saeduflow-headers.conf"
INCLUDE_LINE="include $DEST;"   # path เต็ม — include แบบ relative อิง --prefix ของ nginx ซึ่งบน Amazon Linux ไม่ใช่ /etc/nginx

[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo/root" >&2; exit 1; }
[ -f "$SRC" ] || { echo "ไม่พบ snippet: $SRC" >&2; exit 1; }
command -v nginx >/dev/null || { echo "ไม่พบ nginx บนเครื่องนี้" >&2; exit 1; }
command -v python3 >/dev/null || { echo "ต้องมี python3 สำหรับแก้ config" >&2; exit 1; }

mkdir -p "$DEST_DIR"
install -m 0644 "$SRC" "$DEST"
echo "✔ วาง $DEST"

mapfile -t CONFS < <(grep -rlE "server_name[^;]*$HOST" /etc/nginx/ 2>/dev/null | grep -v "$DEST" || true)
[ "${#CONFS[@]}" -gt 0 ] || { echo "ไม่พบไฟล์ใน /etc/nginx ที่มี server_name $HOST" >&2; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
for CONF in "${CONFS[@]}"; do
  BAK="$CONF.bak-$STAMP"
  cp -p "$CONF" "$BAK"
  python3 - "$CONF" "$HOST" "$INCLUDE_LINE" <<'PY'
import re, sys
path, host, inc = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path, encoding='utf-8').read().split('\n')
def code(l): return l.split('#', 1)[0]                      # ตัดคอมเมนต์ก่อนนับปีกกา
def find_blocks(kind, lo, hi):
    """บล็อก `kind ... {` ชั้นนอกสุดในช่วง [lo,hi) — คืน (start,end) รวมปลาย; รองรับบล็อกบรรทัดเดียว"""
    out, depth, start, sdepth = [], 0, None, None
    for i in range(lo, hi):
        c = code(lines[i])
        if start is None and re.match(r'\s*' + kind + r'\b[^{]*\{', c): start, sdepth = i, depth
        depth += c.count('{') - c.count('}')
        if start is not None and depth == sdepth: out.append((start, i)); start = None
    return out
def own_text(ls, le):
    """โค้ดของบล็อกนี้เอง ไม่รวม location ที่ซ้อนอยู่ข้างใน (ส่วนหลัง { ของบรรทัดเปิด + บรรทัดถัดไป)"""
    skip = set()
    for ns, ne in find_blocks('location', ls + 1, le): skip.update(range(ns, ne + 1))
    first = code(lines[ls]); first = first[first.index('{') + 1:]
    return '\n'.join([first] + [code(lines[i]) for i in range(ls + 1, le + 1) if i not in skip])
edits = []   # (line, 'after'|'inline', indent)
for s, e in find_blocks('server', 0, len(lines)):          # server{} ระดับใดก็ได้ (nginx.conf มี http{} ครอบ)
    body = '\n'.join(code(l) for l in lines[s:e + 1])
    if not re.search(r'server_name[^;]*' + re.escape(host), body): continue
    if inc not in own_text(s, e):
        for i in range(s, e + 1):
            if re.match(r'\s*server_name\b', code(lines[i])): edits.append((i, 'after', re.match(r'\s*', lines[i]).group(0))); break
    def walk(lo, hi):
        for ls, le in find_blocks('location', lo, hi):
            own = own_text(ls, le)
            if 'add_header' in own and inc not in own:
                edits.append((ls, 'inline' if ls == le else 'after', re.match(r'\s*', lines[ls]).group(0) + '    '))
            walk(ls + 1, le)
    walk(s + 1, e)
for i, how, ind in sorted(edits, key=lambda t: -t[0]):
    if how == 'inline': lines[i] = lines[i].replace('{', '{ ' + inc, 1)
    else: lines.insert(i + 1, ind + inc)
if edits:
    open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'✔ แทรก include {len(edits)} จุดใน {path}')
else:
    print(f'• {path} มี include ครบอยู่แล้ว — ไม่แก้')
PY
  if cmp -s "$CONF" "$BAK"; then rm -f "$BAK"; else echo "  backup: $BAK"; fi
done

if nginx -t 2>&1 | sed 's/^/  /'; then
  if command -v systemctl >/dev/null && systemctl is-active --quiet nginx; then systemctl reload nginx; else nginx -s reload; fi
  echo "✔ nginx reload แล้ว"
else
  echo "✖ nginx -t ไม่ผ่าน — คืนไฟล์เดิม" >&2
  for CONF in "${CONFS[@]}"; do [ -f "$CONF.bak-$STAMP" ] && cp -p "$CONF.bak-$STAMP" "$CONF"; done
  exit 1
fi
echo "ตรวจจากภายนอก: curl -sI https://$HOST/ | grep -i content-security-policy"
