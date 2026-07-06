// Supabase Edge Function: line-webhook
// รับ webhook event จาก LINE Messaging API — ใช้ผูกบัญชี LINE เข้ากับ public.users
// ผู้ใช้พิมพ์รหัส 6 หลัก (ที่แอปสร้างไว้ใน users.line_link_code) ส่งในแชท OA
// → จับคู่รหัส → เขียน line_user_id → ตอบยืนยันด้วย reply token (ฟรี ไม่กินโควตา push)
//
// รองรับกลุ่มด้วย: เชิญบอทเข้ากลุ่ม (join event) → แอดมินสร้าง "รหัสเชื่อมกลุ่ม" ใน
// ตั้งค่าระบบ (app_settings: line_group_link_code + line_group_link_expires) แล้วพิมพ์
// รหัสในกลุ่ม → บันทึก groupId ลง app_settings key 'line_group_id' (กลุ่มเดียวทั้งระบบ)
// บอทถูกเอาออกจากกลุ่ม (leave event) → ล้าง line_group_id ทิ้ง
//
// Secrets: LINE_CHANNEL_SECRET (verify ลายเซ็น), LINE_CHANNEL_ACCESS_TOKEN (ส่ง reply)
// Deploy: npx supabase functions deploy line-webhook --no-verify-jwt
//   ⚠️ ต้องมี --no-verify-jwt เพราะเซิร์ฟเวอร์ LINE ไม่มี JWT ของ Supabase —
//   ความถูกต้องของ request ตรวจด้วย x-line-signature (HMAC-SHA256 ด้วย channel secret) แทน
// จากนั้นตั้ง Webhook URL ใน LINE Developers Console:
//   https://<project-ref>.supabase.co/functions/v1/line-webhook
// @ts-nocheck — Deno runtime, VS Code TypeScript checker ไม่รู้จัก Deno globals

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const LINK_CODE_RE = /^\d{6}$/;

async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

async function reply(replyToken: string, text: string) {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
  if (!token || !replyToken) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    });
  } catch (e) {
    console.error("LINE reply error:", e);
  }
}

Deno.serve(async (req: Request) => {
  // LINE ยิง POST เท่านั้น; ตอบ 200 กับ GET เผื่อกด verify จาก console
  if (req.method !== "POST") return new Response("ok");

  const secret = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
  if (!secret) {
    console.error("LINE_CHANNEL_SECRET not configured");
    return new Response("misconfigured", { status: 500 });
  }

  const rawBody = await req.text();
  const okSig = await verifySignature(rawBody, req.headers.get("x-line-signature") ?? "", secret);
  if (!okSig) return new Response("bad signature", { status: 401 });

  let payload: { events?: unknown[] };
  try { payload = JSON.parse(rawBody); } catch { return new Response("bad json", { status: 400 }); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // helper: อ่าน/เขียนค่าใน app_settings (key เป็น primary key → upsert ได้)
  async function getSetting(key: string): Promise<string> {
    const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
    return data?.value ?? "";
  }
  async function setSetting(key: string, value: string) {
    await admin.from("app_settings").upsert(
      { key, value, label: key, value_type: "text", updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  }

  for (const ev of payload.events ?? []) {
    try {
      const lineUserId = ev?.source?.userId ?? "";
      const groupId    = ev?.source?.type === "group" ? (ev?.source?.groupId ?? "") : "";

      // ── บอทถูกเชิญเข้ากลุ่ม ──
      if (ev.type === "join" && groupId) {
        await reply(ev.replyToken,
          "สวัสดีค่ะ 👋 นี่คือระบบแจ้งเตือน SAEDU Flow\n\n" +
          "หากต้องการให้กลุ่มนี้รับแจ้งเตือนเอกสาร:\n" +
          "ให้ผู้ดูแลระบบเข้า \"จัดการระบบ → ตั้งค่าระบบ\" กด \"สร้างรหัสเชื่อมกลุ่ม\" " +
          "แล้วนำรหัส 6 หลักมาพิมพ์ส่งในกลุ่มนี้ภายใน 10 นาทีค่ะ");
        continue;
      }

      // ── บอทถูกเอาออกจากกลุ่ม — ถ้าเป็นกลุ่มที่ผูกไว้ ให้ล้างทิ้ง (push ไม่ได้อีกแล้ว) ──
      if (ev.type === "leave" && groupId) {
        if ((await getSetting("line_group_id")) === groupId) await setSetting("line_group_id", "");
        continue;
      }

      // ── ข้อความในกลุ่ม: สนใจเฉพาะรหัสเชื่อมกลุ่ม (ไม่ผูกบัญชีส่วนตัวจากในกลุ่ม —
      //    รหัสส่วนตัวที่พิมพ์ในกลุ่มคนอื่นเห็นและแย่งใช้ได้) ──
      if (ev.type === "message" && ev.message?.type === "text" && groupId) {
        const gText = String(ev.message.text || "").trim();
        if (!LINK_CODE_RE.test(gText)) continue;
        const code = await getSetting("line_group_link_code");
        const exp  = await getSetting("line_group_link_expires");
        if (!code || gText !== code || (exp && new Date(exp) < new Date())) {
          await reply(ev.replyToken,
            "❌ รหัสเชื่อมกลุ่มไม่ถูกต้องหรือหมดอายุแล้ว\nกรุณาสร้างรหัสใหม่ใน \"ตั้งค่าระบบ\" แล้วส่งมาใหม่ภายใน 10 นาทีค่ะ");
          continue;
        }
        await setSetting("line_group_id", groupId);
        await setSetting("line_group_link_code", "");
        await setSetting("line_group_link_expires", "");
        await reply(ev.replyToken,
          "✅ เชื่อมต่อกลุ่มสำเร็จ!\nกลุ่มนี้จะได้รับการแจ้งเตือนเอกสารจากระบบ SAEDU Flow ค่ะ 📄");
        continue;
      }

      if (ev.type === "follow") {
        await reply(ev.replyToken,
          "สวัสดีค่ะ 👋 นี่คือระบบแจ้งเตือน SAEDU Flow\n\n" +
          "หากต้องการรับการแจ้งเตือนเอกสารทาง LINE:\n" +
          "1. เข้าระบบ SAEDU Flow\n" +
          "2. กดกระดิ่งแจ้งเตือน → \"รับแจ้งเตือนทาง LINE\"\n" +
          "3. นำรหัส 6 หลักที่ได้ มาพิมพ์ส่งในแชทนี้ได้เลยค่ะ");
        continue;
      }

      if (ev.type === "unfollow") {
        // ผู้ใช้บล็อก OA — push จะส่งไม่ได้อีก ล้างการผูกทิ้งไปเลย
        if (lineUserId) {
          await admin.from("users")
            .update({ line_user_id: null })
            .eq("line_user_id", lineUserId);
        }
        continue;
      }

      // ── ข้อความ 1:1 เท่านั้น (ผูกบัญชีส่วนตัว) — แชทกลุ่ม/ห้องไม่เข้าเงื่อนไขนี้ ──
      if (ev.type === "message" && ev.message?.type === "text" && lineUserId && ev.source?.type === "user") {
        const text = String(ev.message.text || "").trim();
        // สนใจเฉพาะข้อความหน้าตาเป็นรหัส 6 หลัก — ข้อความอื่นเงียบไว้ ไม่ spam ตอบกลับ
        if (!LINK_CODE_RE.test(text)) continue;

        const { data: match } = await admin
          .from("users")
          .select("id, full_name, line_link_code_expires_at")
          .eq("line_link_code", text)
          .maybeSingle();

        if (!match || (match.line_link_code_expires_at &&
            new Date(match.line_link_code_expires_at) < new Date())) {
          await reply(ev.replyToken,
            "❌ รหัสไม่ถูกต้องหรือหมดอายุแล้ว\nกรุณาสร้างรหัสใหม่ในระบบ SAEDU Flow (กระดิ่งแจ้งเตือน → รับแจ้งเตือนทาง LINE) แล้วส่งมาใหม่ภายใน 10 นาทีค่ะ");
          continue;
        }

        // LINE บัญชีนี้เคยผูกกับผู้ใช้อื่นไว้ → ย้ายการผูก (กัน unique index ชน)
        await admin.from("users")
          .update({ line_user_id: null })
          .eq("line_user_id", lineUserId)
          .neq("id", match.id);

        const { error: upErr } = await admin.from("users")
          .update({ line_user_id: lineUserId, line_link_code: null, line_link_code_expires_at: null })
          .eq("id", match.id);

        if (upErr) {
          console.error("link update error:", upErr);
          await reply(ev.replyToken, "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งค่ะ");
          continue;
        }

        await reply(ev.replyToken,
          "✅ เชื่อมต่อสำเร็จ!\nคุณ " + (match.full_name || "") +
          " จะได้รับการแจ้งเตือนเอกสารจากระบบ SAEDU Flow ทาง LINE นี้ค่ะ 📄");
      }
    } catch (e) {
      console.error("line-webhook event error:", e);
    }
  }

  // ตอบ 200 เสมอ — LINE จะ retry ถ้าได้ non-2xx ซึ่งไม่ช่วยอะไรกับ event ที่ประมวลผลแล้ว
  return new Response("ok");
});
