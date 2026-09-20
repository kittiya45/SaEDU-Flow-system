#!/bin/bash
# ============================================================================
# SAEDU Flow — ติดตั้ง/ถอน งาน launchd ทั้ง 2 ตัวของระบบ:
#   com.saedu.archive-nightly  archive-nightly.sh  ทุกคืน 02:30      ย้ายไฟล์เอกสารที่จบแล้วไปคลัง
#   com.saedu.backup-weekly    backup-weekly.sh    ทุกวันอาทิตย์ 04:00  สำรอง DB ขึ้น Drive + สำเนาคลังไป OneDrive
#
#   ./install-archive-launchd.sh              ติดตั้ง/อัปเดตทั้งคู่ (รันซ้ำได้ — sync สคริปต์รุ่นล่าสุดด้วย)
#   ./install-archive-launchd.sh --now        ติดตั้งแล้วสั่งรันงานคืนละรอบทันที 1 รอบ
#   ./install-archive-launchd.sh --backup-now ติดตั้งแล้วสั่งรันงานสำรองทันที 1 รอบ
#   ./install-archive-launchd.sh --status     โหลดอยู่ไหม + log รอบล่าสุดของทั้งคู่
#   ./install-archive-launchd.sh --uninstall  ถอนทั้งคู่
#
# ปรับเวลา/ปลายทางตอนติดตั้ง (ฝังลง plist):
#   ARCHIVE_HOUR=3 ARCHIVE_MINUTE=0 ./install-archive-launchd.sh
#   ARCHIVE_RCLONE_REMOTE=onedrive ./install-archive-launchd.sh      # ย้ายไป OneDrive
#   ARCHIVE_SHARE=…                  ลิงก์แบบไหน — ไม่ระบุ = เดาจากชนิด remote (drive→inherit, onedrive→org)
#   ARCHIVE_MIN_AGE_DAYS=3           completed/cancelled นิ่งกี่วันก่อนย้าย (ค่าเริ่มต้น 3)
#   ARCHIVE_REJECTED_MIN_AGE_DAYS=30 rejected นิ่งกี่วัน (ค่าเริ่มต้น 30 — อย่าลด ดูเหตุผลใน archive-nightly.sh)
#   BACKUP_WEEKDAY=0 BACKUP_HOUR=4   วัน/เวลาสำรอง (0=อาทิตย์ … 6=เสาร์ · ค่าเริ่มต้น อาทิตย์ 04:00)
#   BACKUP_RCLONE_REMOTE=saedu       remote ปลายทางสำรอง · BACKUP_KEEP=4 เก็บกี่ชุด
#   MIRROR_RCLONE_REMOTE=onedrive    remote สำเนาคลัง (- = ปิด · ไม่มี remote นั้น = ข้ามเงียบ ๆ)
#
# launchd ต่างจาก cron: ถ้าเครื่อง "หลับ" ตอน 02:30 มันจะรันให้ตอนเครื่องตื่นครั้งถัดไป
# (เปิดฝาตอนเช้าก็รัน) แต่ถ้าเครื่อง "ปิดสนิท" ข้ามเวลานั้น รอบนั้นข้ามไปเลย รอรอบถัดไป
#
# ทำไมถึงคัดลอกไฟล์ไป ~/Library/Application Support ก่อนรัน:
#   macOS ห้ามโปรแกรมที่ launchd เรียก (ไม่ใช่ Terminal) เข้าถึง ~/Desktop ~/Documents ~/Downloads
#   โปรเจกต์นี้อยู่ใน ~/Desktop → launchd เรียก bash อ่านสคริปต์แล้วได้ "Operation not permitted"
#   (exit 126) ตั้งแต่บรรทัดแรก ทางออกที่ไม่ต้องย้ายโปรเจกต์หรือให้ bash ได้ Full Disk Access
#   คือ sync เฉพาะของที่งานนี้ใช้ (archive-nightly.sh, 47, node_modules) ไปไว้นอกโฟลเดอร์ต้องห้าม
#   ต้นฉบับยังอยู่ในโปรเจกต์ — แก้ไฟล์ในโปรเจกต์แล้วรันติดตั้งซ้ำ มันจะ sync ให้ใหม่
#   manifest (archive-to-drive-*.json) ของรอบอัตโนมัติจึงอยู่ใน RUNTIME ไม่ใช่ในโปรเจกต์
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.saedu.archive-nightly"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BLABEL="com.saedu.backup-weekly"
BPLIST="$HOME/Library/LaunchAgents/$BLABEL.plist"
LOG_DIR="$HOME/Library/Logs/saedu"
RUNTIME="$HOME/Library/Application Support/SaEDU-Flow/archive"
DOMAIN="gui/$(id -u)"
HOUR="${ARCHIVE_HOUR:-2}"
MINUTE="${ARCHIVE_MINUTE:-30}"
REMOTE="${ARCHIVE_RCLONE_REMOTE:-saedu}"
MIN_AGE="${ARCHIVE_MIN_AGE_DAYS:-3}"
REJ_MIN_AGE="${ARCHIVE_REJECTED_MIN_AGE_DAYS:-30}"
B_WEEKDAY="${BACKUP_WEEKDAY:-0}"
B_HOUR="${BACKUP_HOUR:-4}"
B_MINUTE="${BACKUP_MINUTE:-0}"
B_REMOTE="${BACKUP_RCLONE_REMOTE:-$REMOTE}"
B_KEEP="${BACKUP_KEEP:-4}"
M_REMOTE="${MIRROR_RCLONE_REMOTE:-onedrive}"
# ลิงก์แบบไหน: ถ้าไม่ระบุ เดาจากชนิด remote ที่ rclone รู้จัก (drive → inherit, onedrive → org)
REMOTE_TYPE="$(rclone listremotes --long 2>/dev/null | awk -v r="$REMOTE:" '$1==r{print $2}')"
SHARE="${ARCHIVE_SHARE:-}"
if [ -z "$SHARE" ]; then
  case "$REMOTE_TYPE" in onedrive) SHARE=org;; *) SHARE=inherit;; esac
fi

case "${1:-}" in
  --uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootout "$DOMAIN/$BLABEL" 2>/dev/null || true
    rm -f "$PLIST" "$BPLIST"
    echo "ถอนแล้ว: $LABEL + $BLABEL (log เก่ายังอยู่ที่ $LOG_DIR · สำเนาสคริปต์ + manifest + backup-local ยังอยู่ที่ $RUNTIME ลบเองได้ถ้าไม่ต้องการ)"
    exit 0 ;;
  --status)
    for pair in "$LABEL|$PLIST|archive" "$BLABEL|$BPLIST|backup"; do
      L="${pair%%|*}"; rest="${pair#*|}"; P="${rest%%|*}"; tag="${rest#*|}"
      if launchctl print "$DOMAIN/$L" >/dev/null 2>&1; then
        echo "โหลดอยู่: $L"
        grep -oE '<key>(Weekday|Hour|Minute|ARCHIVE_[A-Z_]+|BACKUP_[A-Z_]+|MIRROR_[A-Z_]+)</key><(integer|string)>[^<]*' "$P" 2>/dev/null | sed -E 's/<key>([^<]*)<\/key><[a-z]+>(.*)/  \1 = \2/'
      else
        echo "ยังไม่ได้ติดตั้ง: $L"
      fi
      LAST="$(ls -t "$LOG_DIR"/$tag-*.log 2>/dev/null | head -1 || true)"
      if [ -n "$LAST" ]; then echo "  log ล่าสุด: $LAST"; tail -5 "$LAST" | sed 's/^/    /'; else echo "  ยังไม่เคยรัน"; fi
      echo
    done
    exit 0 ;;
  ""|--now|--backup-now) ;;
  *) echo "ไม่รู้จัก: $1" >&2; exit 1 ;;
esac

for f in archive-nightly.sh backup-weekly.sh backup-to-drive.sh ops-heartbeat.sh 47_archive_to_drive.mjs 54_purge_cancelled_docs.mjs 45_export_data_json.mjs 48_schema_dump.sql 49_export_sql_dump.mjs; do
  [ -f "$HERE/$f" ] || { echo "ไม่พบ $HERE/$f" >&2; exit 1; }
done
[ -d "$HERE/node_modules/@supabase" ] || { echo "ไม่พบ $HERE/node_modules — รัน npm install ใน $HERE ก่อน" >&2; exit 1; }
[ -n "$REMOTE_TYPE" ] || { echo "ไม่พบ remote \"$REMOTE\" ใน rclone — ดูที่มี: rclone listremotes" >&2; exit 1; }
# ติดตั้งซ้ำ = bootout งานเดิม ซึ่งจะฆ่ารอบที่กำลังย้ายไฟล์อยู่กลางคัน (ไม่เสียหาย แต่ต้องเริ่มใหม่) — กันไว้
if pgrep -f 47_archive_to_drive.mjs >/dev/null 2>&1; then
  echo "รอบย้ายไฟล์กำลังรันอยู่ — รอให้จบก่อน (ดู: tail -f $LOG_DIR/archive-$(date +%Y-%m).log) แล้วค่อยติดตั้งซ้ำ" >&2
  exit 1
fi
if pgrep -f "backup-weekly.sh|45_export_data_json.mjs" >/dev/null 2>&1; then
  echo "รอบสำรองข้อมูลกำลังรันอยู่ — รอให้จบก่อน (ดู: tail -f $LOG_DIR/backup-$(date +%Y-%m).log) แล้วค่อยติดตั้งซ้ำ" >&2
  exit 1
fi
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR" "$RUNTIME"

# sync ของที่งานนี้ใช้ไป RUNTIME (ดูเหตุผลในหัวไฟล์) — manifest เก่าใน RUNTIME ไม่ถูกลบ
rsync -a "$HERE/archive-nightly.sh" "$HERE/backup-weekly.sh" "$HERE/backup-to-drive.sh" "$HERE/ops-heartbeat.sh" \
         "$HERE/47_archive_to_drive.mjs" "$HERE/54_purge_cancelled_docs.mjs" "$HERE/45_export_data_json.mjs" "$HERE/48_schema_dump.sql" "$HERE/49_export_sql_dump.mjs" \
         "$HERE/package.json" "$RUNTIME/"
rsync -a --delete "$HERE/node_modules/" "$RUNTIME/node_modules/"
chmod +x "$RUNTIME/archive-nightly.sh" "$RUNTIME/backup-weekly.sh" "$RUNTIME/backup-to-drive.sh"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUNTIME/archive-nightly.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$HOUR</integer>
    <key>Minute</key><integer>$MINUTE</integer>
  </dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>ARCHIVE_RCLONE_REMOTE</key><string>$REMOTE</string>
    <key>ARCHIVE_SHARE</key><string>$SHARE</string>
    <key>ARCHIVE_MIN_AGE_DAYS</key><string>$MIN_AGE</string>
    <key>ARCHIVE_REJECTED_MIN_AGE_DAYS</key><string>$REJ_MIN_AGE</string>
  </dict>
  <key>StandardOutPath</key><string>$LOG_DIR/launchd-archive.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/launchd-archive.log</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
PLIST

plutil -lint "$PLIST" >/dev/null
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
printf 'ติดตั้งแล้ว: %s — รันทุกวัน %02d:%02d\nปลายทาง: %s (%s · ลิงก์ %s) · completed/cancelled ≥%s วัน · rejected ≥%s วัน\nรันจาก: %s\nlog: %s\n' \
  "$LABEL" "$HOUR" "$MINUTE" "$REMOTE" "$REMOTE_TYPE" "$SHARE" "$MIN_AGE" "$REJ_MIN_AGE" "$RUNTIME" "$LOG_DIR"

# ── งานสำรองรายสัปดาห์ ──
M_TYPE="$(rclone listremotes --long 2>/dev/null | awk -v r="$M_REMOTE:" '$1==r{print $2}')"
cat > "$BPLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$BLABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUNTIME/backup-weekly.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>$B_WEEKDAY</integer>
    <key>Hour</key><integer>$B_HOUR</integer>
    <key>Minute</key><integer>$B_MINUTE</integer>
  </dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>BACKUP_RCLONE_REMOTE</key><string>$B_REMOTE</string>
    <key>BACKUP_KEEP</key><string>$B_KEEP</string>
    <key>MIRROR_RCLONE_REMOTE</key><string>$M_REMOTE</string>
  </dict>
  <key>StandardOutPath</key><string>$LOG_DIR/launchd-backup.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/launchd-backup.log</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
PLIST
plutil -lint "$BPLIST" >/dev/null
launchctl bootout "$DOMAIN/$BLABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$BPLIST"
DAYS=(อาทิตย์ จันทร์ อังคาร พุธ พฤหัสบดี ศุกร์ เสาร์)
printf 'ติดตั้งแล้ว: %s — ทุกวัน%s %02d:%02d\nสำรองไป: %s:SaEDU-Backup (เก็บ %s ชุด) · สำเนาคลังไป: %s%s\n' \
  "$BLABEL" "${DAYS[$B_WEEKDAY]}" "$B_HOUR" "$B_MINUTE" "$B_REMOTE" "$B_KEEP" "$M_REMOTE" \
  "$( [ "$M_REMOTE" = "-" ] && echo ' (ปิด)' || { [ -n "$M_TYPE" ] && echo " ($M_TYPE)" || echo ' — ⚠️ ไม่มี remote นี้ใน rclone จะข้ามขั้นสำเนา'; } )"

if [ "${1:-}" = "--now" ]; then
  echo "สั่งรันงานคืนละรอบทันที… ดูผลได้ที่ $LOG_DIR/archive-$(date +%Y-%m).log"
  launchctl kickstart -k "$DOMAIN/$LABEL"
fi
if [ "${1:-}" = "--backup-now" ]; then
  echo "สั่งรันงานสำรองทันที… ดูผลได้ที่ $LOG_DIR/backup-$(date +%Y-%m).log (ใช้เวลาหลายนาที)"
  launchctl kickstart -k "$DOMAIN/$BLABEL"
fi
