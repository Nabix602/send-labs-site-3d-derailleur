// Webhook Stripe : marque la commande « payée » après vérification de la signature et du montant.
// Secrets requis : STRIPE_WEBHOOK_SECRET (whsec_…). SUPABASE_SERVICE_ROLE_KEY est fourni automatiquement.
// À déployer SANS vérification JWT (Stripe n'envoie pas de jeton Supabase) : la signature fait foi.
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sign(secret, data) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

export async function handler(req, env, f = fetch, now = Date.now()) {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("non configuré", { status: 503 });
  const raw = await req.text();
  const hdr = req.headers.get("stripe-signature") || "";
  const parts = {}; hdr.split(",").forEach((x) => { const [k, v] = x.split("="); (parts[k] = parts[k] || []).push(v); });
  const t = parseInt((parts.t || [])[0], 10);
  if (!t || Math.abs(now / 1000 - t) > 300) return new Response("horodatage", { status: 400 });
  const exp = await sign(secret, t + "." + raw);
  if (!(parts.v1 || []).some((v) => same(v, exp))) return new Response("signature", { status: 400 });

  let ev; try { ev = JSON.parse(raw); } catch { return new Response("json", { status: 400 }); }
  if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return new Response("ignoré", { status: 200 });
  const s = ev.data && ev.data.object;
  const id = s && ((s.metadata && s.metadata.order_id) || s.client_reference_id);
  if (!s || s.payment_status !== "paid" || !/^[0-9a-f-]{36}$/.test(id || "")) return new Response("ignoré", { status: 200 });

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const rows = await (await f(env.SUPABASE_URL + "/rest/v1/orders?select=id,status,total_cents&id=eq." + id, { headers: H })).json();
  const o = Array.isArray(rows) ? rows[0] : null;
  if (!o || o.status !== "pending") return new Response("déjà traité", { status: 200 });
  if (s.amount_total !== o.total_cents) return new Response("montant différent : vérifier à la main", { status: 200 });
  const u = await f(env.SUPABASE_URL + "/rest/v1/orders?id=eq." + id + "&status=eq.pending", { method: "PATCH", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify({ status: "paid", payment_provider: "stripe", payment_ref: s.id, paid_at: new Date(now).toISOString() }) });
  return new Response(u.ok ? "ok" : "erreur base", { status: u.ok ? 200 : 500 });
}
if (typeof Deno !== "undefined") Deno.serve((req) => handler(req, Deno.env.toObject()));
