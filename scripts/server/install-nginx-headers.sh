#!/usr/bin/env bash
# รันจาก Mac: ส่ง snippet + สคริปต์ apply ขึ้นเซิร์ฟเวอร์คณะแล้วสั่ง apply ด้วย sudo
#   scripts/server/install-nginx-headers.sh user@13.251.103.183
# ก่อนรัน: ถ้าแก้ CSP ใน vercel.json ให้ node scripts/server/gen-nginx-headers.mjs ก่อน (สคริปต์นี้ทำให้อัตโนมัติ)
set -euo pipefail
TARGET="${1:-}"; [ -n "$TARGET" ] || { echo "ใช้: $0 user@host" >&2; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
node "$HERE/gen-nginx-headers.mjs"
scp -q "$HERE/saeduflow-headers.conf" "$HERE/apply-nginx-headers.sh" "$TARGET:/tmp/"
ssh -t "$TARGET" 'sudo bash /tmp/apply-nginx-headers.sh /tmp/saeduflow-headers.conf && rm -f /tmp/apply-nginx-headers.sh /tmp/saeduflow-headers.conf'
echo; echo "── ตรวจจากภายนอก ──"
curl -sI --max-time 20 https://saeduflow.edu.chula.ac.th/ | grep -iE '^(content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cache-control):' | cut -c1-110
