(function () {
  var S = window.SITE, P = window.PRODUCTS;
  var page = (location.pathname.split("/").pop() || "index.html");

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var nav = [
    ["Accueil", "index.html"],
    ["Produits", "produits.html"],
    ["Notre histoire", "histoire.html"],
    ["Ambassadeurs", "ambassadeurs.html"],
    ["FAQ", "faq.html"],
    ["Contact", "contact.html"]
  ];

  var head = document.getElementById("site-header");
  if (head) {
    head.className = "site";
    head.innerHTML = '<div class="wrap"><a class="logo" href="index.html"><img src="logo.svg" alt="">' +
      '<div>SEND<span>LABS</span></div></a><nav class="main">' +
      nav.map(function (n) { return '<a href="' + n[1] + '"' + (page === n[1] ? ' class="active"' : '') + '>' + n[0] + '</a>'; }).join("") +
      '</nav></div>';
  }

  var foot = document.getElementById("site-footer");
  if (foot) {
    foot.className = "site";
    var social = [];
    if (S.vintedProfile) social.push('<a href="' + esc(S.vintedProfile) + '" target="_blank" rel="noopener">Vinted</a>');
    if (S.instagram) social.push('<a href="' + esc(S.instagram) + '" target="_blank" rel="noopener">Instagram</a>');
    if (S.tiktok) social.push('<a href="' + esc(S.tiktok) + '" target="_blank" rel="noopener">TikTok</a>');
    foot.innerHTML = '<div class="wrap">' +
      (social.length ? '<nav>' + social.join("") + '</nav>' : '') +
      '<nav><a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a><a href="ambassadeurs.html#reglement">Règlement ambassadeurs</a></nav>' +
      '<div>© ' + new Date().getFullYear() + ' ' + esc(S.brand) + ' – Conçu et imprimé en 3D</div></div>';
  }

  // Bouton d'achat : lien Vinted de l'annonce, sinon profil Vinted, sinon "Me prévenir"
  window.buyButton = function (p, cls) {
    cls = cls || "btn";
    if (p.status === "soon") return '<a class="' + cls + '" href="contact.html">Être prévenu</a>';
    var link = p.vinted || S.vintedProfile;
    if (link) return '<a class="' + cls + '" href="' + esc(link) + '" target="_blank" rel="noopener">Acheter sur Vinted</a>';
    return '<a class="' + cls + ' disabled" href="#" aria-disabled="true">Lien Vinted bientôt disponible</a>';
  };

  window.renderProducts = function (id, limit) {
    var el = document.getElementById(id);
    if (!el) return;
    var list = limit ? P.slice(0, limit) : P;
    el.innerHTML = list.map(function (p) {
      return '<article class="card"><div class="img">' +
        (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : 'Photo à venir') +
        '</div><div class="body">' + (p.status === "soon" ? '<span class="badge">Bientôt disponible</span>' : '') +
        '<h3>' + esc(p.name) + '</h3><p>' + esc(p.short) + '</p><div class="actions">' +
        '<a class="btn ghost" href="produit.html?p=' + esc(p.slug) + '">Voir la fiche</a>' + window.buyButton(p) +
        '</div></div></article>';
    }).join("");
  };

  // Page produit
  var detail = document.getElementById("product-detail");
  if (detail) {
    var slug = new URLSearchParams(location.search).get("p");
    var p = P.filter(function (x) { return x.slug === slug; })[0] || P[0];
    document.title = p.name + " – " + S.brand;
    detail.innerHTML = '<div class="product-hero"><div class="img">' +
      (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : 'Photo à venir') +
      '</div><div>' + (p.status === "soon" ? '<span class="badge">Bientôt disponible</span>' : '') +
      '<h1>' + esc(p.name) + '</h1><p style="color:var(--muted);margin:10px 0">Protège contre les chutes. Évite de casser une pièce qui coûte cher.</p>' +
      '<p>' + esc(p.long) + '</p><dl class="specs"><dt>Matériau</dt><dd>' + esc(p.material) +
      '</dd><dt>Fabrication</dt><dd>Modélisé et imprimé en 3D par ' + esc(S.brand) +
      '</dd><dt>Compatibilité</dt><dd>' + esc(p.compat) + '</dd></dl>' + window.buyButton(p) + '</div></div>';
  }

  // Liens e-mail dans le contenu
  document.querySelectorAll("[data-email]").forEach(function (a) { a.href = "mailto:" + S.email; a.textContent = S.email; });
  document.querySelectorAll("[data-brand]").forEach(function (a) { a.textContent = S.brand; });
})();
