(function () {
  var C = window.SL || {}, sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey), box = document.getElementById("slip");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(c) { return (c / 100).toFixed(2).replace(".", ",") + " €"; }
  var id = new URLSearchParams(location.search).get("o") || "";
  sb.auth.getSession().then(function (r) {
    if (!r.data.session) { box.innerHTML = 'Connecte-toi avec ton compte admin : <a href="connexion.html?next=admin.html">connexion</a>.'; return; }
    return sb.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle().then(function (q) {
      var o = q.data;
      if (!o) { box.textContent = "Commande introuvable (compte admin requis)."; return; }
      var url = location.origin + "/ta-surprise.html?c=" + o.surprise_token;
      box.innerHTML = '<div class="row"><div><h1>Commande SL-' + esc(o.order_number) + "</h1><div>" + esc(new Date(o.created_at).toLocaleDateString("fr-FR")) + " · " + esc(o.status) + "</div>" +
        "<p><strong>" + esc(o.full_name) + "</strong><br>" + esc(o.address).replace(/\n/g, "<br>") + "<br>" + esc(o.phone || "") + "</p>" +
        (o.relay_point ? "<p><strong>Point relais :</strong> " + esc(o.relay_point) + "</p>" : "") + "<p>" + esc(o.shipping_method || "") + (o.tracking_number ? " · suivi " + esc(o.tracking_number) : "") + "</p></div>" +
        '<div style="text-align:center"><div class="qr">' + window.SLqr.svg(url, { size: 160 }) + "</div><small>QR « Ta surprise »<br>à glisser dans le colis</small></div></div>" +
        "<table><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr>" + (o.order_items || []).map(function (i) { return "<tr><td>" + esc(i.name) + "</td><td>" + i.quantity + "</td><td>" + eur(i.unit_price_cents) + "</td></tr>"; }).join("") + "</table>" +
        "<p>Total : <strong>" + eur(o.total_cents) + "</strong>" + (o.note ? "<br>Note : " + esc(o.note) : "") + "</p><p>Merci de rouler SendLabs !</p>";
    });
  });
})();
