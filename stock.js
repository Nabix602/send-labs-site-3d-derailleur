/* Page /stock : ajustement rapide des stocks (réservée aux administrateurs) */
(function () {
  var S = window.SLapp, sb = S.sb, esc = S.esc;
  var root = document.getElementById("stock-root");

  function notice(msg, cls) { return '<div class="' + (cls || "notice") + '">' + esc(msg) + "</div>"; }
  function flash(msg, ok) { var el = document.getElementById("flash"); if (el) el.innerHTML = notice(msg, ok ? "ok" : "notice"); }
  var STATUS = { published: "Publié", soon: "Bientôt", draft: "Brouillon" };

  function rowClass(p) { return p.stock == null ? "" : p.stock <= 0 ? " out" : p.stock <= 3 ? " low" : ""; }

  function rowHtml(p) {
    var u = S.safeUrl(p.image_url);
    var tracked = p.stock != null;
    return '<div class="stock-row' + rowClass(p) + '" data-id="' + esc(p.id) + '">' +
      (u ? '<img src="' + esc(u) + '" alt="">' : '<div class="ph">' + esc(p.name.charAt(0)) + "</div>") +
      '<div><div class="nm">' + esc(p.name) + '</div><div class="sub">' + esc(STATUS[p.status] || p.status) + (p.is_drop ? " · Drop" : "") +
      (!tracked ? " · stock non suivi" : p.stock <= 0 ? " · ÉPUISÉ" : p.stock <= 3 ? " · stock bas" : "") + "</div></div>" +
      '<div class="stock-ctl"><label class="check" style="margin:0"><input type="checkbox" data-track' + (tracked ? " checked" : "") + "> Suivre</label>" +
      '<button type="button" data-step="-1" aria-label="Retirer 1"' + (tracked ? "" : " disabled") + ">−</button>" +
      '<input type="number" min="0" step="1" inputmode="numeric" data-qty value="' + (tracked ? esc(p.stock) : "") + '"' + (tracked ? "" : " disabled") + ">" +
      '<button type="button" data-step="1" aria-label="Ajouter 1"' + (tracked ? "" : " disabled") + ">+</button></div></div>";
  }

  function load() {
    return sb.from("products").select("id,name,status,stock,image_url,is_drop,kind").eq("kind", "product").order("sort_order").then(function (r) {
      if (r.error) { root.innerHTML = notice("Lecture impossible."); return; }
      root.innerHTML = '<div id="flash"></div>' + (r.data.length ? r.data.map(rowHtml).join("") : notice("Aucun produit."));
    });
  }

  function save(row, value) {
    var id = row.getAttribute("data-id");
    sb.from("products").update({ stock: value }).eq("id", id).then(function (r) {
      if (r.error) { flash("Enregistrement impossible."); return; }
      row.classList.remove("low", "out");
      var c = rowClass({ stock: value }).trim();
      if (c) row.classList.add(c);
      row.classList.add("saved");
      setTimeout(function () { row.classList.remove("saved"); }, 700);
      flash("Stock enregistré.", true);
    });
  }

  function bind() {
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-step]");
      if (!b) return;
      var row = b.closest(".stock-row"), q = row.querySelector("[data-qty]");
      var v = Math.max(0, (parseInt(q.value, 10) || 0) + parseInt(b.getAttribute("data-step"), 10));
      q.value = v; save(row, v);
    });
    root.addEventListener("change", function (e) {
      var row = e.target.closest(".stock-row");
      if (!row) return;
      var q = row.querySelector("[data-qty]");
      if (e.target.matches("[data-track]")) {
        var on = e.target.checked;
        row.querySelectorAll("[data-qty],[data-step]").forEach(function (x) { x.disabled = !on; });
        if (on) { q.value = q.value || "0"; save(row, parseInt(q.value, 10) || 0); } else { q.value = ""; save(row, null); }
      } else if (e.target.matches("[data-qty]")) {
        var v = parseInt(q.value, 10);
        if (isNaN(v) || v < 0) { flash("Entrez un nombre entier positif."); return; }
        save(row, v);
      }
    });
  }

  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (!s) { root.innerHTML = notice("Connectez-vous avec un compte administrateur.") + '<p style="text-align:center;margin-top:20px"><a class="btn" href="connexion.html?next=stock.html">Se connecter</a></p>'; return; }
    return sb.from("profiles").select("role").eq("id", s.user.id).maybeSingle().then(function (p) {
      if (!p.data || p.data.role !== "admin") { root.innerHTML = notice("Accès réservé aux administrateurs."); return; }
      bind();
      return load();
    });
  }).catch(function () { root.innerHTML = notice("Chargement impossible."); });
})();
