// Supabase Edge Function: send-line
// ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API (push message)
//   {recipientId, text} — ส่งรายคน: recipientId คือ public.users.id (ไม่ใช่ LINE userId)
//   {group: true, text} — ส่งเข้ากลุ่มเจ้าหน้าที่ที่ผูกไว้ (groupId เก็บใน app_settings key 'line_group_id')
//   {..., flex} — (optional) bubble contents ของ Flex Message (สร้างโดย buildLineFlex ใน notif.js)
//                 ถ้าส่งมา จะส่งเป็นการ์ด Flex โดยใช้ text เป็น altText; ไม่ส่งมา = text ธรรมดาเหมือนเดิม
// การ resolve line_user_id/groupId ทำที่นี่ด้วย service role เพื่อไม่ต้อง expose ผ่าน client
// LINE นับ push เข้ากลุ่ม 1 ครั้ง = 1 ข้อความ ไม่ว่ากลุ่มจะมีกี่คน
// Secrets: LINE_CHANNEL_ACCESS_TOKEN
// Deploy: npx supabase functions deploy send-line  (verify_jwt เปิดตามค่า default — ต้องล็อกอินถึงเรียกได้)
// @ts-nocheck — Deno runtime, VS Code TypeScript checker ไม่รู้จัก Deno globals

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const { recipientId, text, group, flex } = await req.json();
    if ((!recipientId && group !== true) || !text) {
      return json({ error: "Missing required fields: recipientId (or group:true), text" }, 400);
    }

    const LINE_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
    if (!LINE_TOKEN) return json({ error: "LINE_CHANNEL_ACCESS_TOKEN not configured" }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let to: string;
    if (group === true) {
      const { data: row, error: gErr } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "line_group_id")
        .maybeSingle();
      if (gErr) return json({ error: gErr.message }, 500);
      // ยังไม่ได้ผูกกลุ่ม — ไม่ใช่ error (client ข้ามไปเงียบ ๆ)
      if (!row?.value) return json({ ok: false, skipped: "no_group" });
      to = row.value;
    } else {
      const { data: profile, error: qErr } = await admin
        .from("users")
        .select("line_user_id")
        .eq("id", recipientId)
        .maybeSingle();
      if (qErr) return json({ error: qErr.message }, 500);
      // ผู้รับยังไม่ผูก LINE — ไม่ใช่ error (client ข้ามไปเงียบ ๆ อีเมลยังส่งตามปกติ)
      if (!profile?.line_user_id) return json({ ok: false, skipped: "not_linked" });
      to = profile.line_user_id;
    }

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + LINE_TOKEN,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        to,
        messages: [
          flex && typeof flex === "object"
            // Flex Message — text ใช้เป็น altText (แสดงใน push preview/แชทลิสต์, จำกัด 400 ตัวอักษร)
            ? { type: "flex", altText: String(text).slice(0, 400), contents: flex }
            : { type: "text", text: String(text).slice(0, 4900) },
        ],
      }),
    });

    if (!lineRes.ok) {
      const detail = await lineRes.json().catch(() => ({}));
      console.error("LINE push error:", lineRes.status, JSON.stringify(detail));
      return json({ error: detail?.message || "LINE push failed", status: lineRes.status }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("send-line error:", err);
    return json({ error: String(err) }, 500);
  }
});
