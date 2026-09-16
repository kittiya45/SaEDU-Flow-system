#!/bin/bash
# ============================================================================
# SAEDU Flow — สำรองฐานข้อมูลขึ้น Google Drive (saeduflow) + ทำสำเนาคลังไป OneDrive — รายสัปดาห์
#
# ตัวห่อสำหรับ launchd (ติดตั้งด้วย install-archive-launchd.sh ตัวเดียวกับงานคืนละรอบ)
# รันเองด้วยมือก็ได้: ./backup-weekly.sh
#
# ทำอะไร:
#   1. backup-to-drive.sh  → ชุด backup เต็ม (JSON ทุกตาราง + .sql กู้คืนได้ + schema + ไฟล์ใน Storage
#                            ที่ยังไม่ได้ย้ายไปคลัง) ลงโฟลเดอร์ในเครื่องก่อน (BACKUP_LOCAL)
#   2. rclone copy ชุดนั้นขึ้น  <REMOTE>:SaEDU-Backup/backup-<วันเวลา>/  แล้ว rclone check ว่าครบ
#      เก็บบนคลาวด์ย้อนหลัง BACKUP_KEEP ชุด (ค่าเริ่มต้น 4) ชุดเก่ากว่านั้นลบ · ในเครื่องเก็บชุดเดียว
#   3. ถ้ามี remote ชื่อ MIRROR (ค่าเริ่มต้น onedrive) → ทำสำเนา
#        rclone copy <REMOTE>:SaEDU-Archive → <MIRROR>:SaEDU-Archive   (copy = ไม่ลบอะไรบนสำเนา
#                                              ลบผิดบน Drive จะไม่ลามมาถึงสำเนา — นี่คือจุดประสงค์)
#        rclone sync <REMOTE>:SaEDU-Backup  → <MIRROR>:SaEDU-Backup    (sync = ชุดเก่าที่ถูกหมุนออก
#                                              หายตามไปด้วย ไม่งั้นสำเนากินพื้นที่ไม่หยุด)
#   4. heartbeat ลง app_settings (ops_backup_last_ok / ops_mirror_last_ok) ให้หน้าเว็บเตือนถ้าไม่รัน
#   5. เตือนเมื่อพื้นที่คลาวด์ (ทั้งหลักและสำเนา) เหลือไม่ถึง 1 GiB
#
# ทำไมต้องมีทั้งสองอย่าง (เขียนไว้เพราะเคยถูกถามว่า "มีคลังบน Drive แล้วยังต้องสำรองอีกเหรอ"):
#   คลังบน Drive = ไฟล์แนบ "ของเอกสารที่จบแล้ว" เท่านั้น ไม่มีตารางฐานข้อมูลเลย
#   ถ้า Supabase หาย: ไม่มีใครรู้ว่าไฟล์ไหนของเอกสารไหน ใครลงนามเมื่อไหร่ เลขหนังสืออะไร
#   ชุด backup คือของที่กู้ระบบทั้งระบบขึ้นมาใหม่ได้ (psql -f 48 แล้ว psql -f saedu-data-*.sql)
#   ส่วนสำเนาไป OneDrive = กัน "บัญชี saeduflow หาย" ซึ่งเป็นจุดตายเดียวของคลัง
#
# env (install-archive-launchd.sh ฝังลง plist ให้):
#   BACKUP_RCLONE_REMOTE   remote ปลายทางหลัก (ค่าเริ่มต้น saedu)
#   MIRROR_RCLONE_REMOTE   remote สำเนา (ค่าเริ่มต้น onedrive · ตั้งเป็น - เพื่อปิด · ไม่มี remote นั้น = ข้ามเงียบ ๆ)
#   BACKUP_KEEP            เก็บบนคลาวด์กี่ชุด (ค่าเริ่มต้น 4)
#   BACKUP_LOCAL           โฟลเดอร์พักในเครื่อง (ค่าเริ่มต้น ./backup-local ข้าง ๆ สคริปต์)
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")"
HERE="$(pwd)"

REMOTE="${BACKUP_RCLONE_REMOTE:-saedu}"
MIRROR="${MIRROR_RCLONE_REMOTE:-onedrive}"
KEEP="${BACKUP_KEEP:-4}"
LOCAL="${BACKUP_LOCAL:-$HERE/backup-local}"
LOG_DIR="$HOME/Library/Logs/saedu"
mkdir -p "$LOG_DIR" "$LOCAL"
LOG="$LOG_DIR/backup-$(date +%Y-%m).log"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export RCLONE_LOG_LEVEL=ERROR
export SUPABASE_URL="${SUPABASE_URL:-https://jrubupvzltxqstzcpoov.supabase.co}"

log()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
notify() { osascript -e "display notification \"$1\" with title \"SaEDU สำรองข้อมูล\"" >/dev/null 2>&1 || true; }
. "$HERE/ops-heartbeat.sh"

case "$KEEP" in ''|*[!0-9]*) log "BACKUP_KEEP ต้องเป็นตัวเลข"; exit 1;; esac
[ "$KEEP" -ge 1 ] || { log "BACKUP_KEEP ต้องอย่างน้อย 1"; exit 1; }

LOCK="$LOG_DIR/.backup-weekly-lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  log "ข้าม: รอบก่อนหน้ายังรันอยู่ ($LOCK) — ถ้าแน่ใจว่าไม่มีอะไรรัน ลบโฟลเดอร์นี้ทิ้งได้"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password -s saedu-service-role -w 2>/dev/null || true)"
fi
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  log "ล้มเหลว: ไม่พบ key ใน Keychain (saedu-service-role)"; notify "สำรองข้อมูลล้มเหลว: ไม่พบ key ใน Keychain"; exit 1
fi
export SUPABASE_SERVICE_ROLE_KEY

remote_type() { rclone listremotes --long 2>/dev/null | awk -v r="$1:" '$1==r{print $2}'; }
[ -n "$(remote_type "$REMOTE")" ] || { log "ล้มเหลว: ไม่พบ remote $REMOTE ใน rclone"; notify "สำรองข้อมูลล้มเหลว: ไม่พบ remote $REMOTE"; heartbeat_fail backup "ไม่พบ remote $REMOTE"; exit 1; }

fail() { log "ล้มเหลว: $1"; notify "สำรองข้อมูลล้มเหลว — ดู log ที่ ~/Library/Logs/saedu"; heartbeat_fail backup "$1"; exit 1; }

log "เริ่ม: remote=$REMOTE mirror=$MIRROR keep=$KEEP local=$LOCAL"

# ── 1. ทำชุด backup ในเครื่อง ──
# ชุดเก่าในเครื่องถูกลบตอนนี้ (KEEP=1 ใน backup-to-drive.sh) — บนคลาวด์ยังมี KEEP ชุดตามปกติ
if ! BACKUP_DEST="$LOCAL" KEEP=1 ./backup-to-drive.sh >> "$LOG" 2>&1; then
  fail "backup-to-drive.sh ไม่สำเร็จ (ดูรายละเอียดด้านบนใน log)"
fi
SET="$(ls -1d "$LOCAL"/backup-* 2>/dev/null | sort -r | head -1 || true)"
[ -n "$SET" ] && [ -d "$SET" ] || fail "ไม่พบโฟลเดอร์ backup-* ใน $LOCAL หลังรัน"
NAME="$(basename "$SET")"
SIZE="$(du -sh "$SET" 2>/dev/null | awk '{print $1}')"
log "ชุดในเครื่อง: $NAME ($SIZE)"

# ── 2. อัปขึ้นคลาวด์หลัก + ตรวจ + หมุนชุดเก่า ──
if ! rclone copy "$SET" "$REMOTE:SaEDU-Backup/$NAME" --transfers 4 --checkers 4 2>>"$LOG"; then
  fail "rclone copy ชุด $NAME ขึ้น $REMOTE ไม่สำเร็จ"
fi
# --one-way: ไฟล์ทุกไฟล์ในเครื่องต้องมีบนคลาวด์ขนาดเท่ากัน (ไม่สนของเกินบนคลาวด์)
if ! rclone check "$SET" "$REMOTE:SaEDU-Backup/$NAME" --one-way 2>>"$LOG"; then
  fail "ตรวจชุด $NAME บนคลาวด์แล้วไม่ครบ/ขนาดไม่ตรง — ไม่หมุนชุดเก่า"
fi
log "อัปขึ้น $REMOTE:SaEDU-Backup/$NAME ครบ ตรวจแล้ว"
# หมุน: เหลือ KEEP ชุดล่าสุด (ชื่อ backup-<ISO> เรียงตามตัวอักษร = เรียงตามเวลา)
n=0
while IFS= read -r d; do
  [ -n "$d" ] || continue
  log "ลบชุดเก่าบนคลาวด์: $d"
  rclone purge "$REMOTE:SaEDU-Backup/$d" 2>>"$LOG" || log "  ลบ $d ไม่สำเร็จ (จะลองใหม่รอบหน้า)"
  n=$((n+1))
done < <(rclone lsd "$REMOTE:SaEDU-Backup" 2>/dev/null | awk '{print $NF}' | grep '^backup-' | sort -r | tail -n +$((KEEP+1)) || true)
heartbeat_ok backup
SUMMARY="สำรองข้อมูลแล้ว $NAME ($SIZE)"

# ── 3. สำเนาไป remote ที่สอง ──
MIRROR_MSG=""
if [ "$MIRROR" != "-" ] && [ -n "$(remote_type "$MIRROR")" ]; then
  log "สำเนา: $REMOTE:SaEDU-Archive → $MIRROR:SaEDU-Archive (copy)"
  m_ok=1
  rclone copy "$REMOTE:SaEDU-Archive" "$MIRROR:SaEDU-Archive" --transfers 4 --checkers 8 2>>"$LOG" || m_ok=0
  log "สำเนา: $REMOTE:SaEDU-Backup → $MIRROR:SaEDU-Backup (sync)"
  rclone sync "$REMOTE:SaEDU-Backup" "$MIRROR:SaEDU-Backup" --transfers 4 --checkers 8 2>>"$LOG" || m_ok=0
  if [ "$m_ok" -eq 1 ]; then
    heartbeat_ok mirror; MIRROR_MSG=" · สำเนาไป $MIRROR แล้ว"; log "สำเนาเสร็จ"
  else
    heartbeat_fail mirror "rclone copy/sync ไป $MIRROR มี error (ดู log)"; MIRROR_MSG=" · ⚠️ สำเนาไป $MIRROR ไม่ครบ"; log "สำเนาไม่ครบ — รอบหน้าจะเก็บตกเอง (copy/sync ทำต่อจากที่ค้างได้)"
  fi
  FREE_M="$(rclone about "$MIRROR:" 2>/dev/null | awk '/^Free:/{print $2" "$3}')"
  [ -n "$FREE_M" ] && { log "พื้นที่เหลือบน $MIRROR: $FREE_M"; case "$FREE_M" in *KiB|*MiB|*" B") notify "⚠️ พื้นที่ $MIRROR เหลือแค่ $FREE_M";; esac; }
else
  log "ไม่มี remote สำเนา ($MIRROR) — ข้ามขั้นสำเนา"
fi

FREE="$(rclone about "$REMOTE:" 2>/dev/null | awk '/^Free:/{print $2" "$3}')"
[ -n "$FREE" ] && { log "พื้นที่เหลือบน $REMOTE: $FREE"; case "$FREE" in *KiB|*MiB|*" B") notify "⚠️ พื้นที่ $REMOTE เหลือแค่ $FREE";; esac; }

log "เสร็จ: $SUMMARY$MIRROR_MSG"
notify "$SUMMARY$MIRROR_MSG"
