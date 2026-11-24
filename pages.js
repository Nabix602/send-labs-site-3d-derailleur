/* Logique des pages : accueil, boutique, produit, panier, connexion, compte */
(function () {
  var S = window.SLapp, sb = S.sb, esc = S.esc, money = S.money;
  var page = document.body.getAttribute("data-page");
  var STATUS = { pending: "En attente de paiement", paid: "Payée", shipped: "Expédiée", cancelled: "Annulée" };

  function qs(k) { return new URLSearchParams(location.search).get(k); }
  function view() { return document.getElementById("view"); }
  function notice(msg, cls) { return '<div class="' + (cls || "notice") + '">' + esc(msg) + "</div>"; }
  function session() { return sb.auth.getSession().then(function (r) { return r.data && r.data.session; }); }
  function safeNext(n) { return /^[a-z0-9\-]+\.html$/.test(n || "") ? n : "compte.html"; }

  function ordersHtml(orders) {
    if (!orders.length) return notice("Aucune commande pour le moment.");
    return orders.map(function (o) {
      var items = (o.order_items || []).map(function (i) {
        return esc(i.quantity) + " × " + esc(i.name) + " (" + money(i.unit_price_cents) + ")";
      }).join("<br>");
      return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><strong>Commande ' + esc(o.order_number ? "SL-" + o.order_number : o.id.slice(0, 8)) +
        '</strong><span class="status">' + esc(STATUS[o.status] || o.status) + "</span></div>" +
        '<p style="color:var(--muted);font-size:.85rem">' + esc(S.dateFr(o.created_at)) + "</p><p>" + items + "</p>" +
        (o.discount_cents ? "<p>Réduction " + esc(o.discount_code || "") + " : −" + money(o.discount_cents) + "</p>" : "") +
        (o.shipping_method ? "<p>Livraison : " + (o.shipping_cents ? money(o.shipping_cents) : "offerte") + (o.relay_point ? " — relais : " + esc(o.relay_point) : "") + "</p>" : "") +
        (o.tracking_number ? "<p>Suivi " + esc(o.carrier || "") + " : <strong>" + esc(o.tracking_number) + "</strong></p>" : "") +
        '<p><strong>Total : ' + money(o.total_cents) + "</strong></p></div>";
    }).join("");
  }

  // Onglets Photo / Vue 3D : la visionneuse (three.js) n'est chargée qu'au premier clic sur « Vue 3D ».
  function setup3d(path) {
    var photo = document.querySelector(".photo-wrap") || document.getElementById("media-photo"), box = document.getElementById("media-3d");
    var tabs = document.querySelectorAll("[data-media]");
    if (!photo || !box) return;
    var state = "idle", api = null;
    function note(html) { box.innerHTML = '<div class="viewer-msg">' + html + "</div>"; }
    function load() {
      if (state !== "idle") return;
      state = "loading";
      note("Chargement du modèle 3D…");
      var url = (window.SL.supabaseUrl || "") + "/storage/v1/object/public/models/" + encodeURIComponent(path);
      import("./viewer.js").then(function (m) {
        box.innerHTML = "";
        return m.mountViewer(box, url);
      }).then(function (v) {
        api = v; state = "ready";
        var hint = document.createElement("div");
        hint.className = "viewer-hint";
        hint.textContent = "Glissez pour tourner · pincez ou molette pour zoomer";
        var reset = document.createElement("button");
        reset.type = "button"; reset.className = "viewer-reset"; reset.textContent = "Recentrer";
        reset.addEventListener("click", function () { api.reset(); });
        box.appendChild(hint); box.appendChild(reset);
        var bar = document.createElement("div");
        bar.className = "viewer-tools";
        [["Noir", 0x1f2430], ["Gris", 0x8a8f98], ["Vert", 0xb9f000], ["Blanc", 0xf2f2f2]].forEach(function (c, i) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "swatch" + (i === 0 ? " on" : ""); b.title = c[0] + " (aperçu)";
          b.setAttribute("aria-label", "Aperçu couleur " + c[0]);
          b.style.background = "#" + ("000000" + c[1].toString(16)).slice(-6);
          b.addEventListener("click", function () {
            api.setColor(c[1]);
            Array.prototype.forEach.call(bar.querySelectorAll(".swatch"), function (x) { x.classList.toggle("on", x === b); });
          });
          bar.appendChild(b);
        });
        var wf = document.createElement("button");
        wf.type = "button"; wf.className = "tool"; wf.textContent = "Maillage";
        var wfOn = false;
        wf.addEventListener("click", function () { wfOn = !wfOn; api.wireframe(wfOn); wf.classList.toggle("on", wfOn); });
        bar.appendChild(wf);
        if (box.requestFullscreen) {
          var fs = document.createElement("button");
          fs.type = "button"; fs.className = "tool"; fs.textContent = "Plein écran";
          fs.addEventListener("click", function () { if (document.fullscreenElement) document.exitFullscreen(); else box.requestFullscreen(); });
          bar.appendChild(fs);
        }
        box.appendChild(bar);
        box.addEventListener("pointerdown", function () { hint.style.opacity = "0"; }, { once: true });
      }).catch(function (e) {
        state = "error";
        note(e && e.message === "webgl" ? "Votre navigateur ne permet pas l'affichage 3D." : "Le modèle 3D n'a pas pu être chargé.");
      });
    }
    Array.prototype.forEach.call(tabs, function (b) {
      b.addEventListener("click", function () {
        var is3d = b.getAttribute("data-media") === "3d";
        Array.prototype.forEach.call(tabs, function (x) { x.classList.toggle("on", x === b); });
        photo.hidden = is3d; box.hidden = !is3d;
        if (is3d) load();
      });
    });
  }

  var pages = {
    home: function () {
      return Promise.all([S.loadProducts(), S.loadDrop()]).then(function (res) {
        var list = res[0], drop = res[1];
        var cage = list.filter(function (p) { return p.slug === "send-cage"; })[0];
        if (cage && cage.price_cents != null) document.getElementById("cage-price").textContent = money(cage.price_cents);
        document.getElementById("range").innerHTML = list.filter(function (p) { return p.kind === "product" && p.slug !== "send-cage" && !p.is_drop; }).map(S.productCard).join("");
        document.getElementById("gifts").innerHTML = list.filter(function (p) { return p.kind === "gift_card"; }).map(S.giftCard).join("");
        var banner = document.getElementById("drop-banner");
        if (banner && drop.enabled) {
          var when = drop.upcoming && drop.start ? "Ouverture le " + drop.start.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "En cours";
          banner.innerHTML = '<div class="drop-banner"><div><span class="badge">Drop</span><strong>' + esc(drop.title) + "</strong><span>" + esc(when) +
            '</span></div><a class="btn small" href="drop.html">' + (drop.live ? "Voir le drop" : "Voir les détails") + "</a></div>";
        }
      });
    },

    shop: function () {
      return S.loadProducts().then(function (list) {
        document.getElementById("products").innerHTML = list.filter(function (p) { return p.kind === "product" && !p.is_drop; }).map(S.productCard).join("");
        document.getElementById("gifts").innerHTML = list.filter(function (p) { return p.kind === "gift_card"; }).map(S.giftCard).join("");
      });
    },

    drop: function () {
      return Promise.all([S.loadDrop(), S.loadProducts()]).then(function (res) {
        var d = res[0], items = res[1].filter(function (p) { return p.is_drop && p.status !== "draft"; });
        var v = view();
        if (!d.enabled) {
          v.innerHTML = notice("Aucun drop en cours pour le moment.") +
            '<h2 style="margin-top:40px">Être prévenu du prochain drop</h2>' +
            '<form data-submit="drop" data-success="C\'est noté ! Tu seras prévenu du prochain drop.">' +
            '<p hidden><label>Ne pas remplir <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>' +
            '<label>E-mail<input type="email" name="email" required maxlength="200"></label>' +
            '<label class="check"><input type="checkbox" name="consentement" value="oui" required> J\'accepte d\'être contacté pour le prochain drop (<a href="confidentialite.html" style="text-decoration:underline">confidentialité</a>).</label>' +
            '<button class="btn" type="submit">Me prévenir</button></form>';
          return;
        }
        var html = '<span class="eyebrow">Série limitée</span><h2>' + esc(d.title) + "</h2>";
        if (d.description) html += '<p style="text-align:center;color:var(--muted);max-width:600px;margin:-8px auto 24px">' + esc(d.description) + "</p>";
        if (d.upcoming && d.start) {
          html += '<div class="countdown" id="cd" aria-live="polite"></div>' +
            '<p style="text-align:center;color:var(--muted)">Ouverture le ' + esc(d.start.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })) + "</p>";
        } else if (d.end) {
          html += '<p style="text-align:center;color:var(--muted)">Disponible jusqu\'au ' + esc(d.end.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })) + "</p>";
        }
        html += items.length ? '<div class="grid drop-grid" style="margin-top:26px">' + items.map(function (p) { return S.dropCard(p, d.live); }).join("") + "</div>"
          : notice("Les produits du drop seront dévoilés très bientôt.");
        if (d.upcoming) {
          html += '<h2 style="margin-top:50px">Être prévenu à l\'ouverture</h2>' +
            '<form data-submit="drop" data-success="C\'est noté ! Tu seras prévenu à l\'ouverture du drop.">' +
            '<p hidden><label>Ne pas remplir <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>' +
            '<label>E-mail<input type="email" name="email" required maxlength="200"></label>' +
            '<label class="check"><input type="checkbox" name="consentement" value="oui" required> J\'accepte d\'être contacté pour ce drop (<a href="confidentialite.html" style="text-decoration:underline">confidentialité</a>).</label>' +
            '<button class="btn" type="submit">Me prévenir</button></form>';
        }
        v.innerHTML = html;

        var cd = document.getElementById("cd");
        if (cd && d.start) {
          var tick = function () {
            var ms = d.start - new Date();
            if (ms <= 0) { location.reload(); return; }
            var s = Math.floor(ms / 1000), days = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
            function box(n, l) { return '<div><strong>' + (n < 10 ? "0" + n : n) + "</strong><span>" + l + "</span></div>"; }
            cd.innerHTML = box(days, "jours") + box(h, "heures") + box(m, "min") + box(sec, "sec");
          };
          tick();
          setInterval(tick, 1000);
        }
      });
    },

    product: function () {
      return Promise.all([S.loadProducts(), S.loadDrop()]).then(function (res) {
        var list = res[0], drop = res[1];
        var slug = qs("p");
        var p = list.filter(function (x) { return x.slug === slug; })[0] || list.filter(function (x) { return x.kind === "product"; })[0];
        if (!p) { view().innerHTML = notice("Produit introuvable."); return; }
        document.title = p.name + " – SendLabs";
        var u = S.safeUrl(p.image_url);
        var ext = p.status === "published" ? S.extUrl(p.external_url) : "";
        var buy = (p.is_drop && !drop.live)
          ? '<a class="btn" href="drop.html">Voir le drop</a>'
          : ext ? S.extBtn(ext)
          : S.soldOut(p) ? '<button class="btn" disabled>Épuisé</button>'
          : (p.status === "soon" || p.price_cents == null)
            ? '<a class="btn" href="contact.html">Être prévenu</a>'
            : '<button class="btn" data-add="' + esc(p.id) + '">Ajouter au panier</button>';
        var mp = typeof p.model_path === "string" && /^[a-z0-9._-]+\.stl$/i.test(p.model_path) ? p.model_path : null;
        var imgs = (u ? [u] : []).concat((Array.isArray(p.gallery) ? p.gallery : []).map(S.safeUrl).filter(Boolean));
        var media = '<div class="photo-wrap"><div class="img" id="media-photo">' + (u ? '<img id="main-img" src="' + esc(u) + '" alt="' + esc(p.name) + '">' : esc(p.name.charAt(0))) + "</div>" +
          (imgs.length > 1 ? '<div class="thumbs">' + imgs.map(function (src, i) {
            return '<button type="button" class="thumb' + (i === 0 ? " on" : "") + '" data-thumb="' + esc(src) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>';
          }).join("") + "</div>" : "") + "</div>";
        if (mp) {
          media = '<div class="media">' +
            '<div class="media-tabs"><button type="button" class="on" data-media="photo">Photo</button><button type="button" data-media="3d">Vue 3D</button></div>' +
            media + '<div class="img viewer" id="media-3d" hidden></div></div>';
        }
        view().innerHTML = '<div class="product-hero">' + media +
          "<div>" + (p.status === "soon" ? '<span class="badge">Bientôt disponible</span>' : "") +
          "<h1>" + esc(p.name) + '</h1><p class="tag">' + esc(p.tagline || "") + '</p><p class="desc">' + esc(p.description || "") + "</p>" +
          '<div class="pr">' + (p.price_cents != null ? money(p.price_cents) + ' <small style="font-weight:500;color:var(--muted)">TTC</small> ' + S.priceHtml(p) : "Prix à venir") + "</div>" + buy + "</div></div>";
        Array.prototype.forEach.call(document.querySelectorAll("[data-thumb]"), function (b) {
          b.addEventListener("click", function () {
            var m = document.getElementById("main-img");
            if (m) m.src = b.getAttribute("data-thumb");
            Array.prototype.forEach.call(document.querySelectorAll("[data-thumb]"), function (x) { x.classList.toggle("on", x === b); });
          });
        });
        if (mp) setup3d(mp);
      });
    },

    cart: function () {
      return Promise.all([S.loadProducts(), S.loadDrop()]).then(function (res) {
        var list = res[0], drop = res[1];
        var map = {};
        list.forEach(function (p) { map[p.id] = p; });
        var ship = [], payInfo = "", code = "", cardOn = false;
        try { code = localStorage.getItem("sl_code") || ""; } catch (e) {}

        function lines() {
          var c = S.readCart().filter(function (i) {
            var p = map[i.id];
            return p && p.price_cents != null && p.status === "published" && (!p.is_drop || drop.live);
          });
          c.forEach(function (i) { i.price = map[i.id].price_cents; i.name = map[i.id].name; });
          S.writeCart(c);
          return c;
        }
        function items() { return lines().map(function (i) { return { product_id: i.id, quantity: i.qty }; }); }
        function onlyGift() { return lines().every(function (i) { return map[i.id].kind === "gift_card"; }); }
        function val(n) { var el = document.querySelector('#checkout [name="' + n + '"]'); return el ? el.value : ""; }
        function chosen() { var r = document.querySelector('#checkout input[name="ship"]:checked'); return r ? r.value : null; }

        function recap() {
          var box = document.getElementById("recap"), err = document.getElementById("code-msg");
          if (!box) return Promise.resolve();
          var sh = onlyGift() ? null : chosen();
          return sb.rpc("quote_order", { p_items: items(), p_shipping: sh, p_code: code || null }).then(function (r) {
            if (r.error && code) {
              err.textContent = r.error.message; err.className = "form-error";
              code = ""; try { localStorage.removeItem("sl_code"); } catch (e) {}
              return recap();
            }
            if (r.error) { box.innerHTML = notice(r.error.message); return; }
            var q = r.data;
            err.textContent = q.discount_code ? "Code " + q.discount_code + " appliqué." : ""; err.className = q.discount_code ? "ok" : "";
            box.innerHTML = '<div class="total-row"><span>Sous-total</span><span>' + money(q.subtotal) + "</span></div>" +
              (q.discount ? '<div class="total-row"><span>Réduction ' + esc(q.discount_code) + "</span><span>−" + money(q.discount) + "</span></div>" : "") +
              (q.only_gift ? "" : '<div class="total-row"><span>Livraison</span><span>' + (q.shipping_method ? (q.shipping ? money(q.shipping) : "Offerte") : "—") + "</span></div>") +
              '<div class="total-row"><strong>Total TTC</strong><strong>' + money(q.total) + "</strong></div>";
            var rel = document.getElementById("relay-box");
            if (rel) rel.hidden = !q.requires_relay;
          });
        }

        function draw() {
          var c = lines();
          if (!c.length) {
            view().innerHTML = '<div class="empty-cart"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><h2 style="font-size:1.2rem;font-weight:500">Votre panier est vide.</h2><p>Il semble que vous n\'ayez encore rien ajouté à votre panier.</p><p style="margin-top:18px"><a class="btn" href="boutique.html">Continuer les achats</a></p></div>';
            return Promise.resolve();
          }
          var html = c.map(function (i) {
            return '<div class="cart-line"><div><strong>' + esc(i.name) + '</strong><div style="color:var(--muted);font-size:.85rem">' + money(i.price) + '</div></div>' +
              '<div class="qty"><button type="button" data-q="' + esc(i.id) + '" data-d="-1" aria-label="Moins">−</button><span>' + i.qty + '</span><button type="button" data-q="' + esc(i.id) + '" data-d="1" aria-label="Plus">+</button></div>' +
              "<strong>" + money(i.price * i.qty) + '</strong><button type="button" class="btn small ghost" data-rm="' + esc(i.id) + '">Retirer</button></div>';
          }).join("");
          return session().then(function (s) {
            if (!s) {
              html += notice("Connecte-toi ou crée un compte pour finaliser ta commande.") +
                '<p style="text-align:center;margin-top:16px"><a class="btn" href="connexion.html?next=panier.html">Se connecter pour commander</a></p>';
              view().innerHTML = html;
              return;
            }
            return Promise.all([
              sb.from("profiles").select("full_name").eq("id", s.user.id).maybeSingle(),
              sb.from("shipping_methods").select("*").eq("active", true).order("sort_order"),
              sb.from("site_settings").select("key,value").in("key", ["payment_instructions", "payment_card_enabled"])
            ]).then(function (r) {
              ship = r[1].data || []; (r[2].data || []).forEach(function (x) { if (x.key === "payment_instructions") payInfo = x.value || ""; if (x.key === "payment_card_enabled") cardOn = x.value === "1"; });
              var gift = onlyGift();
              html = '<form id="checkout" class="co-grid"><div class="co-main">' + html + '<h2 style="text-align:left;font-size:1.3rem;margin-top:26px">Livraison</h2>' +
                '<label>Nom complet<input name="full_name" required maxlength="120" value="' + esc((r[0].data && r[0].data.full_name) || "") + '"></label>' +
                '<label>Téléphone<input name="phone" maxlength="30" inputmode="tel"></label>' +
                '<label>' + (gift ? "Adresse (facturation)" : "Adresse de livraison") + '<textarea name="address" rows="3" required maxlength="400"></textarea></label>';
              if (!gift) {
                html += ship.map(function (m, k) {
                  return '<label class="check"><input type="radio" name="ship" value="' + esc(m.code) + '"' + (k === 0 ? " checked" : "") + "> <span><strong>" + esc(m.name) + "</strong> — " +
                    (m.price_cents ? money(m.price_cents) : "offerte") + (m.free_from_cents ? " (offerte dès " + money(m.free_from_cents) + ")" : "") +
                    '<br><small style="color:var(--muted)">' + esc(m.description || "") + "</small></span></label>";
                }).join("") +
                '<div id="relay-box"><label>Ton point relais<input name="relay" maxlength="200" placeholder="Nom du point, adresse, ville (ou n° du relais)"></label>' +
                '<small style="color:var(--muted)">Cherche le point le plus proche sur <a href="https://www.mondialrelay.fr/" target="_blank" rel="noopener" style="text-decoration:underline">mondialrelay.fr</a> et recopie son nom et son adresse.</small></div>';
              }
              html += '<label>Note pour l\'atelier (facultatif)<textarea name="note" rows="2" maxlength="400"></textarea></label></div>' +
                '<aside class="co-side panel"><h3>Récapitulatif</h3>' +
                '<label>Code promo<span style="display:flex;gap:8px"><input name="code" maxlength="30" value="' + esc(code) + '" style="text-transform:uppercase"><button class="btn small ghost" type="button" id="apply-code">Appliquer</button></span></label><div id="code-msg"></div>' +
                '<div id="recap" style="margin:10px 0"></div><h3>Comment tu paies</h3>' +
                '<label class="pay-opt"><input type="radio" name="pay" value="virement"' + (cardOn ? '' : ' checked') + '> <span><strong>Virement bancaire</strong><br><small style="color:var(--muted)">Coordonnées affichées après la commande. Expédition dès réception.</small></span></label>' +
                (cardOn ? '<label class="pay-opt"><input type="radio" name="pay" value="card" checked> <span><strong>Carte bancaire</strong><br><small style="color:var(--muted)">Paiement sécurisé par Stripe.</small></span></label>' : '<div class="pay-opt off"><input type="radio" disabled> <span><strong>Carte bancaire</strong> <small>(bientôt)</small></span></div>') +
                (payInfo ? '<p style="font-size:.85rem;color:var(--muted)">' + esc(payInfo).replace(/\n/g, "<br>") + "</p>" : "") +
                '<button class="btn" type="submit" style="width:100%">Valider la commande</button><div class="form-error" id="co-err"></div>' +
                '<p style="font-size:.8rem;color:var(--muted)">Un numéro de commande et un suivi te sont donnés dans ton espace client.</p></aside></form>';
              view().innerHTML = html;
              return recap();
            });
          });
        }

        view().addEventListener("click", function (e) {
          if (e.target.id === "apply-code") {
            code = val("code").trim().toUpperCase();
            try { code ? localStorage.setItem("sl_code", code) : localStorage.removeItem("sl_code"); } catch (er) {}
            recap(); return;
          }
          var q = e.target.closest("[data-q]"), rm = e.target.closest("[data-rm]");
          if (!q && !rm) return;
          var c = S.readCart().slice();
          if (q) {
            var l = c.filter(function (i) { return i.id === q.getAttribute("data-q"); })[0];
            if (l) l.qty = Math.max(1, Math.min(20, l.qty + parseInt(q.getAttribute("data-d"), 10)));
          } else {
            c = c.filter(function (i) { return i.id !== rm.getAttribute("data-rm"); });
          }
          S.writeCart(c);
          draw();
        });
        view().addEventListener("change", function (e) { if (e.target.name === "ship") recap(); });

        view().addEventListener("submit", function (e) {
          if (e.target.id !== "checkout") return;
          e.preventDefault();
          var f = e.target, fd = new FormData(f), btn = f.querySelector("button[type=submit]"), err = document.getElementById("co-err");
          var gift = onlyGift();
          if (!gift && (document.getElementById("relay-box") || {}).hidden === false && !String(fd.get("relay") || "").trim()) {
            err.textContent = "Indique ton point relais."; return;
          }
          btn.disabled = true;
          sb.rpc("place_order", {
            p_items: items(), p_full_name: fd.get("full_name"), p_phone: fd.get("phone"),
            p_address: fd.get("address"), p_note: fd.get("note"),
            p_shipping: gift ? null : chosen(), p_relay: gift ? null : (fd.get("relay") || null), p_code: code || null
          }).then(function (r) {
            if (r.error) { btn.disabled = false; err.textContent = "Commande impossible : " + r.error.message; return; }
            S.writeCart([]);
            try { localStorage.removeItem("sl_code"); } catch (er) {}
            if (fd.get("pay") === "card") {
              view().innerHTML = notice("Redirection vers le paiement sécurisé…");
              return sb.functions.invoke("create-checkout", { body: { order_id: r.data } }).then(function (c) {
                if (c.data && c.data.url) { location.href = c.data.url; return; }
                view().innerHTML = '<div class="ok">Ta commande est enregistrée mais le paiement par carte n\'a pas pu démarrer. Tu peux la régler par virement depuis ton espace client, ou nous écrire.</div><p style="text-align:center;margin-top:20px"><a class="btn" href="compte.html">Voir mes commandes</a></p>';
              });
            }
            sb.from("orders").select("order_number,total_cents").eq("id", r.data).maybeSingle().then(function (o) {
            var num = o.data ? "SL-" + o.data.order_number : String(r.data).slice(0, 8);
            view().innerHTML = '<div class="ok"><strong>Commande enregistrée : ' + esc(num) + (o.data ? " — " + money(o.data.total_cents) : "") + '.</strong><br>' +
              "Règle le montant par virement en indiquant ce numéro en référence." + (payInfo ? "<br><br>" + esc(payInfo).replace(/\n/g, "<br>") : "<br>Les coordonnées bancaires te sont envoyées par l'atelier.") +
              "<br><br>Suis ta commande dans ton espace client.</div>" +
              '<p style="text-align:center;margin-top:20px"><a class="btn" href="compte.html">Voir mes commandes</a></p>';
            });
          });
        });

        return draw();
      });
    },

    surprise: function () {
      var token = (qs("c") || "").toLowerCase(), valid = /^[a-f0-9]{16}$/.test(token);
      var gift = document.getElementById("gift"), amb = document.getElementById("amb");
      function giftHtml(code, note) {
        return '<div class="panel" style="text-align:center;border:2px dashed #B9F000;background:#fff;color:#0F1115"><p>Ton code cadeau</p>' +
          '<p style="font-size:2.4rem;font-weight:900;letter-spacing:.06em;margin:6px 0">' + esc(code) + "</p><p><strong>−10 % sur ta prochaine commande</strong></p>" +
          "<p><small>" + esc(note) + '</small></p><button class="btn" id="use-code" data-code="' + esc(code) + '">Utiliser mon code</button></div>';
      }
      function generic() {
        gift.innerHTML = giftHtml("MERCI10", "Utilisable une fois sur la boutique en ligne. Le bouton applique le code automatiquement.");
      }
      function fallbackForm() {
        amb.innerHTML = '<form data-submit="surprise" data-success="Merci ! Le code est bien enregistré, l\'ambassadeur recevra ses points après vérification de ta commande.">' +
          '<p hidden><label>Ne pas remplir <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>' +
          '<label>Code ambassadeur<input name="code_ambassadeur" required maxlength="60"></label>' +
          '<label>Numéro de commande<input name="commande" required maxlength="40"><small>Il est dans ton e-mail de confirmation ou ton espace client.</small></label>' +
          '<label>E-mail utilisé pour la commande<input type="email" name="email" required maxlength="200"></label>' +
          '<button class="btn" type="submit">Valider le code</button></form>';
      }
      document.addEventListener("click", function (e) {
        var b = e.target.closest("#use-code");
        if (!b) return;
        try { localStorage.setItem("sl_code", b.getAttribute("data-code")); } catch (er) {}
        location.href = "boutique.html";
      });
      if (!valid) { generic(); fallbackForm(); return Promise.resolve(); }
      return sb.rpc("get_surprise", { p_token: token }).then(function (r) {
        var st = r.data;
        if (!st) { generic(); fallbackForm(); return; }
        if (st.status === "paid" || st.status === "shipped") {
          return sb.rpc("claim_surprise", { p_token: token }).then(function (c) {
            if (c.data) gift.innerHTML = giftHtml(c.data, "Code personnel, utilisable une seule fois sur la boutique en ligne. Le bouton applique le code automatiquement."); else generic();
          }).then(function () {
            if (st.ambassador) { amb.innerHTML = '<div class="ok">Merci ! Le code ambassadeur est déjà enregistré pour cette commande.</div>'; return; }
            amb.innerHTML = '<form id="amb-form"><label>Code ambassadeur<input name="code" required maxlength="30" style="text-transform:uppercase"></label><button class="btn" type="submit">Valider le code</button><div class="form-error"></div></form>';
            document.getElementById("amb-form").addEventListener("submit", function (e) {
              e.preventDefault();
              var f = e.target, v = f.code.value;
              sb.rpc("set_surprise_ambassador", { p_token: token, p_code: v }).then(function (x) {
                if (x.error) { f.querySelector(".form-error").textContent = x.error.message; return; }
                amb.innerHTML = '<div class="ok">Merci ! Le code est bien enregistré, l\'ambassadeur recevra ses points après vérification de ta commande.</div>';
              });
            });
          });
        }
        gift.innerHTML = notice(st.status === "pending" ? "Ta commande n'est pas encore confirmée : ton code personnel apparaîtra dès réception du paiement. En attendant, voici un code pour la prochaine." : "Cette commande est annulée.");
        if (st.status === "pending") { gift.innerHTML += giftHtml("MERCI10", "Utilisable une fois sur la boutique en ligne."); }
        fallbackForm();
      });
    },

    login: function () {
      var next = safeNext(qs("next"));
      return session().then(function (s) {
        if (s) { location.replace(next); return; }
        var box = view();
        var mode = "in";
        function draw(msg, cls) {
          box.innerHTML = '<div class="tabs"><button data-mode="in" class="' + (mode === "in" ? "on" : "") + '">Connexion</button>' +
            '<button data-mode="up" class="' + (mode === "up" ? "on" : "") + '">Créer un compte</button></div>' + (msg ? notice(msg, cls) : "") +
            '<form id="auth-form">' + (mode === "up" ? '<label>Nom complet<input name="full_name" required maxlength="120" autocomplete="name"></label>' : "") +
            '<label>E-mail<input type="email" name="email" required autocomplete="email"></label>' +
            '<label>Mot de passe<input type="password" name="password" required minlength="8" autocomplete="' + (mode === "up" ? "new-password" : "current-password") + '"></label>' +
            '<button class="btn" type="submit">' + (mode === "up" ? "Créer mon compte" : "Me connecter") + "</button>" +
            (mode === "in" ? '<button class="btn ghost" type="button" id="reset">Mot de passe oublié</button>' : "") + "</form>";
        }
        draw();
        box.addEventListener("click", function (e) {
          var m = e.target.closest("[data-mode]");
          if (m) { mode = m.getAttribute("data-mode"); draw(); return; }
          if (e.target.id === "reset") {
            var em = box.querySelector("[name=email]").value;
            if (!em) { draw("Saisissez votre e-mail puis cliquez sur « Mot de passe oublié ».", "notice"); return; }
            sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + "/compte.html" }).then(function () {
              draw("Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé.", "ok");
            });
          }
        });
        box.addEventListener("submit", function (e) {
          if (e.target.id !== "auth-form") return;
          e.preventDefault();
          var fd = new FormData(e.target), email = fd.get("email"), pw = fd.get("password");
          var btn = e.target.querySelector("button[type=submit]");
          btn.disabled = true;
          if (mode === "in") {
            sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
              if (r.error) { draw("Connexion impossible : e-mail ou mot de passe incorrect.", "notice"); return; }
              location.replace(next);
            });
          } else {
            sb.auth.signUp({ email: email, password: pw, options: { data: { full_name: fd.get("full_name") }, emailRedirectTo: location.origin + "/compte.html" } }).then(function (r) {
              if (r.error) { draw("Création impossible : " + r.error.message, "notice"); return; }
              if (r.data && r.data.session) { location.replace(next); return; }
              mode = "in";
              draw("Compte créé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation, puis connectez-vous.", "ok");
            });
          }
        });
      });
    },

    account: function () {
      return session().then(function (s) {
        if (!s) { location.replace("connexion.html?next=compte.html"); return; }
        return Promise.all([
          sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
          sb.from("orders").select("*, order_items(*)").eq("user_id", s.user.id).order("created_at", { ascending: false })
        ]).then(function (res) {
          var prof = res[0].data || {}, orders = res[1].data || [];
          view().innerHTML = '<div class="panel"><h3>Mon profil</h3><p style="color:var(--muted)">' + esc(s.user.email) + "</p>" +
            '<form id="profile-form"><label>Nom complet<input name="full_name" maxlength="120" value="' + esc(prof.full_name || "") + '"></label>' +
            '<button class="btn small" type="submit">Enregistrer</button><div id="p-msg"></div></form>' +
            (prof.role === "admin" ? '<p style="margin-top:14px"><a class="btn small lime" href="admin.html">Ouvrir l\'administration</a></p>' : "") + "</div>" +
            '<div class="panel"><h3>Changer de mot de passe</h3><form id="pw-form"><label>Nouveau mot de passe<input type="password" name="pw" minlength="8" required autocomplete="new-password"></label>' +
            '<button class="btn small" type="submit">Mettre à jour</button><div id="pw-msg"></div></form></div>' +
            '<h2 style="text-align:left;font-size:1.4rem">Mes commandes</h2>' + ordersHtml(orders) +
            '<p style="margin-top:24px"><button class="btn ghost small" id="logout">Se déconnecter</button></p>';

          document.getElementById("profile-form").addEventListener("submit", function (e) {
            e.preventDefault();
            var v = new FormData(e.target).get("full_name");
            sb.from("profiles").update({ full_name: v }).eq("id", s.user.id).then(function (r) {
              document.getElementById("p-msg").innerHTML = r.error ? notice("Enregistrement impossible.") : notice("Profil enregistré.", "ok");
            });
          });
          document.getElementById("pw-form").addEventListener("submit", function (e) {
            e.preventDefault();
            sb.auth.updateUser({ password: new FormData(e.target).get("pw") }).then(function (r) {
              document.getElementById("pw-msg").innerHTML = r.error ? notice("Mise à jour impossible : " + r.error.message) : notice("Mot de passe mis à jour.", "ok");
              if (!r.error) e.target.reset();
            });
          });
          document.getElementById("logout").addEventListener("click", function () {
            sb.auth.signOut().then(function () { location.replace("index.html"); });
          });
        });
      });
    }
  };

  if (pages[page]) {
    pages[page]().catch(function (e) {
      console.error(e);
      var v = view();
      if (v) v.innerHTML = notice("Chargement impossible pour le moment. Réessayez dans un instant.");
    });
  }
})();
