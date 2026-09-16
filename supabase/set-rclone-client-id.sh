#!/bin/bash
# ============================================================================
# SAEDU Flow — ใส่ client_id/client_secret ของเราเองให้ remote Google Drive ของ rclone
#
# ทำไม: remote "saedu" ใช้กุญแจกลางที่ rclone แจกให้ผู้ใช้ทั่วโลกใช้ร่วมกัน ซึ่ง Google
#   (1) จำกัดโควตาต่อนาทีร่วมกันทั้งโลก → ย้ายไฟล์ช้า เจอ 403 rate limit บ่อย (เห็นชัด 2026-09-14/15)
#   (2) ประกาศยกเลิกภายในปี 2026 → วันนั้นงานคืนละรอบล้มเหลวทันที (มีเตือน แต่ไฟล์จะค้างจนกว่าจะแก้)
#   ไฟล์ที่ย้ายไปแล้ว/ลิงก์ในระบบไม่กระทบ — client_id คือ "วิธีขอเข้าบัญชี" ไม่ใช่เจ้าของไฟล์
#
# ส่วนที่ต้องทำเองในเบราว์เซอร์ (ครั้งเดียว ~10 นาที ล็อกอิน saeduflow@gmail.com):
#   1. console.cloud.google.com → New Project ชื่อ "SaEDU Drive Archive" → เลือกโปรเจกต์นั้น
#   2. APIs & Services → Library → "Google Drive API" → Enable
#   3. APIs & Services → OAuth consent screen (Google Auth Platform) → External → กรอกชื่อแอป/อีเมล
#      → Audience → กด PUBLISH APP ให้เป็น "In production"   ← สำคัญ: สถานะ Testing ทำให้ token
#        หมดอายุทุก 7 วัน งานอัตโนมัติจะพังทุกสัปดาห์
#   4. Credentials → + Create credentials → OAuth client ID → Application type: Desktop app
#      → Create → กด "Download JSON" (ได้ไฟล์ client_secret_….json ใน ~/Downloads)
#
# แล้วรันสคริปต์นี้ชี้ไปที่ไฟล์นั้น:
#   ./set-rclone-client-id.sh ~/Downloads/client_secret_*.json
#   (หรือ ./set-rclone-client-id.sh --id=xxxx.apps.googleusercontent.com --secret=GOCSPX-xxxx)
#   มันจะ: อ่าน id/secret → rclone config update → rclone config reconnect (เปิดเบราว์เซอร์ให้
#   ล็อกอิน saeduflow อีกครั้ง — เจอ "Google hasn't verified this app" กด Advanced → Go to …)
#   → ตรวจว่า NOTICE เรื่อง client_id หายไปและยังเข้าคลังได้ → ลบไฟล์ JSON ที่ดาวน์โหลดมา (มี secret)
# ============================================================================
set -euo pipefail
REMOTE="${ARCHIVE_RCLONE_REMOTE:-saedu}"
ID=""; SECRET=""; JSON=""
for a in "$@"; do
  case "$a" in
    --id=*) ID="${a#--id=}";;
    --secret=*) SECRET="${a#--secret=}";;
    --remote=*) REMOTE="${a#--remote=}";;
    *) JSON="$a";;
  esac
done
if [ -n "$JSON" ]; then
  [ -f "$JSON" ] || { echo "ไม่พบไฟล์ $JSON" >&2; exit 1; }
  # ไฟล์ที่ Google ให้มีรูป {"installed":{"client_id":…,"client_secret":…}} (Desktop app)
  read -r ID SECRET < <(python3 -c '
import json,sys
d=json.load(open(sys.argv[1])); d=d.get("installed") or d.get("web") or d
print(d.get("client_id",""), d.get("client_secret",""))' "$JSON")
fi
[ -n "$ID" ] && [ -n "$SECRET" ] || { echo "ต้องมี client_id และ client_secret — ให้ไฟล์ JSON หรือ --id= --secret=" >&2; exit 1; }
case "$ID" in *.apps.googleusercontent.com) ;; *) echo "client_id หน้าตาไม่ถูก (ต้องลงท้าย .apps.googleusercontent.com): $ID" >&2; exit 1;; esac
rclone listremotes --long | awk -v r="$REMOTE:" '$1==r' | grep -q drive || { echo "remote \"$REMOTE\" ไม่ใช่ชนิด drive หรือไม่มีอยู่" >&2; exit 1; }

cp ~/.config/rclone/rclone.conf ~/.config/rclone/rclone.conf.bak-"$(date +%Y%m%d-%H%M%S)"
echo "สำรอง rclone.conf แล้ว"
rclone config update "$REMOTE" client_id="$ID" client_secret="$SECRET" --non-interactive >/dev/null
echo "ใส่ client_id ของเราเองให้ remote $REMOTE แล้ว"
echo
echo "ต่อไปจะเปิดเบราว์เซอร์ให้ล็อกอิน Google อีกครั้ง — เลือกบัญชี saeduflow@gmail.com"
echo "ถ้าเจอ \"Google hasn't verified this app\" ให้กด Advanced → Go to … (แอปของเราเอง ปลอดภัย)"
rclone config reconnect "$REMOTE:"
echo
echo "ตรวจสอบ:"
if rclone about "$REMOTE:" 2>&1 | tee /dev/stderr | grep -q "shared Google Drive client_id"; then
  echo "⚠️ ยังขึ้น NOTICE เรื่อง client_id กลางอยู่ — ตรวจว่า rclone config show $REMOTE มี client_id ของเราไหม" >&2; exit 1
fi
rclone lsd "$REMOTE:SaEDU-Archive" >/dev/null && echo "✓ เข้าคลัง SaEDU-Archive ได้ ไม่มี NOTICE แล้ว"
if [ -n "$JSON" ]; then rm -f "$JSON"; echo "ลบ $JSON แล้ว (มี secret ไม่ควรทิ้งไว้ใน Downloads)"; fi
echo "เสร็จ — งานคืนละรอบใช้ remote เดิม ไม่ต้องติดตั้งซ้ำ"
