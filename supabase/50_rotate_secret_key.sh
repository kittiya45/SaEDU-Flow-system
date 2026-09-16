#!/bin/bash
# ============================================================================
# SAEDU Flow — หมุน secret key (sb_secret_...) ผ่านเทอร์มินัล
#
# ใช้ตอนคีย์รั่ว หรือหมุนตามรอบปกติ ลำดับปลอดภัย:
#   สร้างคีย์ใหม่ → ทดสอบว่าคีย์ใหม่ใช้ได้จริง → เก็บลง Keychain → ค่อยเพิกถอนคีย์เก่า
# ไม่เพิกถอนก่อนทดสอบเด็ดขาด ไม่งั้นถ้าคีย์ใหม่มีปัญหาจะเข้าไม่ได้เลย
#
# ⚠️ ต้องมี Personal Access Token ที่มีสิทธิ์จัดการโปรเจกต์
#    token ที่ `supabase login` เก่าเก็บไว้ อาจได้ 403 (สิทธิ์ไม่พอ/scope จำกัด)
#    วิธีได้ token ที่ใช้ได้ เลือกอย่างใดอย่างหนึ่ง:
#      npx supabase login                       (เปิดเบราว์เซอร์ แล้วเก็บ token ใหม่ให้เอง)
#      https://supabase.com/dashboard/account/tokens  แล้ว export SUPABASE_ACCESS_TOKEN=...
#
# วิธีใช้:
#   ./50_rotate_secret_key.sh --list                 ดูว่ามีคีย์อะไรอยู่บ้าง (ไม่แก้อะไร)
#   ./50_rotate_secret_key.sh --rotate <id ของคีย์เก่า>
#   ./50_rotate_secret_key.sh --rotate <id> --keep-old   สร้าง+สลับ แต่ยังไม่เพิกถอนของเก่า
#
# ถ้าสร้างคีย์ผ่าน API ไม่ผ่าน (schema เปลี่ยน) ให้สร้างเองที่
#   Dashboard → Settings → API Keys → Publishable and secret API keys
# แล้วรัน:  NEW_KEY='sb_secret_...' ./50_rotate_secret_key.sh --rotate <id ของคีย์เก่า>
#
# สคริปต์นี้ไม่พิมพ์ค่าคีย์เต็มออกจอเลย โชว์แค่ 12 ตัวแรก
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_REF="jrubupvzltxqstzcpoov"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
KC_SERVICE="saedu-service-role"
API="https://api.supabase.com"

mask() { printf '%.12s…' "$1"; }

# ── หา access token ──
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN=$(security find-generic-password -s "Supabase CLI" -w 2>/dev/null || true)
  [ -n "$TOKEN" ] && echo "ใช้ token ที่ supabase CLI เก็บไว้ (ถ้าได้ 403 แปลว่าสิทธิ์ไม่พอ)"
fi
if [ -z "$TOKEN" ]; then
  echo "ไม่มี access token" >&2
  echo "  npx supabase login    หรือ    export SUPABASE_ACCESS_TOKEN=sbp_..." >&2
  exit 1
fi

# ── เรียก Management API แล้วแยก body กับ status code ──
RESP_BODY=""; RESP_CODE=""
api() {
  local method="$1" path="$2"; shift 2
  local raw
  raw=$(curl -sS -X "$method" -w $'\n%{http_code}' \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "$API$path" "$@")
  RESP_CODE="${raw##*$'\n'}"
  RESP_BODY="${raw%$'\n'*}"
}

die_403() {
  echo >&2
  echo "HTTP 403 — token นี้ไม่มีสิทธิ์จัดการ API key ของโปรเจกต์" >&2
  echo "ขอ token ใหม่: npx supabase login" >&2
  echo "หรือสร้างที่ https://supabase.com/dashboard/account/tokens แล้ว export SUPABASE_ACCESS_TOKEN=..." >&2
  exit 1
}

list_keys() {
  api GET "/v1/projects/$PROJECT_REF/api-keys?reveal=false"
  [ "$RESP_CODE" = "403" ] && die_403
  if [ "$RESP_CODE" != "200" ]; then
    echo "ดึงรายการคีย์ไม่สำเร็จ (HTTP $RESP_CODE): $RESP_BODY" >&2; exit 1
  fi
  echo "$RESP_BODY" | python3 -c '
import json,sys
ks=json.load(sys.stdin)
if not ks: print("  (ไม่มีคีย์แบบใหม่เลย — โปรเจกต์ยังใช้ legacy JWT อย่างเดียว)"); raise SystemExit
print(f'"'"'  {"id":<38} {"ชนิด":<12} {"ชื่อ":<20} ขึ้นต้นด้วย'"'"')
for k in ks:
    pref = k.get("api_key") or k.get("prefix") or ""
    print(f'"'"'  {k.get("id",""):<38} {k.get("type",""):<12} {(k.get("name") or k.get("description") or ""):<20} {pref[:16]}'"'"')
'
}

case "${1:-}" in
  --list)
    echo "คีย์แบบใหม่ของโปรเจกต์ $PROJECT_REF:"
    list_keys
    echo
    echo "หมายเหตุ: legacy anon/service_role (eyJ...) ไม่โผล่ในรายการนี้ — คนละระบบกัน"
    echo "Edge Functions อ่าน SUPABASE_SERVICE_ROLE_KEY ซึ่งเป็น legacy JWT"
    echo "หมุนคีย์ sb_secret_ จึงไม่กระทบ Edge Functions และหน้าเว็บ"
    exit 0
    ;;
  --rotate)
    OLD_ID="${2:-}"
    [ -z "$OLD_ID" ] && { echo "ต้องระบุ id ของคีย์เก่า — ดูจาก --list" >&2; exit 1; }
    ;;
  *)
    sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

KEEP_OLD=false
[ "${3:-}" = "--keep-old" ] && KEEP_OLD=true

echo "== คีย์ปัจจุบัน =="
list_keys
echo

# ── 1. ได้คีย์ใหม่มา ──
if [ -n "${NEW_KEY:-}" ]; then
  echo "ใช้คีย์ใหม่จากตัวแปร NEW_KEY: $(mask "$NEW_KEY")"
else
  echo "== สร้างคีย์ใหม่ =="
  api POST "/v1/projects/$PROJECT_REF/api-keys?reveal=true" \
    -d "{\"type\":\"secret\",\"description\":\"rotated-$(date +%Y%m%d)\"}"
  [ "$RESP_CODE" = "403" ] && die_403
  if [ "$RESP_CODE" != "200" ] && [ "$RESP_CODE" != "201" ]; then
    echo "สร้างคีย์ผ่าน API ไม่สำเร็จ (HTTP $RESP_CODE):" >&2
    echo "  $RESP_BODY" >&2
    echo >&2
    echo "สร้างเองที่ Dashboard → Settings → API Keys แล้วรันใหม่แบบนี้:" >&2
    echo "  NEW_KEY='sb_secret_...' $0 --rotate $OLD_ID" >&2
    exit 1
  fi
  NEW_KEY=$(echo "$RESP_BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("api_key",""))')
  if [ -z "$NEW_KEY" ]; then
    echo "API ตอบ 2xx แต่ไม่มีค่าคีย์กลับมา — ดูใน Dashboard แล้วใช้ NEW_KEY=..." >&2
    echo "  $RESP_BODY" >&2; exit 1
  fi
  echo "สร้างแล้ว: $(mask "$NEW_KEY")"
fi

# ── 2. ทดสอบคีย์ใหม่ก่อน ยังไม่แตะของเก่า ──
echo
echo "== ทดสอบคีย์ใหม่ (ต้องข้าม RLS เห็น users ครบ) =="
CR=$(curl -sS -o /dev/null -D - -w '%{http_code}' \
  -H "apikey: $NEW_KEY" -H "Authorization: Bearer $NEW_KEY" -H "Prefer: count=exact" \
  "$SUPABASE_URL/rest/v1/users?select=id&limit=1" | tr -d '\r')
CODE=$(printf '%s' "$CR" | tail -1)
COUNT=$(printf '%s' "$CR" | grep -i '^content-range:' | sed 's|.*/||' | tr -d ' ')
echo "  HTTP $CODE · มองเห็น users ${COUNT:-?} แถว"
if [ "$CODE" != "200" ] || [ -z "$COUNT" ] || [ "$COUNT" = "0" ]; then
  echo "คีย์ใหม่ใช้ไม่ได้ — หยุด ไม่เพิกถอนคีย์เก่า" >&2
  exit 1
fi

# ── 3. เก็บลง Keychain ──
echo
security add-generic-password -a "$USER" -s "$KC_SERVICE" -w "$NEW_KEY" -U
echo "เก็บคีย์ใหม่ลง Keychain ($KC_SERVICE) แล้ว"

# ── 4. เพิกถอนคีย์เก่า ──
if $KEEP_OLD; then
  echo
  echo "ข้ามการเพิกถอนตาม --keep-old — คีย์เก่า $OLD_ID ยังใช้ได้อยู่"
  echo "เพิกถอนภายหลัง: $0 --rotate $OLD_ID (ตอนนั้นใส่ NEW_KEY ด้วย)"
  exit 0
fi

echo
printf 'เพิกถอนคีย์เก่า %s ถาวร? พิมพ์ yes: ' "$OLD_ID"
read -r ans
if [ "$ans" != "yes" ]; then
  echo "ยกเลิก — คีย์ใหม่สร้างและเก็บใน Keychain แล้ว แต่คีย์เก่ายังใช้ได้"
  exit 0
fi

api DELETE "/v1/projects/$PROJECT_REF/api-keys/$OLD_ID?was_compromised=true&reason=leaked%20in%20chat%20transcript"
[ "$RESP_CODE" = "403" ] && die_403
if [ "$RESP_CODE" != "200" ] && [ "$RESP_CODE" != "204" ]; then
  echo "เพิกถอนไม่สำเร็จ (HTTP $RESP_CODE): $RESP_BODY" >&2
  echo "คีย์ใหม่ใช้ได้แล้ว ลบคีย์เก่าเองที่ Dashboard ได้" >&2
  exit 1
fi
echo "เพิกถอนคีย์เก่าแล้ว"

echo
echo "== คีย์ที่เหลือ =="
list_keys
echo
echo "ต่อไป: สคริปต์ 44/45/47/49 อ่านคีย์จาก Keychain อยู่แล้ว ไม่ต้องแก้"
echo "  export SUPABASE_SERVICE_ROLE_KEY=\"\$(security find-generic-password -s $KC_SERVICE -w)\""
