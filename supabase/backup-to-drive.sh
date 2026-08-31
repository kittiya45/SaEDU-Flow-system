#!/bin/bash
# ============================================================================
# SAEDU Flow — สำรองข้อมูลทั้งระบบขึ้น Google Drive (เรียก 45_export_data_json.mjs)
#
# ใช้ Google Drive for desktop ที่ล็อกอินไว้แล้ว — เขียนไฟล์ลงโฟลเดอร์ที่ sync อยู่
# แล้ว Drive อัปขึ้นคลาวด์ให้เอง ไม่ต้องใช้ API ไม่ต้องตั้ง OAuth อะไรทั้งนั้น
#
# วิธีใช้:
#   export SUPABASE_URL="https://jrubupvzltxqstzcpoov.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."      # อย่า commit อย่าวางในแชท
#   ./backup-to-drive.sh
#
# ตัวเลือก (ตั้งเป็น env ได้):
#   BACKUP_DEST  โฟลเดอร์ปลายทาง (ค่าเริ่มต้น: หา Google Drive ในเครื่องให้อัตโนมัติ)
#   KEEP         เก็บ backup ย้อนหลังกี่ชุด (ค่าเริ่มต้น 4 — ชุดละ ~1.4 GB)
#
# ตั้งให้รันอัตโนมัติทุกสัปดาห์ (เช้าวันจันทร์ ตี 2):
#   crontab -e
#   0 2 * * 1 cd /Users/kittiyakuldee/Desktop/SaEDU-Flow-system/supabase && \
#     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./backup-to-drive.sh >> /tmp/saedu-backup.log 2>&1
#   (cron ไม่เห็น env จาก shell ต้องใส่ในบรรทัดเอง — ไฟล์ crontab อยู่ในเครื่องตัวเอง
#    สิทธิ์ 600 คนอื่นอ่านไม่ได้ แต่ห้ามเอาบรรทัดนี้ไป commit เด็ดขาด)
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY" >&2; exit 1
fi

# ── หาโฟลเดอร์ Google Drive ในเครื่อง ──
if [ -z "${BACKUP_DEST:-}" ]; then
  gd=$(ls -d "$HOME/Library/CloudStorage/GoogleDrive-"* 2>/dev/null | head -1 || true)
  if [ -z "$gd" ]; then
    echo "หาโฟลเดอร์ Google Drive ไม่เจอ" >&2
    echo "ติดตั้ง Google Drive for desktop แล้วล็อกอิน หรือกำหนดเอง: BACKUP_DEST=/path ./backup-to-drive.sh" >&2
    exit 1
  fi
  # ชื่อโฟลเดอร์ My Drive เปลี่ยนตามภาษาของบัญชี
  for d in "ไดรฟ์ของฉัน" "My Drive"; do
    if [ -d "$gd/$d" ]; then BACKUP_DEST="$gd/$d/SaEDU-Backup"; break; fi
  done
  if [ -z "${BACKUP_DEST:-}" ]; then echo "ไม่เจอ My Drive ใน $gd" >&2; exit 1; fi
fi

KEEP="${KEEP:-4}"
# กัน KEEP=0 หรือค่าเพี้ยน ซึ่งจะทำให้ลบ backup ทิ้งทั้งหมด
case "$KEEP" in ''|*[!0-9]*) echo "KEEP ต้องเป็นตัวเลข" >&2; exit 1;; esac
if [ "$KEEP" -lt 1 ]; then echo "KEEP ต้องมีอย่างน้อย 1 ชุด" >&2; exit 1; fi
mkdir -p "$BACKUP_DEST"
echo "ปลายทาง: $BACKUP_DEST"
echo "เก็บย้อนหลัง: $KEEP ชุด"
echo

node 45_export_data_json.mjs --out="$BACKUP_DEST" --files

# ── ลบชุดเก่าที่เกิน KEEP ──
# ตัดเฉพาะโฟลเดอร์ชื่อ backup-* ที่สคริปต์ 45 สร้างเท่านั้น ไม่แตะอย่างอื่นใน Drive
# (bash ของ macOS เป็น 3.2 ไม่มี mapfile — ใช้ while read แทน)
n=0
while IFS= read -r d; do
  [ -n "$d" ] || continue
  [ -d "$d" ] || continue
  if [ "$n" -eq 0 ]; then echo; echo "ลบ backup เก่า (เก็บล่าสุด $KEEP ชุด):"; fi
  echo "  $(basename "$d")"
  rm -rf "$d"
  n=$((n+1))
done < <(ls -1d "$BACKUP_DEST"/backup-* 2>/dev/null | sort -r | tail -n +$((KEEP+1)) || true)

echo
echo "เสร็จ — Google Drive จะทยอยอัปขึ้นคลาวด์เอง"
echo "ดูสถานะได้ที่ไอคอน Drive บนแถบเมนู (ระหว่างอัปยังไม่นับว่าปลอดภัย รอให้ sync จบก่อน)"
