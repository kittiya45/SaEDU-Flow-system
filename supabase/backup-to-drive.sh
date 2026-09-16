#!/bin/bash
# ============================================================================
# SAEDU Flow — สำรองข้อมูลทั้งระบบขึ้น Google Drive (เรียก 45_export_data_json.mjs)
#
# ได้อะไรออกมาต่อ 1 ชุด (โฟลเดอร์ backup-<วันเวลา>/):
#   *.json                 ข้อมูลตารางละไฟล์ + manifest.json (sha256 ต่อไฟล์)
#   files/                 ไฟล์แนบจริงจาก Storage ทั้ง 2 bucket
#   48_schema_dump.sql     โครงสร้างฐานข้อมูลทั้งหมด
#   saedu-data-*.sql       ข้อมูลทั้งหมดเป็น INSERT — เทลง Postgres เครื่องอื่นได้เลย
#
# ใช้ Google Drive for desktop ที่ล็อกอินไว้แล้ว — เขียนไฟล์ลงโฟลเดอร์ที่ sync อยู่
# แล้ว Drive อัปขึ้นคลาวด์ให้เอง ไม่ต้องใช้ API ไม่ต้องตั้ง OAuth อะไรทั้งนั้น
#
# วิธีใช้ (เก็บคีย์ใน Keychain ครั้งเดียว แล้วไม่ต้องพิมพ์คีย์อีก):
#   security add-generic-password -a "$USER" -s saedu-service-role -w 'sb_secret_...' -U
#   export SUPABASE_URL="https://jrubupvzltxqstzcpoov.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password -s saedu-service-role -w)"
#   ./backup-to-drive.sh
#
# ⚠️ zsh ของเครื่องนี้ปิด interactive_comments — พิมพ์ # ต่อท้ายคำสั่งไม่ได้
#    มันจะเอา comment ไปเป็นอาร์กิวเมนต์ของ export แล้ว error
#    แต่ตั้งตัวแปรตัวแรกให้เรียบร้อยแล้ว → บรรทัดถัดไปรันจริงทั้งที่ดูเหมือนพัง
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
_DEST_GIVEN="${BACKUP_DEST:-}"
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

# ── กันรันซ้อน ──
# เคยเจอมาแล้ว 2026-09-07: รันสองชุดพร้อมกันโดยไม่ตั้งใจ (คำสั่ง export ที่ error
# ยังตั้งตัวแปรให้ก่อน แล้วบรรทัดถัดไปก็รันสคริปต์จริง) — ได้ backup ซ้อน 2 ชุด
# ชุดละ 1.1 GB และตอนนั้นขั้นตอนหา .sql ยังใช้ "ชุดที่ใหม่ที่สุด" จึงเขียนผิดโฟลเดอร์
LOCK="$BACKUP_DEST/.backup-lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "มี backup อีกชุดกำลังทำงานอยู่" >&2
  echo "ถ้าแน่ใจว่าไม่มี (เครื่องดับกลางคัน) ให้ลบ $LOCK แล้วรันใหม่" >&2
  exit 1
fi

# ── เขียนลงที่พักก่อน แล้วค่อยย้ายเข้าที่ ──
# ไม่เดาชื่อโฟลเดอร์จาก ls อีก — 45 ตั้งชื่อตาม timestamp ของตัวเอง เดาผิดได้
# ที่พักอยู่ใน BACKUP_DEST ด้วยกัน mv จึงเป็นการเปลี่ยนชื่อ ไม่ใช่ก็อป 1 GB
STAGE="$BACKUP_DEST/.staging-$$"
cleanup() {
  rmdir "$LOCK" 2>/dev/null || true
  if [ -n "${STAGE:-}" ] && [ -d "$STAGE" ]; then
    echo "ลบชุดที่ทำค้างไว้ทิ้ง (ไม่สมบูรณ์ ใช้กู้ไม่ได้): $STAGE" >&2
    rm -rf "$STAGE"
  fi
}
trap cleanup EXIT
mkdir -p "$STAGE"

node 45_export_data_json.mjs --out="$STAGE" --files

SET=$(ls -1d "$STAGE"/backup-* 2>/dev/null | head -1 || true)
if [ -z "$SET" ] || [ ! -d "$SET" ]; then
  echo "45_export_data_json.mjs ไม่ได้สร้างโฟลเดอร์ backup — หยุด" >&2
  exit 1
fi

# ── แปลงเป็น .sql ที่ยกไปลง Database Server อื่นได้ ──
# 45 ให้ JSON (อ่านง่าย ตรวจสอบง่าย) แต่เทลง Postgres ตรง ๆ ไม่ได้
# 49 อ่าน JSON ชุดที่เพิ่งได้มาแปลงต่อ — ไม่ต้องยิงถาม Supabase ซ้ำ
echo
node 49_export_sql_dump.mjs --from="$SET" --out="$SET"
# ใส่ schema ไปด้วย ชุด backup จะได้กู้คืนได้ครบในตัวเอง ไม่ต้องพึ่ง repo
cp 48_schema_dump.sql "$SET"/
echo "คัดลอก 48_schema_dump.sql เข้าชุด backup แล้ว"

mv "$SET" "$BACKUP_DEST"/
rmdir "$STAGE"
STAGE=""

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
if [ -n "$_DEST_GIVEN" ]; then
  # ถูกเรียกโดย backup-weekly.sh (หรือกำหนดปลายทางเอง) — คนเรียกรับผิดชอบเรื่องอัปขึ้นคลาวด์เอง
  echo "เสร็จ — ชุด backup อยู่ที่ $BACKUP_DEST"
else
  echo "เสร็จ — Google Drive จะทยอยอัปขึ้นคลาวด์เอง"
  echo "ดูสถานะได้ที่ไอคอน Drive บนแถบเมนู (ระหว่างอัปยังไม่นับว่าปลอดภัย รอให้ sync จบก่อน)"
fi
