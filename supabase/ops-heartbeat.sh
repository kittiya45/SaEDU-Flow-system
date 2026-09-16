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
# ============================================================================

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
