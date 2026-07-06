// Supabase Edge Function: send-line
// ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API (push message) ไปยังผู้ใช้ที่ผูกบัญชี LINE ไว้
// รับ {recipientId, text} — recipientId คือ public.users.id (ไม่ใช่ LINE userId)
// การ resolve line_user_id ทำที่นี่ด้วย service role เพื่อไม่ต้อง expose LINE userId ผ่าน user_directory
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
    const { recipientId, text } = await req.json();
    if (!recipientId || !text) {
      return json({ error: "Missing required fields: recipientId, text" }, 400);
    }

    const LINE_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
    if (!LINE_TOKEN) return json({ error: "LINE_CHANNEL_ACCESS_TOKEN not configured" }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: qErr } = await admin
      .from("users")
      .select("line_user_id")
      .eq("id", recipientId)
      .maybeSingle();
    if (qErr) return json({ error: qErr.message }, 500);

    // ผู้รับยังไม่ผูก LINE — ไม่ใช่ error (client ข้ามไปเงียบ ๆ อีเมลยังส่งตามปกติ)
    if (!profile?.line_user_id) return json({ ok: false, skipped: "not_linked" });

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + LINE_TOKEN,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        to: profile.line_user_id,
        messages: [{ type: "text", text: String(text).slice(0, 4900) }],
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
