/* Noyau du site : connexion Supabase, en-tête, pied de page, panier, formulaires */
(function () {
  var C = window.SL || {};
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  var memCart = null;

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(c) { return (c / 100).toFixed(2).replace(".", ",") + " €"; }
  function dateFr(s) { return new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); }
  function safeUrl(u) { return /^(https:\/\/|photos\/|\/)/.test(u || "") ? u : ""; }

  /* ---------- Panier (localStorage avec repli en mémoire) ---------- */
  function readCart() {
    if (memCart) return memCart;
    try { memCart = JSON.parse(localStorage.getItem("sl_cart") || "[]"); } catch (e) { memCart = []; }
    return memCart;
  }
  function writeCart(c) {
    memCart = c;
    try { localStorage.setItem("sl_cart", JSON.stringify(c)); } catch (e) { /* ignoré */ }
    badge();
  }
  function cartCount() { return readCart().reduce(function (n, i) { return n + i.qty; }, 0); }
  function badge() {
    var el = document.getElementById("cart-count");
    if (!el) return;
    var n = cartCount();
    el.textContent = n;
    el.style.display = n ? "flex" : "none";
  }
  function addToCart(p) {
    var c = readCart().slice();
    var line = c.filter(function (i) { return i.id === p.id; })[0];
    if (line) { line.qty = Math.min(20, line.qty + 1); }
    else { c.push({ id: p.id, name: p.name, price: p.price_cents, qty: 1 }); }
    writeCart(c);
  }

  /* ---------- Produits ---------- */
  var prodPromise = null;
  function loadProducts() {
    if (!prodPromise) {
      prodPromise = sb.from("products").select("*").order("sort_order").then(function (r) {
        if (r.error) throw r.error;
        return r.data || [];
      }).catch(function (e) { prodPromise = null; throw e; });
    }
    return prodPromise;
  }
  function productCard(p) {
    var u = safeUrl(p.image_url);
    var img = u ? '<img src="' + esc(u) + '" alt="' + esc(p.name) + '" loading="lazy">' : esc(p.name.charAt(0));
    var buy = (p.status === "soon" || p.price_cents == null)
      ? '<a class="btn small ghost" href="contact.html">Être prévenu</a>'
      : '<button class="btn small" data-add="' + esc(p.id) + '">Ajouter · ' + money(p.price_cents) + '</button>';
    return '<article class="card"><a class="img" href="produit.html?p=' + esc(p.slug) + '">' + img + '</a><div class="body">' +
      (p.status === "soon" ? '<span class="badge">Bientôt disponible</span>' : '') +
      '<h3>' + esc(p.name) + '</h3><p>' + esc(p.tagline || "") + '</p><div class="actions">' +
      '<a class="btn small ghost" href="produit.html?p=' + esc(p.slug) + '">Détails</a>' + buy + '</div></div></article>';
  }
  function giftCard(p) {
    var pop = p.tagline === "Populaire";
    var eur = Math.round(p.price_cents / 100);
    return '<article class="card' + (pop ? ' pop' : '') + '"><div class="body"><div class="kicker"><span>' + esc(p.tagline || "") +
      '</span><span>' + eur + ' €</span></div><div class="big">' + eur + ' €</div><p>' + esc(p.description || "") +
      '</p><button class="btn small' + (pop ? '' : ' ghost') + '" data-add="' + esc(p.id) + '">Choisir ' + eur + ' €</button></div></article>';
  }

  /* ---------- Drop (série limitée, activable depuis l'admin) ---------- */
  var DROP_KEYS = ["drop_enabled", "drop_title", "drop_description", "drop_starts_at", "drop_ends_at"];
  var dropPromise = null;
  function parseDate(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function loadDrop() {
    if (!dropPromise) {
      dropPromise = sb.from("site_settings").select("key,value").in("key", DROP_KEYS).then(function (r) {
        var m = {};
        (r.data || []).forEach(function (x) { m[x.key] = x.value; });
        var now = new Date();
        var start = parseDate(m.drop_starts_at), end = parseDate(m.drop_ends_at);
        var enabled = m.drop_enabled === "1";
        var ended = !!(enabled && end && now >= end);
        var upcoming = !!(enabled && !ended && start && now < start);
        return {
          enabled: enabled && !ended, title: m.drop_title || "Drop", description: m.drop_description || "",
          start: start, end: end, upcoming: upcoming, live: enabled && !ended && !upcoming
        };
      }).catch(function () { return { enabled: false, live: false, upcoming: false, title: "", description: "", start: null, end: null }; });
    }
    return dropPromise;
  }
  function dropCard(p, live) {
    var u = safeUrl(p.image_url);
    var img = u ? '<img src="' + esc(u) + '" alt="' + esc(p.name) + '" loading="lazy">' : esc(p.name.charAt(0));
    var buy = !live
      ? '<button class="btn small" disabled>Pas encore ouvert</button>'
      : (p.price_cents == null ? '<a class="btn small ghost" href="contact.html">Être prévenu</a>'
        : '<button class="btn small" data-add="' + esc(p.id) + '">Ajouter · ' + money(p.price_cents) + '</button>');
    return '<article class="card"><a class="img" href="produit.html?p=' + esc(p.slug) + '">' + img + '</a><div class="body"><span class="badge">Drop</span>' +
      '<h3>' + esc(p.name) + '</h3><p>' + esc(p.tagline || "") + '</p><div class="actions">' +
      '<a class="btn small ghost" href="produit.html?p=' + esc(p.slug) + '">Détails</a>' + buy + '</div></div></article>';
  }
  function showDropLink() {
    loadDrop().then(function (d) {
      var a = document.getElementById("drawer-drop");
      if (a && d.enabled) a.style.display = "block";
    });
  }

  /* ---------- En-tête et pied de page ---------- */
  function renderChrome() {
    var h = document.getElementById("site-header");
    if (h) {
      h.className = "site";
      h.innerHTML = '<div class="announce" id="announce"></div><div class="wrap hdr">' +
        '<div><button class="burger" id="burger" aria-label="Ouvrir le menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>' +
        '<a class="logo" href="index.html" aria-label="SendLabs, accueil"><img src="logo.png" alt="SendLabs" width="154" height="44"></a>' +
        '<div class="hdr-right"><a class="cart" href="panier.html" aria-label="Panier"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/></svg><span class="count" id="cart-count"></span></a>' +
        '<a class="pill-btn" id="auth-link" href="connexion.html">Se connecter</a></div></div>';

      var scrim = document.createElement("div");
      scrim.className = "scrim";
      var drawer = document.createElement("nav");
      drawer.className = "drawer";
      drawer.setAttribute("aria-label", "Menu");
      drawer.innerHTML = '<button class="close" aria-label="Fermer le menu">×</button>' +
        '<a href="index.html">Accueil</a><a href="boutique.html">Boutique</a><a href="drop.html" id="drawer-drop" style="display:none;color:#5c8a00">Drop</a><a href="histoire.html">Notre histoire</a>' +
        '<a href="ambassadeurs.html">Ambassadeurs</a><a href="faq.html">FAQ</a><a href="contact.html">Contact</a>' +
        '<a href="connexion.html" id="drawer-auth">Se connecter</a><a href="admin.html" id="drawer-admin" style="display:none">Administration</a>';
      document.body.appendChild(scrim);
      document.body.appendChild(drawer);
      var toggle = function (open) { drawer.classList.toggle("open", open); scrim.classList.toggle("open", open); };
      document.getElementById("burger").addEventListener("click", function () { toggle(true); });
      scrim.addEventListener("click", function () { toggle(false); });
      drawer.querySelector(".close").addEventListener("click", function () { toggle(false); });
    }

    var f = document.getElementById("site-footer");
    if (f) {
      f.className = "site";
      var social = [];
      if (C.instagram) social.push('<a href="' + esc(C.instagram) + '" target="_blank" rel="noopener">Instagram</a>');
      if (C.tiktok) social.push('<a href="' + esc(C.tiktok) + '" target="_blank" rel="noopener">TikTok</a>');
      f.innerHTML = '<div class="wrap"><div class="cols">' +
        '<div><div class="brand">SEND LABS<i>.</i></div><p>Atelier indépendant de conception et fabrication additive pour le cyclisme de précision.</p><span class="loc">ATELIER YVELINES (78) / ÎLE-DE-FRANCE</span></div>' +
        '<div><h4>ATELIER</h4><a href="index.html">Accueil</a><a href="histoire.html">Notre histoire</a><a href="boutique.html">Boutique</a><a href="ambassadeurs.html">Ambassadeurs</a>' + social.join("") + '</div>' +
        '<div><h4>LÉGAL &amp; TRANSPARENCE</h4><a href="cgv.html">Conditions Générales de Vente</a><a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Politique de confidentialité</a><a href="remboursement.html">Politique de remboursement</a><a href="confidentialite.html#cookies">Gestion des cookies</a></div>' +
        '<div><h4>CONTACT DIRECT</h4><p>Besoin d\'une compatibilité spécifique ou d\'un conseil ?</p><a href="contact.html" style="color:#fff;font-weight:700">Écrire à l\'atelier</a></div>' +
        '</div><div class="legal"><span>© ' + new Date().getFullYear() + ' SENDLABS. Atelier de fabrication additive cycliste. Apple et AirTag sont des marques déposées d\'Apple Inc.</span><span>Fabrication unitaire contrôlée / Yvelines (78)</span></div></div>';
    }
    badge();
  }

  function refreshAuth() {
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) return;
      var a = document.getElementById("auth-link");
      var d = document.getElementById("drawer-auth");
      if (a) { a.textContent = "Mon compte"; a.href = "compte.html"; }
      if (d) { d.textContent = "Mon compte"; d.href = "compte.html"; }
      sb.from("profiles").select("role").eq("id", s.user.id).maybeSingle().then(function (p) {
        var adm = document.getElementById("drawer-admin");
        if (adm && p.data && p.data.role === "admin") adm.style.display = "block";
      });
    });
  }

  function loadAnnouncement() {
    var el = document.getElementById("announce");
    if (!el) return;
    sb.from("site_settings").select("value").eq("key", "announcement").maybeSingle().then(function (r) {
      if (r.data && r.data.value) el.textContent = r.data.value;
    });
  }

  /* ---------- Clics « ajouter au panier » ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-add]");
    if (!b) return;
    var key = b.getAttribute("data-add");
    Promise.all([loadProducts(), loadDrop()]).then(function (res) {
      var p = res[0].filter(function (x) { return x.id === key || x.slug === key; })[0];
      if (!p || p.price_cents == null || p.status !== "published") return;
      if (p.is_drop && !res[1].live) return; /* la base refuse aussi la commande */
      addToCart(p);
      var old = b.getAttribute("data-label") || b.textContent;
      b.setAttribute("data-label", old);
      b.textContent = "Ajouté ✓";
      setTimeout(function () { b.textContent = old; }, 1400);
    }).catch(function () { /* ignoré */ });
  });

  /* ---------- Formulaires du site (enregistrés dans Supabase) ---------- */
  document.addEventListener("submit", function (e) {
    var f = e.target;
    var type = f.getAttribute("data-submit");
    if (!type) return;
    e.preventDefault();
    var fd = new FormData(f);
    if (fd.get("bot-field")) return;
    var payload = {};
    fd.forEach(function (v, k) { if (k !== "bot-field") payload[k] = String(v).slice(0, 800); });
    var btn = f.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;
    sb.from("submissions").insert({ type: type, payload: payload }).then(function (r) {
      if (r.error) {
        if (btn) btn.disabled = false;
        var err = f.querySelector(".form-error");
        if (!err) { err = document.createElement("div"); err.className = "form-error"; f.appendChild(err); }
        err.textContent = "Envoi impossible. Réessayez ou écrivez-nous par e-mail.";
        return;
      }
      f.innerHTML = '<div class="ok">' + esc(f.getAttribute("data-success") || "Merci, c'est envoyé !") + '</div>';
    });
  });

  document.querySelectorAll("[data-email]").forEach(function (a) { a.href = "mailto:" + (C.email || ""); a.textContent = C.email || ""; });

  window.SLapp = {
    sb: sb, esc: esc, money: money, dateFr: dateFr, safeUrl: safeUrl,
    readCart: readCart, writeCart: writeCart, loadProducts: loadProducts,
    productCard: productCard, giftCard: giftCard, loadDrop: loadDrop, dropCard: dropCard
  };

  renderChrome();
  refreshAuth();
  loadAnnouncement();
  showDropLink();
})();
