(function () {
  var C = window.SL || {};
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  var msg = document.getElementById("msg"), pick = document.getElementById("pick"), go = document.getElementById("go"), pr = document.getElementById("print"), sheet = document.getElementById("sheet");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var base = location.origin;
  var orders = [];
  function cards(list) {
    sheet.innerHTML = list.map(function (o) {
      var url = base + "/ta-surprise.html?c=" + o.surprise_token;
      return '<div class="card"><div class="qr">' + window.SLqr.svg(url, { size: 200 }) + '</div><div><h2>Ta <span>surprise</span> est là.</h2><p>Scanne le QR : un cadeau pour ta prochaine commande t’attend.</p><small>SendLabs · fait main dans les Yvelines</small></div></div>';
    }).join("");
    pr.hidden = !list.length;
  }
  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (!s) { msg.innerHTML = 'Connecte-toi avec ton compte admin : <a href="connexion.html?next=admin.html">connexion</a>.'; return; }
    return sb.from("orders").select("id,created_at,full_name,status,surprise_token").neq("status", "cancelled").order("created_at", { ascending: false }).limit(100).then(function (q) {
      if (q.error || !q.data) { msg.textContent = "Accès refusé (compte admin requis)."; return; }
      orders = q.data;
      var ids = (new URLSearchParams(location.search).get("o") || "").split(",");
      msg.textContent = orders.length ? "Coche les commandes à emballer (une carte par colis) :" : "Aucune commande pour le moment.";
      pick.hidden = false; go.hidden = !orders.length;
      pick.innerHTML = orders.map(function (o) {
        return '<label><input type="checkbox" value="' + esc(o.id) + '"' + (ids.indexOf(o.id) !== -1 || ids.indexOf(o.id.slice(0, 8)) !== -1 ? " checked" : "") + "> " + esc(o.id.slice(0, 8)) + " — " + esc(o.full_name) + " — " + esc(o.status) + "</label>";
      }).join("");
      go.onclick = function () {
        var sel = [].slice.call(pick.querySelectorAll("input:checked")).map(function (i) { return i.value; });
        cards(orders.filter(function (o) { return sel.indexOf(o.id) !== -1; }));
      };
    });
  });
})();
