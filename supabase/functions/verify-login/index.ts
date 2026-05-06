// Supabase Edge Function: verify-login
// ตรวจสอบรหัสผ่านฝั่ง server — ไม่ส่ง password_hash กลับไปให้ client
// Deploy: supabase functions deploy verify-login
// @ts-nocheck

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const salt = new Uint8Array(parts[1].match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === parts[2];
}

async function hashPbkdf2(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "pbkdf2$" + saltHex + "$" + hashHex;
}

async function hashSha256(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { identifier, password } = await req.json();
    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: "ข้อมูลไม่ครบ" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiHeaders   = { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" };

    const enc = encodeURIComponent(identifier);
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/users?or=(student_id.eq." + enc + ",email.eq." + enc + ")&limit=1",
      { headers: apiHeaders }
    );
    const users = await res.json();
    const user  = Array.isArray(users) ? users[0] : null;

    if (!user) {
      // ตรวจสอบว่า pending หรือไม่
      const pendRes = await fetch(
        SUPABASE_URL + "/rest/v1/users?or=(student_id.eq." + enc + ",email.eq." + enc + ")&approval_status=eq.pending&limit=1",
        { headers: apiHeaders }
      );
      const pending = await pendRes.json();
      if (Array.isArray(pending) && pending.length) {
        return new Response(JSON.stringify({ error: "pending" }), {
          status: 403, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "invalid_credentials" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (user.approval_status !== "approved") {
      return new Response(JSON.stringify({ error: "pending" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ตรวจสอบรหัสผ่าน — ทั้งหมดทำฝั่ง server
    const stored = user.password_hash || "";
    let valid = false;
    if (stored.startsWith("pbkdf2$")) {
      valid = await verifyPbkdf2(password, stored);
    } else if (/^[0-9a-f]{64}$/.test(stored)) {
      valid = (await hashSha256(password)) === stored;
    }

    if (!valid) {
      return new Response(JSON.stringify({ error: "invalid_credentials" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Auto-upgrade hash เป็น PBKDF2 ถ้ายังเป็น SHA-256
    if (!stored.startsWith("pbkdf2$")) {
      const upgraded = await hashPbkdf2(password);
      await fetch(SUPABASE_URL + "/rest/v1/users?id=eq." + encodeURIComponent(user.id), {
        method: "PATCH",
        headers: { ...apiHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ password_hash: upgraded }),
      });
    }

    // ส่ง user profile กลับโดยไม่มี password_hash
    const { password_hash: _removed, ...safeUser } = user;
    return new Response(JSON.stringify({ user: safeUser }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("verify-login error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
