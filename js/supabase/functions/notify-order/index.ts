// Sends Web Push alerts to every phone/computer the owner turned alerts on for.
// Called by the database (x-hook-secret) on each new order / membership application,
// or by a signed-in owner from the dashboard ("Send test alert").
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const money = (n: number) => "$" + Number(n).toFixed(2);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: cfg } = await sb.from("private_config").select("*").eq("id", 1).single();
  if (!cfg?.vapid_private) return json({ error: "Push keys are not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  let payload: Record<string, unknown>;

  if (req.headers.get("x-hook-secret") === cfg.hook_secret) {
    if (body.order_id) {
      const { data: o } = await sb.from("orders").select("code,total,cust_name,city,items").eq("id", body.order_id).single();
      if (!o) return json({ error: "order not found" }, 404);
      const n = (o.items as { qty: number }[]).reduce((s, i) => s + i.qty, 0);
      payload = {
        title: `New order ${o.code} · ${money(o.total)}`,
        body: `${o.cust_name} · ${o.city} · ${n} item${n === 1 ? "" : "s"} · cash`,
        tag: o.code, url: "/admin.html#orders",
      };
    } else if (body.member_id) {
      const { data: m } = await sb.from("members").select("name,tier").eq("id", body.member_id).single();
      if (!m) return json({ error: "member not found" }, 404);
      payload = { title: "New membership application", body: `${m.name} applied for ${m.tier}`, tag: "member-" + body.member_id, url: "/admin.html#members" };
    } else return json({ error: "bad request" }, 400);
  } else {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: "Sign in again to send a test alert" }, 401);
    const { data: a } = await sb.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!a) return json({ error: "Owner access required" }, 403);
    payload = { title: "Cargo+420 test alert", body: "Phone alerts are on. New orders will arrive like this.", tag: "test-" + Date.now(), url: "/admin.html#orders" };
  }

  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth");
  let sent = 0, removed = 0;
  const failures: unknown[] = [];
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await sb.from("push_subscriptions").delete().eq("id", s.id); removed++; }
      else failures.push({ code, msg: String((e as { body?: string }).body || e) });
    }
  }));
  return json({ sent, removed, devices: subs?.length || 0, failures });
});
