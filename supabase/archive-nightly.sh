#!/bin/bash
# ============================================================================
# SAEDU Flow — ย้ายไฟล์ของเอกสารที่จบแล้วขึ้นคลาวด์ (Google Drive/OneDrive) แบบอัตโนมัติ
#
# ตัวห่อของ 47_archive_to_drive.mjs สำหรับให้ launchd เรียกทุกคืน (ติดตั้งด้วย
# install-archive-launchd.sh) — รันเองด้วยมือก็ได้: ./archive-nightly.sh
#
# ทำอะไร:
#   1. ดึง service role key จาก macOS Keychain (service: saedu-service-role)
#      → ไม่มี key เป็นข้อความเปล่าอยู่ในไฟล์ไหนทั้งสิ้น
#   2. รัน 47 ด้วย --apply (fail-safe ต่อไฟล์อยู่ในสคริปต์นั้นแล้ว: ย้ายไม่สำเร็จ = ไม่ลบต้นทาง)
#   3. เขียน log ที่ ~/Library/Logs/saedu/archive-YYYY-MM.log
#   4. เด้ง notification บน Mac เมื่อ "ย้ายสำเร็จ" หรือ "ล้มเหลว" — รอบที่ไม่มีอะไรให้ย้ายจะเงียบ
#   5. เตือนเมื่อพื้นที่บนคลาวด์เหลือไม่ถึง 1 GiB
#
# รัน 47 สองรอบต่อคืน เพราะ "จบแล้ว" ไม่ได้แปลว่าปลอดภัยเท่ากันทุกสถานะ:
#   รอบ 1  completed + cancelled  นิ่งเกิน ARCHIVE_MIN_AGE_DAYS (ค่าเริ่มต้น 3)
#          — completed ยังมีขั้น "ส่งต่อให้ จนท. ยื่นคณะ" ตามหลัง ถ้าย้ายวันเดียวกับที่ออกเลข
#          ปุ่มโหลดของ จนท. จะกลายเป็นลิงก์คลาวด์แทน ใช้ได้แต่ไม่สะดวก 3 วันพอให้ขั้นนั้นจบ
#   รอบ 2  rejected  นิ่งเกิน ARCHIVE_REJECTED_MIN_AGE_DAYS (ค่าเริ่มต้น 30)
#          — rejected ไม่ใช่สถานะจบจริง ผู้สร้างแก้แล้วส่งใหม่ได้ และผู้ลงนามคนถัดไปต้องอ่าน PDF
#          เดิมจาก Supabase มาปั๊มลายเซ็น ย้ายเร็วไป = ลงนามไม่ได้ อย่าลดค่านี้
#
# ตั้งค่าได้ด้วย env (install-archive-launchd.sh ฝังค่าลง plist ให้):
#   ARCHIVE_RCLONE_REMOTE          ชื่อ remote ใน rclone (ค่าเริ่มต้น saedu) — ย้ายไป OneDrive ก็เปลี่ยนแค่นี้
#   ARCHIVE_SHARE                  ลิงก์แบบไหน: inherit (Google Drive) · org (OneDrive เฉพาะคนในองค์กร) · anyone
#   ARCHIVE_MIN_AGE_DAYS           รอบ 1 (ค่าเริ่มต้น 3)
#   ARCHIVE_REJECTED_MIN_AGE_DAYS  รอบ 2 (ค่าเริ่มต้น 30)
#   ARCHIVE_ROOT                   โฟลเดอร์บนสุดในคลาวด์ (ค่าเริ่มต้น SaEDU-Archive)
#   PURGE_CANCELLED                1 = ลบเอกสารที่ยกเลิกแล้วทิ้งถาวรก่อนรอบย้าย (ค่าเริ่มต้น 1; 0 = ไม่ลบ)
#                                  อายุขั้นต่ำมาจาก app_settings.cancel_purge_days (ตั้งค่าระบบ; ค่าเริ่มต้น 3 วัน)
#                                  — รันก่อน 47 เพื่อไม่ต้องขนไฟล์ของฉบับที่กำลังจะลบขึ้นคลาวด์ให้เสียเที่ยว
#
# ⚠️ remote "saedu" ที่ยังใช้ client_id กลางของ rclone จะหยุดทำงานเมื่อ Google ยกเลิกมัน (ภายในปี 2026)
#    วันนั้นงานนี้จะล้มเหลวและเด้งเตือน — แก้ด้วยการสร้าง client_id ของตัวเอง แล้ว
#    rclone config update saedu client_id=... client_secret=...  &&  rclone config reconnect saedu:
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")"

REMOTE="${ARCHIVE_RCLONE_REMOTE:-saedu}"
SHARE="${ARCHIVE_SHARE:-inherit}"
MIN_AGE="${ARCHIVE_MIN_AGE_DAYS:-3}"
REJ_MIN_AGE="${ARCHIVE_REJECTED_MIN_AGE_DAYS:-30}"
ROOT="${ARCHIVE_ROOT:-SaEDU-Archive}"
PURGE="${PURGE_CANCELLED:-1}"
LOG_DIR="$HOME/Library/Logs/saedu"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/archive-$(date +%Y-%m).log"

# launchd ให้ PATH มาแค่ /usr/bin:/bin — node กับ rclone อยู่ใน homebrew
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export RCLONE_LOG_LEVEL=ERROR   # ปิด NOTICE เรื่อง client_id ที่รก log
export SUPABASE_URL="${SUPABASE_URL:-https://jrubupvzltxqstzcpoov.supabase.co}"

log()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
notify() { osascript -e "display notification \"$1\" with title \"SaEDU คลังเอกสาร\"" >/dev/null 2>&1 || true; }
# heartbeat: บันทึกเวลารอบล่าสุดลง app_settings ให้หน้าเว็บ (homeViews.js _rOpsWatch) เตือนแอดมินได้
# เมื่อเครื่องนี้ไม่ได้รันงานมาหลายวัน — เพราะ launchd บนเครื่องที่ปิดอยู่เตือนใครไม่ได้
. "$(dirname "$0")/ops-heartbeat.sh"

# กันรันซ้อน (เช่น รอบก่อนยังอัปไม่เสร็จเพราะเน็ตช้า) — mkdir เป็น atomic บน bash 3.2
LOCK="$LOG_DIR/.archive-lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  log "ข้าม: รอบก่อนหน้ายังรันอยู่ ($LOCK) — ถ้าแน่ใจว่าไม่มีอะไรรัน ลบโฟลเดอร์นี้ทิ้งได้"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password -s saedu-service-role -w 2>/dev/null || true)"
fi
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  log "ล้มเหลว: ไม่พบ key ใน Keychain — เพิ่มด้วย: security add-generic-password -a \"\$USER\" -s saedu-service-role -w 'sb_secret_...' -U"
  notify "ล้มเหลว: ไม่พบ key ใน Keychain"
  exit 1
fi
export SUPABASE_SERVICE_ROLE_KEY

log "เริ่ม: remote=$REMOTE share=$SHARE root=$ROOT · completed,cancelled ≥$MIN_AGE วัน · rejected ≥$REJ_MIN_AGE วัน"

# รัน 47 หนึ่งรอบ: $1 = สถานะ, $2 = min-age — เขียน log แบบสด ๆ (รอบใหญ่ใช้เวลาหลายชั่วโมง
# tail -f ดูความคืบหน้าได้) และเก็บบรรทัดสรุปของรอบไว้รวมใน notification
FAILED=0; SUMMARIES=""
run_pass() {
  local statuses="$1" age="$2" run_out rc summary
  run_out="$(mktemp -t saedu-archive)"
  log "รอบ: $statuses (นิ่งเกิน $age วัน)"
  node 47_archive_to_drive.mjs --remote="$REMOTE" --root="$ROOT" --share="$SHARE" \
       --statuses="$statuses" --min-age-days="$age" --apply 2>&1 | tee -a "$LOG" > "$run_out"
  rc=${PIPESTATUS[0]}
  summary="$(grep -E '^เสร็จ:' "$run_out" | tail -1)"
  rm -f "$run_out"
  if [ "$rc" -ne 0 ]; then FAILED=1; log "รอบ $statuses ล้มเหลว (exit $rc)"; fi
  [ -n "$summary" ] && SUMMARIES="${SUMMARIES:+$SUMMARIES · }$summary"
  return 0
}
# รอบ 0: ลบเอกสารที่ยกเลิกแล้วทิ้งถาวร (54) — ล้มก็ไม่กั้นรอบย้าย แค่นับเป็นล้มเหลวเพื่อเด้งเตือน
# ลบจากทั้ง remote หลักและ mirror (backup-weekly.sh copy คลังไป onedrive) ไม่งั้น mirror เก็บซากไว้ตลอด
if [ "$PURGE" = "1" ]; then
  purge_out="$(mktemp -t saedu-purge)"
  log "รอบ: ลบเอกสารที่ยกเลิกแล้ว (54_purge_cancelled_docs.mjs)"
  node 54_purge_cancelled_docs.mjs --remotes="$REMOTE,${MIRROR_RCLONE_REMOTE:-onedrive}" --apply 2>&1 | tee -a "$LOG" > "$purge_out"
  rc=${PIPESTATUS[0]}
  summary="$(grep -E '^เสร็จ:' "$purge_out" | tail -1)"
  rm -f "$purge_out"
  if [ "$rc" -ne 0 ]; then FAILED=1; log "รอบลบเอกสารที่ยกเลิกแล้วล้มเหลว (exit $rc)"; fi
  if [ -n "$summary" ] && [ "$summary" != "เสร็จ: ลบ 0 เอกสาร" ]; then SUMMARIES="${SUMMARIES:+$SUMMARIES · }$summary"; fi
fi
run_pass "completed,cancelled" "$MIN_AGE"
run_pass "rejected" "$REJ_MIN_AGE"

if [ "$FAILED" -ne 0 ]; then
  log "มีรอบที่ล้มเหลว — ไฟล์ที่ย้ายไม่สำเร็จยังอยู่ใน Supabase ครบ คืนถัดไปจะลองใหม่เอง"
  notify "ย้ายไฟล์ล้มเหลว — ดู log ที่ ~/Library/Logs/saedu"
  heartbeat_fail archive "รอบย้ายไฟล์ล้มเหลว ($(date '+%Y-%m-%d %H:%M'))"
  exit 1
fi
if [ -n "$SUMMARIES" ]; then
  log "$SUMMARIES"
  notify "$SUMMARIES"
else
  log "ไม่มีเอกสารเข้าเกณฑ์ ไม่ได้ย้ายอะไร"
fi
heartbeat_ok archive

FREE="$(rclone about "$REMOTE:" 2>/dev/null | awk '/^Free:/{print $2" "$3}')"
if [ -n "$FREE" ]; then
  log "พื้นที่เหลือบนคลาวด์: $FREE"
  case "$FREE" in *KiB|*MiB|*" B") notify "⚠️ พื้นที่คลาวด์เหลือแค่ $FREE";; esac
fi
