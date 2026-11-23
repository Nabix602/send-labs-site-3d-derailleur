// Crée une session Stripe Checkout pour une commande « pending » de l'utilisateur connecté.
// Secrets requis (dashboard Supabase > Edge Functions > Secrets) : STRIPE_SECRET_KEY.
// Écrit sans dépendance ni typage pour pouvoir être testé en Node.
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type" } });

export async function handler(req, env, f = fetch) {
  if (req.method === "OPTIONS") return json({});
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: "Paiement par carte non configuré" }, 503);
  const auth = req.headers.get("authorization") || "";
  const rest = (path, headers = {}) => f(env.SUPABASE_URL + "/rest/v1/" + path, { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth, ...headers } });
  let body; try { body = await req.json(); } catch { return json({ error: "json" }, 400); }
  const id = String(body.order_id || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "order_id" }, 400);

  const st = await (await rest("site_settings?select=key,value&key=in.(payment_card_enabled,site_url)")).json();
  const cfg = {}; (Array.isArray(st) ? st : []).forEach((r) => (cfg[r.key] = r.value));
  if (cfg.payment_card_enabled !== "1") return json({ error: "Paiement par carte désactivé" }, 403);
  const site = (cfg.site_url || "").replace(/\/$/, "");
  if (!/^https:\/\//.test(site)) return json({ error: "site_url manquant" }, 500);

  const rows = await (await rest("orders?select=*,order_items(*)&id=eq." + id)).json();
  const o = Array.isArray(rows) ? rows[0] : null;
  if (!o) return json({ error: "Commande introuvable" }, 404);
  if (o.status !== "pending") return json({ error: "Commande déjà traitée" }, 409);
  const items = o.order_items || [];
  const sum = items.reduce((a, i) => a + i.unit_price_cents * i.quantity, 0) - (o.discount_cents || 0) + (o.shipping_cents || 0);
  if (sum !== o.total_cents || o.total_cents < 50) return json({ error: "Montant incohérent" }, 409);

  const p = new URLSearchParams();
  p.set("mode", "payment"); p.set("client_reference_id", o.id); p.set("metadata[order_id]", o.id);
  p.set("payment_intent_data[metadata][order_id]", o.id);
  if (o.email) p.set("customer_email", o.email);
  p.set("success_url", site + "/compte.html?paiement=ok"); p.set("cancel_url", site + "/compte.html?paiement=annule");
  let n = 0;
  const line = (name, cents, q) => { p.set(`line_items[${n}][price_data][currency]`, "eur"); p.set(`line_items[${n}][price_data][unit_amount]`, String(cents)); p.set(`line_items[${n}][price_data][product_data][name]`, name); p.set(`line_items[${n}][quantity]`, String(q)); n++; };
  items.forEach((i) => line(i.name, i.unit_price_cents, i.quantity));
  if (o.shipping_cents > 0) line("Livraison", o.shipping_cents, 1);
  const sh = { authorization: "Bearer " + key, "content-type": "application/x-www-form-urlencoded" };
  if (o.discount_cents > 0) {
    const c = await f("https://api.stripe.com/v1/coupons", { method: "POST", headers: sh, body: new URLSearchParams({ amount_off: String(o.discount_cents), currency: "eur", duration: "once", name: String(o.discount_code || "Réduction") }) });
    const cj = await c.json();
    if (!cj.id) return json({ error: "coupon" }, 502);
    p.set("discounts[0][coupon]", cj.id);
  }
  const r = await f("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: sh, body: p });
  const j = await r.json();
  if (!j.url) return json({ error: "stripe" }, 502);
  return json({ url: j.url });
}
if (typeof Deno !== "undefined") Deno.serve((req) => handler(req, Deno.env.toObject()));
