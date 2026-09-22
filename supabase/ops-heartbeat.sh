#!/bin/bash
# ============================================================================
# SAEDU Flow — heartbeat ของงานอัตโนมัติบนเครื่องนี้ (source จาก archive-nightly.sh / backup-weekly.sh)
#
# ปัญหาที่แก้: launchd บน Mac ที่ปิดอยู่ "เงียบ" — ไม่มีอะไรบอกใครว่างานไม่ได้รันมา 3 สัปดาห์
# จนกว่า Supabase จะเต็มอีกรอบ ทางเดียวที่เตือนได้คือให้ "ที่อื่น" เห็นเวลารอบล่าสุด:
# ทุกรอบที่จบเขียน app_settings.ops_<งาน>_last_ok = เวลาตอนนี้ (ISO) ผ่าน REST ด้วย service role
# (RLS ไม่กั้น service role; upsert ด้วย Prefer: resolution=merge-duplicates บน PK key)
# หน้าเว็บโหลด app_settings ทุกครั้งที่ล็อกอินอยู่แล้ว (loadAppSettings → SETT) — homeViews.js
# _rOpsWatch() เทียบกับเวลาปัจจุบัน เกินเกณฑ์ก็ขึ้นแบนเนอร์ให้แอดมิน/จนท./dev + ยิง LINE เข้ากลุ่ม
#
# key ที่ใช้:  ops_archive_last_ok · ops_backup_last_ok · ops_mirror_last_ok  (ISO เวลาที่จบสำเร็จ)
#             ops_<งาน>_last_fail  (ISO|ข้อความสั้น ๆ) — เขียนเมื่อรอบล้มเหลว หน้าเว็บโชว์ถ้าใหม่กว่า last_ok
# ไม่มีรอบไหนพัง ถ้าเขียน heartbeat ไม่ได้ — แค่ log แล้วไปต่อ (มันคือตัวเสริม ไม่ใช่ตัวงาน)
# ต้องมี env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY และฟังก์ชัน log() ของผู้เรียก
#
# นอกจาก heartbeat ไฟล์นี้ยังถือ 2 ตัวช่วยที่งานกลางคืนทั้งคู่ต้องใช้ (มันถูก source อยู่แล้ว):
#   wait_for_network [นาที]  รอจน Supabase ตอบ (poll ทุก 15 วิ) — launchd รันงานที่พลาดรอบทันทีที่
#                            เครื่องตื่น ซึ่ง Wi-Fi ยังไม่ต่อ ผลคือ "fetch failed" ทุกตาราง (2026-09-20:
#                            backup เริ่ม 04:09 ตอนเครื่องกึ่งหลับ ค้าง 8 ชม. จบ 12:27 ตอนตื่นแต่เน็ตยังไม่มา
#                            แล้วรอไปอีก 7 วันกว่าจะได้ลองใหม่) — รอไม่ไหวคืน 1 ให้ผู้เรียก fail ชัด ๆ
#   keep_awake               re-exec ตัวเองใต้ caffeinate -i (กัน idle sleep ระหว่างรัน; ปิดฝา/แบตหมด
#                            กันไม่ได้) — เรียกบรรทัดแรก ๆ ก่อน lock/trap เพราะมัน exec ทับ process
# ============================================================================

keep_awake() {
  [ "${SAEDU_CAFFEINATED:-}" = "1" ] && return 0
  command -v caffeinate >/dev/null 2>&1 || return 0
  # ผู้เรียกทั้งสอง cd เข้าโฟลเดอร์ตัวเองแล้ว → $PWD/ชื่อไฟล์ คือ path สัมบูรณ์ที่ถูกเสมอ
  # ($0 ดิบใช้ไม่ได้: เรียกเป็น bash supabase/x.sh จาก repo root มันจะกลายเป็น supabase/supabase/x.sh)
  local self="$PWD/$(basename "$0")"
  SAEDU_CAFFEINATED=1 exec caffeinate -i /bin/bash "$self" "$@"
}
wait_for_network() {
  local max_min="${1:-10}" tries i
  tries=$(( max_min * 4 ))
  for (( i = 1; i <= tries; i++ )); do
    if curl -sS -o /dev/null --max-time 8 -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY:-}" "$SUPABASE_URL/rest/v1/" 2>/dev/null; then
      [ "$i" -gt 1 ] && log "เน็ตกลับมาแล้วหลังรอ $(( (i - 1) * 15 )) วิ" 2>/dev/null
      return 0
    fi
    [ "$i" -eq 1 ] && log "ยังต่อ Supabase ไม่ได้ — รอเน็ตสูงสุด $max_min นาที" 2>/dev/null
    sleep 15
  done
  return 1
}

_hb_put() {   # $1 key  $2 value  $3 label
  local key="$1" val="$2" label="$3" now body code
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # กัน " และ \ ในข้อความ (ข้อความ fail อาจมีอะไรก็ได้)
  val="$(printf '%s' "$val" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n\r')"
  body="[{\"key\":\"$key\",\"value\":\"$val\",\"label\":\"$label\",\"value_type\":\"text\",\"updated_at\":\"$now\"}]"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
    -X POST "$SUPABASE_URL/rest/v1/app_settings" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates,return=minimal" \
    -d "$body" 2>/dev/null || echo 000)"
  case "$code" in 2*) return 0;; esac
  log "heartbeat $key เขียนไม่ได้ (HTTP $code) — ไม่กระทบงานหลัก" 2>/dev/null || true
  return 1
}
heartbeat_ok()   { _hb_put "ops_${1}_last_ok"   "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "เวลาที่งาน $1 สำเร็จล่าสุด (เขียนอัตโนมัติจากเครื่องผู้ดูแล — ห้ามแก้เอง)"; }
heartbeat_fail() { _hb_put "ops_${1}_last_fail" "$(date -u +%Y-%m-%dT%H:%M:%SZ)|${2:-ล้มเหลว}" "เวลาที่งาน $1 ล้มเหลวล่าสุด + สาเหตุ (เขียนอัตโนมัติ)"; }
