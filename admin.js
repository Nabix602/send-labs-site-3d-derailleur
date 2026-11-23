/* Espace administrateur : commandes, produits, messages, clients, réglages */
(function () {
  var S = window.SLapp, sb = S.sb, esc = S.esc, money = S.money;
  var root = document.getElementById("admin");
  var STATUS = { pending: "En attente de paiement", paid: "Payée", shipped: "Expédiée", cancelled: "Annulée" };
  var tab = "dash";

  function notice(msg, cls) { return '<div class="' + (cls || "notice") + '">' + esc(msg) + "</div>"; }
  function opt(value, label, cur) { return '<option value="' + esc(value) + '"' + (value === cur ? " selected" : "") + ">" + esc(label) + "</option>"; }
  function toCents(v) {
    v = String(v || "").trim().replace(",", ".");
    if (v === "") return null;
    var n = parseFloat(v);
    return isNaN(n) || n < 0 ? undefined : Math.round(n * 100);
  }
  function toInt(v) {
    v = String(v || "").trim();
    if (v === "") return null;
    var n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? undefined : n;
  }
  function flash(msg, ok) {
    var el = document.getElementById("flash");
    if (el) el.innerHTML = notice(msg, ok ? "ok" : "notice");
  }

  function tabsHtml() {
    var names = { dash: "Tableau de bord", orders: "Commandes", products: "Produits", stock: "Stock", drop: "Drop", shop: "Livraison & promos", messages: "Messages", clients: "Clients", settings: "Réglages" };
    return '<div class="tabs">' + Object.keys(names).map(function (k) {
      return '<button data-tab="' + k + '" class="' + (k === tab ? "on" : "") + '">' + names[k] + "</button>";
    }).join("") + '</div><div id="flash"></div><div id="tab-body"></div>';
  }
  function body() { return document.getElementById("tab-body"); }

  var views = {
    dash: function () {
      return Promise.all([
        sb.from("orders").select("id,order_number,created_at,status,total_cents,full_name,address,relay_point,shipping_method,carrier,tracking_number,ambassador_code,email,phone,subtotal_cents,discount_cents,discount_code,shipping_cents,paid_at,shipped_at").order("created_at", { ascending: false }).limit(500),
        sb.from("products").select("name,stock,status").not("stock", "is", null).lte("stock", 3).eq("status", "published"),
        sb.from("submissions").select("id", { count: "exact", head: true })
      ]).then(function (r) {
        var o = r[0].data || [], low = r[1].data || [], msgs = r[2].count || 0;
        window.__orders = o;
        var rev = 0, rev30 = 0, pend = [], paid = [], ship = 0, now = Date.now(), days = {};
        o.forEach(function (x) {
          if (x.status === "paid" || x.status === "shipped") {
            rev += x.total_cents;
            var t = new Date(x.paid_at || x.created_at).getTime();
            if (now - t < 30 * 864e5) rev30 += x.total_cents;
            var k = Math.floor((now - t) / 864e5); if (k < 14) days[k] = (days[k] || 0) + x.total_cents;
          }
          if (x.status === "pending") pend.push(x);
          if (x.status === "paid") paid.push(x);
          if (x.status === "shipped") ship++;
        });
        var max = 1; for (var k = 0; k < 14; k++) max = Math.max(max, days[k] || 0);
        var bars = ""; for (var j = 13; j >= 0; j--) bars += '<i title="J-' + j + " : " + money(days[j] || 0) + '" style="height:' + Math.round((days[j] || 0) / max * 100) + '%"></i>';
        function num(x) { return x.order_number ? "SL-" + x.order_number : x.id.slice(0, 8); }
        var kp = function (v, l) { return '<div class="kpi"><b>' + v + "</b><span>" + l + "</span></div>"; };
        var h = '<div class="kpis">' + kp(money(rev), "Encaissé (total)") + kp(money(rev30), "Encaissé (30 jours)") + kp(pend.length, "À encaisser (virements)") + kp(paid.length, "À expédier") + kp(ship, "Expédiées") + kp(o.length ? money(Math.round(rev / Math.max(1, o.filter(function (x) { return x.status === "paid" || x.status === "shipped"; }).length))) : "—", "Panier moyen") + kp(msgs, "Messages / formulaires") + "</div>";
        h += '<div class="panel"><h3>Encaissements, 14 derniers jours</h3><div class="bars">' + bars + '</div></div>';
        h += '<div class="panel"><h3>1. À encaisser (' + pend.length + ")</h3>" + (pend.length ? pend.map(function (x) {
          return '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span><strong>' + esc(num(x)) + "</strong> · " + esc(x.full_name || "") + " · " + money(x.total_cents) + " · " + esc(S.dateFr(x.created_at)) +
            '</span><span><button class="btn small" data-action="mark-paid" data-id="' + esc(x.id) + '">Virement reçu</button> <button class="btn small ghost" data-action="mark-cancel" data-id="' + esc(x.id) + '">Annuler</button></span></div>';
        }).join("") : "<p>Rien en attente.</p>") + "</div>";
        h += '<div class="panel"><h3>2. À expédier (' + paid.length + ")</h3>" + (paid.length ? paid.map(function (x) {
          return '<div style="padding:8px 0;border-bottom:1px solid var(--line)"><strong>' + esc(num(x)) + "</strong> · " + esc(x.full_name || "") + " · " + money(x.total_cents) + "<br><small>" + esc(x.shipping_method || "") + (x.relay_point ? " → " + esc(x.relay_point) : "") + "</small>" +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><input data-d-carrier="' + esc(x.id) + '" placeholder="Transporteur" value="Mondial Relay" size="14"><input data-d-track="' + esc(x.id) + '" placeholder="N° de suivi / expédition" size="22">' +
            '<button class="btn small" data-action="mark-shipped" data-id="' + esc(x.id) + '">Expédiée</button> <a class="btn small ghost" target="_blank" href="bordereau.html?o=' + esc(x.id) + '">Bon de préparation + QR</a></div></div>';
        }).join("") : "<p>Rien à expédier.</p>") + "</div>";
        h += '<div class="panel"><h3>Stock bas</h3>' + (low.length ? low.map(function (p) { return "<p>" + esc(p.name) + " : <strong>" + p.stock + "</strong></p>"; }).join("") : "<p>RAS (seuls les produits avec stock suivi sont contrôlés).</p>") + "</div>";
        h += '<div class="panel"><h3>Exports</h3><button class="btn small" data-action="export-csv">Télécharger les commandes (CSV pour Excel / comptabilité)</button></div>';
        body().innerHTML = h;
      });
    },

    orders: function () {
      return sb.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(100).then(function (r) {
        if (r.error) { body().innerHTML = notice("Lecture impossible."); return; }
        if (!r.data.length) { body().innerHTML = notice("Aucune commande pour le moment."); return; }
        body().innerHTML = r.data.map(function (o) {
          var items = (o.order_items || []).map(function (i) { return esc(i.quantity) + " × " + esc(i.name) + " (" + money(i.unit_price_cents) + ")"; }).join("<br>");
          return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><strong>Commande ' + esc(o.order_number ? "SL-" + o.order_number : o.id.slice(0, 8)) + "</strong><span>" + esc(S.dateFr(o.created_at)) + "</span></div>" +
            "<p><strong>" + esc(o.full_name || "") + "</strong> · " + esc(o.phone || "") + "<br>" + esc(o.address || "").replace(/\n/g, "<br>") + "</p>" +
            (o.note ? '<p style="color:var(--muted)">Note : ' + esc(o.note) + "</p>" : "") + "<p>" + items + "</p>" +
            "<p>Livraison : " + esc(o.shipping_method || "—") + " (" + money(o.shipping_cents || 0) + ")" + (o.relay_point ? " — <strong>Relais : " + esc(o.relay_point) + "</strong>" : "") +
            (o.discount_code ? "<br>Code " + esc(o.discount_code) + " : −" + money(o.discount_cents || 0) : "") + (o.ambassador_code ? "<br>Ambassadeur : <strong>" + esc(o.ambassador_code) + "</strong>" : "") +
            "<br>E-mail : " + esc(o.email || "") + "</p><p><strong>Total : " + money(o.total_cents) + "</strong></p>" +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px"><input data-carrier-for="' + esc(o.id) + '" placeholder="Transporteur (ex. Mondial Relay)" value="' + esc(o.carrier || "") + '"><input data-track-for="' + esc(o.id) + '" placeholder="N° de suivi" value="' + esc(o.tracking_number || "") + '"></div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap"><select data-status-for="' + esc(o.id) + '">' +
            Object.keys(STATUS).map(function (k) { return opt(k, STATUS[k], o.status); }).join("") + '</select>' +
            '<button class="btn small" data-action="save-order" data-id="' + esc(o.id) + '">Enregistrer</button><a class="btn small ghost" href="etiquette.html?o=' + esc(o.id) + '" target="_blank">Carte surprise (QR)</a></div></div>';
        }).join("");
      });
    },

    products: function () {
      return sb.from("products").select("*").order("sort_order").then(function (r) {
        if (r.error) { body().innerHTML = notice("Lecture impossible."); return; }
        var rows = r.data.map(function (p) {
          return '<div class="panel" data-pid="' + esc(p.id) + '"><div class="row2">' +
            '<label>Nom<input data-f="name" value="' + esc(p.name) + '"></label>' +
            '<label>Prix TTC en € (vide = sur demande)<input data-f="price" inputmode="decimal" value="' + (p.price_cents == null ? "" : esc((p.price_cents / 100).toFixed(2))) + '"></label>' +
            '<label>Prix barré en € (ancien prix, facultatif)<input data-f="compare" inputmode="decimal" value="' + (p.compare_price_cents == null ? "" : esc((p.compare_price_cents / 100).toFixed(2))) + '"></label>' +
            '<label>Stock (vide = non suivi)<input data-f="stock" inputmode="numeric" value="' + (p.stock == null ? "" : esc(p.stock)) + '"></label>' +
            '<label>Statut<select data-f="status">' + opt("published", "Publié", p.status) + opt("soon", "Bientôt disponible", p.status) + opt("draft", "Brouillon (masqué)", p.status) + "</select></label>" +
            '<label>Ordre d\'affichage<input data-f="sort" inputmode="numeric" value="' + esc(p.sort_order) + '"></label>' +
            '<label>Type<select data-f="kind">' + opt("product", "Produit", p.kind) + opt("gift_card", "Carte cadeau", p.kind) + "</select></label></div>" +
            '<label>Accroche<input data-f="tagline" value="' + esc(p.tagline || "") + '"></label>' +
            '<div class="photo-box"><strong>Photo principale</strong>' +
            (p.image_url ? '<div><img src="' + esc(S.safeUrl(p.image_url)) + '" alt="" style="max-height:110px;border-radius:10px;margin:6px 0"></div>' : '<p style="margin:4px 0;color:var(--muted);font-size:.85rem">Aucune photo.</p>') +
            '<input type="file" data-photo-file accept="image/jpeg,image/png,image/webp" style="max-width:100%">' +
            '<div style="margin-top:8px"><button class="btn small" type="button" data-action="upload-photo">Envoyer la photo</button></div>' +
            '<p style="color:var(--muted);font-size:.8rem;margin-top:6px">JPG, PNG ou WebP, 5 Mo maximum. Ou collez une adresse ci-dessous.</p>' +
            '<div class="gal-box" data-gallery="' + esc(JSON.stringify(Array.isArray(p.gallery) ? p.gallery : [])) + '" style="margin-top:12px"><strong>Galerie (photos supplémentaires)</strong><div class="gal-list" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">' +
            (Array.isArray(p.gallery) ? p.gallery : []).map(function (g) {
              return '<span style="position:relative;display:inline-block"><img src="' + esc(S.safeUrl(g)) + '" alt="" style="height:64px;border-radius:8px;display:block"><button type="button" class="btn small ghost" data-action="remove-gallery" data-url="' + esc(g) + '" style="position:absolute;top:2px;right:2px;padding:0 7px;min-height:22px" aria-label="Retirer cette photo">×</button></span>';
            }).join("") + '</div>' +
            '<input type="file" data-gallery-file accept="image/jpeg,image/png,image/webp" style="max-width:100%"> ' +
            '<button class="btn small" type="button" data-action="add-gallery">Ajouter à la galerie</button></div></div>' +
            '<label>Adresse de l\'image (https:// ou photos/nom.jpg)<input data-f="image" value="' + esc(p.image_url || "") + '"></label>' +
            '<label>Lien d\'achat externe, ex. annonce Vinted (https://…). S\'il est rempli, le bouton « Acheter » ouvre ce lien au lieu du panier. Vide = panier du site.<input data-f="external" inputmode="url" value="' + esc(p.external_url || "") + '"></label>' +
            '<label>Description<textarea data-f="description" rows="3">' + esc(p.description || "") + "</textarea></label>" +
            '<div class="model-box" data-slug="' + esc(p.slug) + '" data-model="' + esc(p.model_path || "") + '"><strong>Modèle 3D (.stl)</strong>' +
            '<p style="margin:4px 0;color:var(--muted);font-size:.85rem">' + (p.model_path ? "Modèle en ligne : " + esc(p.model_path) : "Aucun modèle : la fiche n'affiche pas d'onglet « Vue 3D ».") + "</p>" +
            '<input type="file" data-model-file accept=".stl" style="max-width:100%">' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><button class="btn small" type="button" data-action="upload-model">Envoyer le modèle</button>' +
            (p.model_path ? '<button class="btn small ghost" type="button" data-action="remove-model">Retirer le modèle</button>' : "") + "</div>" +
            '<p style="color:#8a5a00;font-size:.8rem;margin-top:8px">⚠ Le fichier est public : un visiteur technique peut le télécharger. Envoyez une version allégée / simplifiée pour l\'aperçu (50 Mo max), jamais votre fichier d\'impression d\'origine.</p></div>' +
            '<p style="color:var(--muted);font-size:.8rem">Adresse de la fiche : produit.html?p=' + esc(p.slug) + '</p>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn small" data-action="save-product">Enregistrer</button>' +
            '<button class="btn small ghost" data-action="delete-product">Supprimer</button></div></div>';
        }).join("");
        body().innerHTML = '<div class="panel"><h3>Ajouter un produit</h3><form id="new-product"><div class="row2">' +
          '<label>Nom<input name="name" required></label><label>Adresse courte (ex. mon-produit)<input name="slug" required pattern="[a-z0-9\\-]+"></label>' +
          '<label>Prix TTC en €<input name="price" inputmode="decimal"></label></div>' +
          '<label>Accroche<input name="tagline"></label><label>Description<textarea name="description" rows="3"></textarea></label>' +
          '<button class="btn small" type="submit">Ajouter (en brouillon)</button></form></div>' + rows;
      });
    },

    drop: function () {
      var keys = ["drop_enabled", "drop_lock", "drop_title", "drop_description", "drop_starts_at", "drop_ends_at"];
      return Promise.all([
        sb.from("site_settings").select("key,value").in("key", keys),
        sb.from("products").select("id,name,is_drop,status,price_cents").eq("kind", "product").order("sort_order")
      ]).then(function (res) {
        if (res[0].error || res[1].error) { body().innerHTML = notice("Lecture impossible."); return; }
        var m = {};
        res[0].data.forEach(function (x) { m[x.key] = x.value; });
        function local(iso) {
          if (!iso) return "";
          var d = new Date(iso);
          if (isNaN(d.getTime())) return "";
          var p = function (n) { return n < 10 ? "0" + n : n; };
          return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
        }
        var prods = res[1].data.map(function (p) {
          return '<label class="check"><input type="checkbox" data-drop-product="' + esc(p.id) + '"' + (p.is_drop ? " checked" : "") + "> " + esc(p.name) +
            (p.price_cents == null ? ' <em style="color:#b42318">(pas de prix)</em>' : "") + (p.status !== "published" ? ' <em style="color:var(--muted)">(' + esc(p.status === "soon" ? "bientôt" : "brouillon") + ", non commandable)</em>" : "") + "</label>";
        }).join("");
        body().innerHTML = '<div class="panel"><h3>Page Drop</h3>' +
          '<p style="color:var(--muted)">Quand le drop est désactivé, la page affiche « aucun drop » avec un formulaire d\'alerte, et le lien disparaît du menu. Les produits cochés ne sont commandables que pendant l\'ouverture du drop (vérifié côté serveur).</p>' +
          '<form id="drop-form"><label class="check"><input type="checkbox" name="enabled"' + (m.drop_enabled === "1" ? " checked" : "") + "> <strong>Drop activé</strong> (visible sur le site)</label>" +
          '<label class="check"><input type="checkbox" name="lock"' + (m.drop_lock === "1" ? " checked" : "") + '> <strong>Verrouiller le site avant l\'ouverture</strong> : le public ne voit que le compte à rebours et le formulaire e-mail, seuls les admins peuvent se connecter. Le site s\'ouvre tout seul à l\'heure d\'ouverture (sans heure d\'ouverture, il reste verrouillé tant que vous ne décochez pas).</label>' +
          '<label>Titre<input name="title" maxlength="120" value="' + esc(m.drop_title || "") + '"></label>' +
          '<label>Description<textarea name="description" rows="3" maxlength="400">' + esc(m.drop_description || "") + "</textarea></label>" +
          '<div class="row2"><label>Ouverture (heure de votre appareil, vide = tout de suite)<input type="datetime-local" name="starts" value="' + esc(local(m.drop_starts_at)) + '"></label>' +
          '<label>Fermeture (vide = pas de fin)<input type="datetime-local" name="ends" value="' + esc(local(m.drop_ends_at)) + '"></label></div>' +
          '<div><strong>Produits du drop</strong><div style="display:grid;gap:8px;margin-top:10px">' + (prods || "<em>Aucun produit.</em>") + "</div></div>" +
          '<button class="btn small" type="submit">Enregistrer le drop</button></form></div>';
      });
    },

    messages: function () {
      return sb.from("submissions").select("*").order("created_at", { ascending: false }).limit(200).then(function (r) {
        if (r.error) { body().innerHTML = notice("Lecture impossible."); return; }
        if (!r.data.length) { body().innerHTML = notice("Aucun message pour le moment."); return; }
        var LABEL = { contact: "Contact", ambassadeur: "Ambassadeur", surprise: "Ta surprise", drop: "Alerte drop" };
        body().innerHTML = r.data.map(function (m) {
          var fields = Object.keys(m.payload || {}).map(function (k) { return "<strong>" + esc(k) + " :</strong> " + esc(m.payload[k]); }).join("<br>");
          return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="status">' + esc(LABEL[m.type] || m.type) + "</span><span>" + esc(S.dateFr(m.created_at)) + "</span></div><p>" + fields +
            '</p><button class="btn small ghost" data-action="delete-message" data-id="' + esc(m.id) + '">Supprimer</button></div>';
        }).join("");
      });
    },

    clients: function () {
      return sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(200).then(function (r) {
        if (r.error) { body().innerHTML = notice("Lecture impossible."); return; }
        body().innerHTML = '<table><tr><th>E-mail</th><th>Nom</th><th>Inscrit</th><th>Rôle</th></tr>' + r.data.map(function (p) {
          return "<tr><td>" + esc(p.email || "") + "</td><td>" + esc(p.full_name || "") + "</td><td>" + esc(S.dateFr(p.created_at)) + '</td><td><select data-role-for="' + esc(p.id) + '">' +
            opt("client", "Client", p.role) + opt("admin", "Admin", p.role) + '</select> <button class="btn small ghost" data-action="save-role" data-id="' + esc(p.id) + '">OK</button></td></tr>';
        }).join("") + "</table>";
      });
    },

    shop: function () {
      return Promise.all([
        sb.from("shipping_methods").select("*").order("sort_order"),
        sb.from("discount_codes").select("*").order("created_at", { ascending: false }).limit(200),
        sb.from("orders").select("ambassador_code,subtotal_cents,discount_cents,status").not("ambassador_code", "is", null).in("status", ["paid", "shipped"]),
        sb.from("site_settings").select("value").eq("key", "payment_instructions").maybeSingle(),
        sb.from("site_settings").select("value").eq("key", "payment_card_enabled").maybeSingle()
      ]).then(function (r) {
        r[4] = r[4].data && r[4].data.value;
        var ship = r[0].data || [], codes = r[1].data || [], amb = {};
        (r[2].data || []).forEach(function (o) {
          var a = amb[o.ambassador_code] = amb[o.ambassador_code] || { n: 0, pts: 0 };
          a.n++; a.pts += Math.floor(Math.max(0, o.subtotal_cents - o.discount_cents) / 100 * 10);
        });
        var h = '<div class="panel"><h3>Livraison</h3>' + ship.map(function (m) {
          return '<div data-ship="' + esc(m.id) + '" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px"><label>Nom<input data-s="name" value="' + esc(m.name) + '"></label>' +
            '<label>Prix €<input data-s="price" size="5" value="' + (m.price_cents / 100) + '"></label><label>Offerte dès € (vide = jamais)<input data-s="free" size="5" value="' + (m.free_from_cents == null ? "" : m.free_from_cents / 100) + '"></label>' +
            '<label class="check"><input type="checkbox" data-s="active"' + (m.active ? " checked" : "") + '> Actif</label><button class="btn small" data-action="save-ship">Enregistrer</button></div>';
        }).join("") + '<form id="ship-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px"><label>Nouveau mode<input name="name" required maxlength="80" placeholder="Colissimo domicile"></label><label>Prix €<input name="price" size="5" required></label><label class="check"><input type="checkbox" name="relay"> Point relais</label><button class="btn small" type="submit">Ajouter</button></form></div>';
        h += '<div class="panel"><h3>Codes promo</h3><form id="code-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label>Code<input name="code" required maxlength="30"></label><label>%<input name="percent" size="3" required></label><label>Utilisations max (vide = illimité)<input name="max" size="4"></label><button class="btn small" type="submit">Créer</button></form>' +
          '<table class="table" style="width:100%;margin-top:10px"><tr><th>Code</th><th>%</th><th>Utilisé</th><th></th></tr>' + codes.map(function (c) {
            return "<tr><td>" + esc(c.code) + "</td><td>" + c.percent + "</td><td>" + c.uses + (c.max_uses ? " / " + c.max_uses : "") + '</td><td><button class="btn small ghost" data-action="toggle-code" data-id="' + esc(c.code) + '" data-on="' + (c.active ? 1 : 0) + '">' + (c.active ? "Désactiver" : "Activer") + "</button></td></tr>";
          }).join("") + "</table></div>";
        var ak = Object.keys(amb).sort(function (a, b) { return amb[b].pts - amb[a].pts; });
        h += '<div class="panel"><h3>Points ambassadeurs (10 pts/€, taux de base)</h3>' + (ak.length ? '<table class="table" style="width:100%"><tr><th>Code</th><th>Commandes</th><th>Points</th></tr>' + ak.map(function (k) { return "<tr><td>" + esc(k) + "</td><td>" + amb[k].n + "</td><td>" + amb[k].pts + "</td></tr>"; }).join("") + "</table>" : "<p>Aucun code déclaré pour le moment.</p>") + "</div>";
        h += '<div class="panel"><h3>Instructions de paiement (virement)</h3><form id="pay-form"><label class="check"><input type="checkbox" name="card"' + (r[4] === "1" ? " checked" : "") + '> Activer le paiement par carte (Stripe) — seulement après avoir ajouté les clés dans Supabase</label><label>IBAN / titulaire / consignes (affiché au client après la commande)<textarea name="v" rows="3" maxlength="600">' + esc((r[3].data && r[3].data.value) || "") + '</textarea></label><button class="btn small" type="submit">Enregistrer</button></form></div>';
        body().innerHTML = h;
      });
    },

    settings: function () {
      return sb.from("site_settings").select("*").eq("key", "announcement").maybeSingle().then(function (r) {
        body().innerHTML = '<div class="panel"><h3>Bandeau d\'annonce</h3><p style="color:var(--muted)">Bande verte qui défile tout en haut du site. Séparez les messages par le signe | (ex. : Fabriqué en France | Nouveau drop | Livraison offerte dès 2 articles). Laissez vide pour la masquer.</p>' +
          '<form id="settings-form"><label>Messages<input name="announcement" maxlength="400" value="' + esc((r.data && r.data.value) || "") + '"></label><button class="btn small" type="submit">Enregistrer</button></form></div>';
      });
    }
  };

  function show(t) {
    tab = t;
    root.innerHTML = tabsHtml();
    views[t]().catch(function () { body().innerHTML = notice("Chargement impossible."); });
  }

  function readProduct(panel) {
    function f(n) { return panel.querySelector('[data-f="' + n + '"]'); }
    var price = toCents(f("price").value), stock = toInt(f("stock").value), sort = toInt(f("sort").value);
    if (price === undefined || stock === undefined || sort === undefined) return null;
    var cmp = toCents(f("compare").value);
    if (cmp === undefined) return null;
    var ext = f("external").value.trim();
    if (ext && !/^https:\/\/[^\s<>"]+$/.test(ext)) return null;
    return {
      name: f("name").value.trim(), price_cents: price, stock: stock, sort_order: sort === null ? 0 : sort,
      status: f("status").value, kind: f("kind").value, tagline: f("tagline").value.trim(),
      image_url: f("image").value.trim() || null, description: f("description").value.trim(),
      external_url: ext || null, compare_price_cents: cmp
    };
  }

  root.addEventListener("click", function (e) {
    var a = e.target.closest("[data-action]");
    if (!a) return;
    var act = a.getAttribute("data-action");
    if (act === "save-ship") {
      var row = a.closest("[data-ship]");
      function g(n) { return row.querySelector('[data-s="' + n + '"]'); }
      var pr = toCents(g("price").value), fr = g("free").value.trim() === "" ? null : toCents(g("free").value);
      if (pr == null || fr === undefined) { flash("Prix invalide."); return; }
      sb.from("shipping_methods").update({ name: g("name").value.trim(), price_cents: pr, free_from_cents: fr, active: g("active").checked }).eq("id", row.getAttribute("data-ship")).then(function (x) { flash(x.error ? "Enregistrement impossible." : "Livraison enregistrée.", !x.error); });
    } else if (act === "toggle-code") {
      sb.from("discount_codes").update({ active: a.getAttribute("data-on") !== "1" }).eq("code", a.getAttribute("data-id")).then(function () { show("shop"); });
    }
  });
  root.addEventListener("submit", function (e) {
    if (e.target.id === "code-form") {
      e.preventDefault();
      var f = e.target, p = parseInt(f.percent.value, 10), mx = f.max.value.trim() ? parseInt(f.max.value, 10) : null;
      if (!(p >= 1 && p <= 90)) { flash("Pourcentage entre 1 et 90."); return; }
      sb.from("discount_codes").insert({ code: f.code.value.trim().toUpperCase(), percent: p, max_uses: mx, per_user_once: true }).then(function (x) { if (x.error) flash("Création impossible (code déjà pris ?)."); else { show("shop"); flash("Code créé.", true); } });
    } else if (e.target.id === "ship-form") {
      e.preventDefault();
      var sf = e.target, pc = toCents(sf.price.value);
      if (pc == null) { flash("Prix invalide."); return; }
      sb.from("shipping_methods").insert({ code: sf.name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "mode-" + Date.now(), name: sf.name.value.trim(), price_cents: pc, requires_relay: sf.relay.checked, sort_order: 10 }).then(function (x) { if (x.error) flash("Ajout impossible."); else { show("shop"); flash("Mode ajouté.", true); } });
    } else if (e.target.id === "pay-form") {
      e.preventDefault();
      sb.from("site_settings").upsert([{ key: "payment_instructions", value: e.target.v.value }, { key: "payment_card_enabled", value: e.target.card.checked ? "1" : "0" }]).then(function (x) { flash(x.error ? "Enregistrement impossible." : "Instructions enregistrées.", !x.error); });
    }
  });

  function csvCell(v) { v = v == null ? "" : String(v); return '"' + v.replace(/"/g, '""').replace(/\r?\n/g, " ") + '"'; }
  root.addEventListener("click", function (e) {
    var a = e.target.closest("[data-action]");
    if (!a) return;
    var act = a.getAttribute("data-action"), id = a.getAttribute("data-id");
    function done(r, m) { if (r.error) flash("Impossible : " + r.error.message); else { show("dash"); flash(m, true); } }
    if (act === "mark-paid") sb.from("orders").update({ status: "paid", payment_provider: "virement" }).eq("id", id).then(function (r) { done(r, "Commande marquée payée : le client peut recevoir sa surprise."); });
    else if (act === "mark-cancel") { if (confirm("Annuler cette commande ? Le stock sera remis.")) sb.from("orders").update({ status: "cancelled" }).eq("id", id).then(function (r) { done(r, "Commande annulée."); }); }
    else if (act === "mark-shipped") {
      var c = root.querySelector('[data-d-carrier="' + id + '"]').value.trim() || null, t = root.querySelector('[data-d-track="' + id + '"]').value.trim() || null;
      sb.from("orders").update({ status: "shipped", carrier: c, tracking_number: t }).eq("id", id).then(function (r) { done(r, "Commande expédiée."); });
    } else if (act === "export-csv") {
      var rows = [["Numéro", "Date", "Statut", "Nom", "E-mail", "Téléphone", "Adresse", "Livraison", "Point relais", "Transporteur", "Suivi", "Sous-total €", "Réduction €", "Code", "Port €", "Total €", "Ambassadeur"]];
      (window.__orders || []).forEach(function (x) {
        rows.push(["SL-" + x.order_number, x.created_at, x.status, x.full_name, x.email, x.phone, x.address, x.shipping_method, x.relay_point, x.carrier, x.tracking_number,
          (x.subtotal_cents || 0) / 100, (x.discount_cents || 0) / 100, x.discount_code, (x.shipping_cents || 0) / 100, x.total_cents / 100, x.ambassador_code].map(csvCell));
      });
      var blob = new Blob(["﻿" + rows.map(function (r) { return r.join(";"); }).join("\r\n")], { type: "text/csv;charset=utf-8" });
      var l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = "commandes-sendlabs.csv"; document.body.appendChild(l); l.click(); l.remove();
    }
  });

  function bind() {
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-tab]");
      if (t) { if (t.getAttribute("data-tab") === "stock") { location.href = "stock.html"; return; } show(t.getAttribute("data-tab")); return; }
      var a = e.target.closest("[data-action]");
      if (!a) return;
      var act = a.getAttribute("data-action"), id = a.getAttribute("data-id");

      if (act === "save-order") {
        var st = root.querySelector('[data-status-for="' + id + '"]').value;
        var car = root.querySelector('[data-carrier-for="' + id + '"]').value.trim() || null, trk = root.querySelector('[data-track-for="' + id + '"]').value.trim() || null;
        sb.from("orders").update({ status: st, carrier: car, tracking_number: trk }).eq("id", id).then(function (r) { flash(r.error ? "Mise à jour impossible : " + r.error.message : "Commande enregistrée.", !r.error); });
      } else if (act === "save-product") {
        var panel = a.closest("[data-pid]"), data = readProduct(panel);
        if (!data || !data.name) { flash("Vérifiez les champs (nom, prix, stock, ordre, lien d'achat en https://)."); return; }
        sb.from("products").update(data).eq("id", panel.getAttribute("data-pid")).then(function (r) { flash(r.error ? "Enregistrement impossible." : "Produit enregistré.", !r.error); });
      } else if (act === "upload-photo") {
        var pbox = a.closest(".photo-box"), ppid = a.closest("[data-pid]").getAttribute("data-pid");
        var img = pbox.querySelector("[data-photo-file]").files[0];
        var slug = a.closest("[data-pid]").querySelector("[data-slug]").getAttribute("data-slug").toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!img) { flash("Choisissez d'abord une image."); return; }
        var ext2 = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[img.type];
        if (!ext2) { flash("Format accepté : JPG, PNG ou WebP."); return; }
        if (img.size > 5 * 1024 * 1024) { flash("Image trop lourde (5 Mo maximum)."); return; }
        var ipath = slug + "-" + Date.now() + "." + ext2;
        a.disabled = true; flash("Envoi en cours…", true);
        sb.storage.from("product-images").upload(ipath, img, { contentType: img.type, upsert: false }).then(function (up) {
          if (up.error) { a.disabled = false; flash("Envoi impossible."); return; }
          var pub = sb.storage.from("product-images").getPublicUrl(ipath).data.publicUrl;
          return sb.from("products").update({ image_url: pub }).eq("id", ppid).then(function (r) {
            if (r.error) { a.disabled = false; flash("Enregistrement impossible."); return; }
            show("products"); flash("Photo enregistrée.", true);
          });
        });
      } else if (act === "add-gallery" || act === "remove-gallery") {
        var panel = a.closest("[data-pid]"), gid = panel.getAttribute("data-pid");
        var cur = [];
        try { cur = JSON.parse(panel.querySelector(".gal-box").getAttribute("data-gallery") || "[]"); } catch (e) { cur = []; }
        if (act === "remove-gallery") {
          var u0 = a.getAttribute("data-url");
          sb.from("products").update({ gallery: cur.filter(function (x) { return x !== u0; }) }).eq("id", gid).then(function (r) {
            if (r.error) { flash("Retrait impossible."); return; }
            show("products"); flash("Photo retirée de la galerie.", true);
          });
          return;
        }
        var gimg = panel.querySelector("[data-gallery-file]").files[0];
        var gslug = panel.querySelector("[data-slug]").getAttribute("data-slug").toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!gimg) { flash("Choisissez d'abord une image."); return; }
        var gext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[gimg.type];
        if (!gext) { flash("Format accepté : JPG, PNG ou WebP."); return; }
        if (gimg.size > 5 * 1024 * 1024) { flash("Image trop lourde (5 Mo maximum)."); return; }
        if (cur.length >= 12) { flash("12 photos maximum dans la galerie."); return; }
        var gpath = gslug + "-g" + Date.now() + "." + gext;
        a.disabled = true; flash("Envoi en cours…", true);
        sb.storage.from("product-images").upload(gpath, gimg, { contentType: gimg.type, upsert: false }).then(function (up) {
          if (up.error) { a.disabled = false; flash("Envoi impossible."); return; }
          var gpub = sb.storage.from("product-images").getPublicUrl(gpath).data.publicUrl;
          return sb.from("products").update({ gallery: cur.concat([gpub]) }).eq("id", gid).then(function (r) {
            if (r.error) { a.disabled = false; flash("Enregistrement impossible."); return; }
            show("products"); flash("Photo ajoutée à la galerie.", true);
          });
        });
      } else if (act === "upload-model" || act === "remove-model") {
        var box = a.closest(".model-box"), pid = a.closest("[data-pid]").getAttribute("data-pid");
        var oldPath = box.getAttribute("data-model");
        function dropOld() { if (oldPath) return sb.storage.from("models").remove([oldPath]); return Promise.resolve(); }
        if (act === "remove-model") {
          if (!confirm("Retirer le modèle 3D de cette fiche ?")) return;
          sb.from("products").update({ model_path: null }).eq("id", pid).then(function (r) {
            if (r.error) { flash("Retrait impossible."); return; }
            return dropOld().then(function () { show("products"); });
          });
          return;
        }
        var file = box.querySelector("[data-model-file]").files[0];
        if (!file) { flash("Choisissez d'abord un fichier .stl."); return; }
        if (!/\.stl$/i.test(file.name)) { flash("Le fichier doit être au format .stl."); return; }
        if (file.size > 50 * 1024 * 1024) { flash("Fichier trop lourd (50 Mo maximum). Allégez-le avant l'envoi."); return; }
        var newPath = box.getAttribute("data-slug").toLowerCase().replace(/[^a-z0-9-]/g, "") + "-" + Date.now() + ".stl";
        a.disabled = true; flash("Envoi en cours…", true);
        sb.storage.from("models").upload(newPath, file, { contentType: "model/stl", upsert: false }).then(function (up) {
          if (up.error) { a.disabled = false; flash("Envoi impossible."); return; }
          return sb.from("products").update({ model_path: newPath }).eq("id", pid).then(function (r) {
            if (r.error) { a.disabled = false; sb.storage.from("models").remove([newPath]); flash("Enregistrement impossible."); return; }
            return dropOld().then(function () { show("products"); flash("Modèle 3D en ligne.", true); });
          });
        });
      } else if (act === "delete-product") {
        if (!confirm("Supprimer ce produit ? Les commandes passées gardent leur historique.")) return;
        sb.from("products").delete().eq("id", a.closest("[data-pid]").getAttribute("data-pid")).then(function (r) {
          if (r.error) flash("Suppression impossible."); else show("products");
        });
      } else if (act === "delete-message") {
        sb.from("submissions").delete().eq("id", id).then(function (r) { if (r.error) flash("Suppression impossible."); else show("messages"); });
      } else if (act === "save-role") {
        var role = root.querySelector('[data-role-for="' + id + '"]').value;
        sb.from("profiles").update({ role: role }).eq("id", id).then(function (r) { flash(r.error ? "Changement de rôle impossible." : "Rôle enregistré.", !r.error); });
      }
    });

    root.addEventListener("submit", function (e) {
      e.preventDefault();
      if (e.target.id === "new-product") {
        var fd = new FormData(e.target), price = toCents(fd.get("price"));
        if (price === undefined) { flash("Prix invalide."); return; }
        sb.from("products").insert({
          name: String(fd.get("name")).trim(), slug: String(fd.get("slug")).trim(), price_cents: price,
          tagline: String(fd.get("tagline") || "").trim(), description: String(fd.get("description") || "").trim(), status: "draft", kind: "product", sort_order: 50
        }).then(function (r) {
          if (r.error) flash("Ajout impossible (adresse courte déjà utilisée ?)."); else show("products");
        });
      } else if (e.target.id === "drop-form") {
        var df = e.target, dd = new FormData(df);
        var starts = dd.get("starts") ? new Date(dd.get("starts")) : null, ends = dd.get("ends") ? new Date(dd.get("ends")) : null;
        if (starts && isNaN(starts.getTime()) || ends && isNaN(ends.getTime())) { flash("Dates invalides."); return; }
        if (starts && ends && ends <= starts) { flash("La fermeture doit être après l'ouverture."); return; }
        var rows = [
          { key: "drop_enabled", value: dd.get("enabled") ? "1" : "0" },
          { key: "drop_lock", value: dd.get("lock") ? "1" : "0" },
          { key: "drop_title", value: String(dd.get("title") || "").trim() },
          { key: "drop_description", value: String(dd.get("description") || "").trim() },
          { key: "drop_starts_at", value: starts ? starts.toISOString() : "" },
          { key: "drop_ends_at", value: ends ? ends.toISOString() : "" }
        ];
        var checks = df.querySelectorAll("[data-drop-product]");
        sb.from("site_settings").upsert(rows).then(function (r) {
          if (r.error) { flash("Enregistrement impossible."); return; }
          return Promise.all(Array.prototype.map.call(checks, function (c) {
            return sb.from("products").update({ is_drop: c.checked }).eq("id", c.getAttribute("data-drop-product"));
          })).then(function (all) {
            var bad = all.filter(function (x) { return x.error; }).length;
            flash(bad ? "Drop enregistré, mais " + bad + " produit(s) n'ont pas pu être mis à jour." : "Drop enregistré.", !bad);
          });
        });
      } else if (e.target.id === "settings-form") {
        var v = String(new FormData(e.target).get("announcement")).trim();
        sb.from("site_settings").upsert({ key: "announcement", value: v }).then(function (r) { flash(r.error ? "Enregistrement impossible." : "Bandeau enregistré.", !r.error); });
      }
    });
  }

  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (!s) { location.replace("connexion.html?next=admin.html"); return; }
    return sb.from("profiles").select("role").eq("id", s.user.id).maybeSingle().then(function (p) {
      if (!p.data || p.data.role !== "admin") { root.innerHTML = notice("Accès réservé aux administrateurs."); return; }
      bind();
      show("orders");
    });
  }).catch(function () { root.innerHTML = notice("Chargement impossible."); });
})();
