// Supabase Edge Function: send-email
// ส่งอีเมลจริงผ่าน Brevo Transactional API
// Secrets: BREVO_API_KEY, FROM_EMAIL, FROM_NAME
// @ts-nocheck — Deno runtime, VS Code TypeScript checker ไม่รู้จัก Deno globals

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
    const FROM_NAME     = Deno.env.get("FROM_NAME")     ?? "SAEDU Flow";
    const FROM_EMAIL    = Deno.env.get("FROM_EMAIL")    ?? "";

    if (!BREVO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "BREVO_API_KEY not configured" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const toList = (Array.isArray(to) ? to : [to]).map((email: string) => ({ email }));

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key":      BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body: JSON.stringify({
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        to:          toList,
        subject:     subject,
        htmlContent: html,
      }),
    });

    const data = await brevoRes.json();

    if (!brevoRes.ok) {
      console.error("Brevo error:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), {
        status: brevoRes.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, messageId: data.messageId }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
