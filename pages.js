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
      return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><strong>Commande ' + esc(o.id.slice(0, 8)) +
        '</strong><span class="status">' + esc(STATUS[o.status] || o.status) + "</span></div>" +
        '<p style="color:var(--muted);font-size:.85rem">' + esc(S.dateFr(o.created_at)) + "</p><p>" + items + "</p>" +
        '<p><strong>Total : ' + money(o.total_cents) + "</strong></p></div>";
    }).join("");
  }

  // Onglets Photo / Vue 3D : la visionneuse (three.js) n'est chargée qu'au premier clic sur « Vue 3D ».
  function setup3d(path) {
    var photo = document.getElementById("media-photo"), box = document.getElementById("media-3d");
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
          : (p.status === "soon" || p.price_cents == null)
            ? '<a class="btn" href="contact.html">Être prévenu</a>'
            : '<button class="btn" data-add="' + esc(p.id) + '">Ajouter au panier</button>';
        var mp = typeof p.model_path === "string" && /^[a-z0-9._-]+\.stl$/i.test(p.model_path) ? p.model_path : null;
        var media = '<div class="img" id="media-photo">' + (u ? '<img src="' + esc(u) + '" alt="' + esc(p.name) + '">' : esc(p.name.charAt(0))) + "</div>";
        if (mp) {
          media = '<div class="media">' +
            '<div class="media-tabs"><button type="button" class="on" data-media="photo">Photo</button><button type="button" data-media="3d">Vue 3D</button></div>' +
            media + '<div class="img viewer" id="media-3d" hidden></div></div>';
        }
        view().innerHTML = '<div class="product-hero">' + media +
          "<div>" + (p.status === "soon" ? '<span class="badge">Bientôt disponible</span>' : "") +
          "<h1>" + esc(p.name) + '</h1><p class="tag">' + esc(p.tagline || "") + '</p><p class="desc">' + esc(p.description || "") + "</p>" +
          '<div class="pr">' + (p.price_cents != null ? money(p.price_cents) + ' <small style="font-weight:500;color:var(--muted)">TTC</small> ' + S.priceHtml(p) : "Prix à venir") + "</div>" + buy + "</div></div>";
        if (mp) setup3d(mp);
      });
    },

    cart: function () {
      return Promise.all([S.loadProducts(), S.loadDrop()]).then(function (res) {
        var list = res[0], drop = res[1];
        var map = {};
        list.forEach(function (p) { map[p.id] = p; });

        function lines() {
          var c = S.readCart().filter(function (i) {
            var p = map[i.id];
            return p && p.price_cents != null && p.status === "published" && (!p.is_drop || drop.live);
          });
          c.forEach(function (i) { i.price = map[i.id].price_cents; i.name = map[i.id].name; });
          S.writeCart(c);
          return c;
        }

        function draw() {
          var c = lines();
          if (!c.length) {
            view().innerHTML = notice("Votre panier est vide.") + '<p style="text-align:center;margin-top:20px"><a class="btn" href="boutique.html">Voir la boutique</a></p>';
            return Promise.resolve();
          }
          var total = 0;
          var html = c.map(function (i) {
            total += i.price * i.qty;
            return '<div class="cart-line"><div><strong>' + esc(i.name) + '</strong><div style="color:var(--muted);font-size:.85rem">' + money(i.price) + '</div></div>' +
              '<div class="qty"><button data-q="' + esc(i.id) + '" data-d="-1" aria-label="Moins">−</button><span>' + i.qty + '</span><button data-q="' + esc(i.id) + '" data-d="1" aria-label="Plus">+</button></div>' +
              "<strong>" + money(i.price * i.qty) + '</strong><button class="btn small ghost" data-rm="' + esc(i.id) + '">Retirer</button></div>';
          }).join("");
          html += '<div class="total-row"><span>Total TTC</span><span>' + money(total) + "</span></div>";
          return session().then(function (s) {
            if (!s) {
              html += notice("Connectez-vous ou créez un compte pour finaliser votre commande.") +
                '<p style="text-align:center;margin-top:16px"><a class="btn" href="connexion.html?next=panier.html">Se connecter pour commander</a></p>';
              view().innerHTML = html;
              return;
            }
            return sb.from("profiles").select("full_name").eq("id", s.user.id).maybeSingle().then(function (p) {
              html += '<h2 style="text-align:left;font-size:1.3rem;margin-top:30px">Livraison</h2>' +
                '<form id="checkout"><label>Nom complet<input name="full_name" required maxlength="120" value="' + esc((p.data && p.data.full_name) || "") + '"></label>' +
                '<label>Téléphone<input name="phone" maxlength="30" inputmode="tel"></label>' +
                '<label>Adresse de livraison<textarea name="address" rows="3" required maxlength="400"></textarea></label>' +
                '<label>Note (facultatif)<textarea name="note" rows="2" maxlength="400"></textarea></label>' +
                '<button class="btn" type="submit">Valider la commande</button><div class="form-error" id="co-err"></div></form>';
              view().innerHTML = html;
            });
          });
        }

        view().addEventListener("click", function (e) {
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

        view().addEventListener("submit", function (e) {
          if (e.target.id !== "checkout") return;
          e.preventDefault();
          var f = e.target, fd = new FormData(f), btn = f.querySelector("button[type=submit]");
          btn.disabled = true;
          var items = lines().map(function (i) { return { product_id: i.id, quantity: i.qty }; });
          sb.rpc("place_order", {
            p_items: items, p_full_name: fd.get("full_name"), p_phone: fd.get("phone"),
            p_address: fd.get("address"), p_note: fd.get("note")
          }).then(function (r) {
            if (r.error) {
              btn.disabled = false;
              document.getElementById("co-err").textContent = "Commande impossible : " + r.error.message;
              return;
            }
            S.writeCart([]);
            view().innerHTML = '<div class="ok"><strong>Commande enregistrée (n° ' + esc(String(r.data).slice(0, 8)) + ').</strong><br>' +
              "Nous vous envoyons les instructions de paiement par e-mail. Votre commande est suivie dans votre espace client.</div>" +
              '<p style="text-align:center;margin-top:20px"><a class="btn" href="compte.html">Voir mes commandes</a></p>';
          });
        });

        return draw();
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
