# TODO SendLabs (reprise automatique)

Quand tu reprends cette session : lis ce fichier, fais les points non cochés dans l'ordre, coche-les, pousse sur `main`, vérifie le déploiement Vercel.

## Fait
- [x] Base : livraison (Mondial Relay relais 4,90 €), codes promo (MERCI10), devis serveur `quote_order`, `place_order`, cartes surprise (jeton 16 car. par commande), `claim_surprise`, `get_surprise`, `set_surprise_ambassador`, stock remis si commande annulée, suivi colis
- [x] Checkout (panier.html) : livraison + point relais saisi à la main + code promo + virement
- [x] Page « Ta surprise » (QR par colis) + `etiquette.html` (cartes A4 imprimables avec QR, admin)
- [x] N° de commande SL-1001…, checkout 2 colonnes (récap + paiement à droite), tableau de bord admin (KPIs, à encaisser, à expédier, stock bas, export CSV), bon de préparation avec QR (`bordereau.html`), bandeau défilant plus rapide
- [x] Admin : commandes (relais, suivi, statut), onglet Livraison & promos (codes, points ambassadeurs, instructions de virement)

## À faire (Claude)
- [ ] E-mails automatiques (confirmation, expédition) : Edge Function + Resend (gratuit 3000/mois, clé à fournir par Esteban) — non faits
- [ ] Lien de suivi Mondial Relay cliquable (format d'URL à vérifier)
- [x] Style sombre « lime & noir » appliqué par surcouche CSS (à contrôler visuellement page par page)
- [ ] Test navigateur complet (panier → commande → admin « payée » → QR → code MERCI-xxxxxx)
- [x] Paiement par carte Stripe : fonctions écrites, testées avec simulation et déployées ; **inactif** tant qu'Esteban n'a pas créé un compte Stripe, ajouté les 2 secrets et configuré le webhook (voir README)
- [ ] Widget officiel Mondial Relay (nécessite code enseigne Mondial Relay ; sinon saisie manuelle)
- [x] Admin : ajout de modes de livraison
- [ ] Table `ambassadors` pour valider les codes ambassadeurs
- [x] Photos Send Cage (3, issues des captures Shopify)
- [ ] Page carte cadeau au style du site ; pages légales (CGV, mentions, remboursement) à compléter
- [x] README

## À faire (Esteban)
- [ ] Supabase > Auth > URL Configuration : Site URL `https://sendlabs-site-omega.vercel.app` + Redirect `https://sendlabs-site-omega.vercel.app/**`
- [ ] Auth : activer « Leaked password protection »
- [ ] Remplir l'IBAN dans Admin > Livraison & promos > Instructions de paiement
- [ ] Mettre les vrais stocks (tous à 0 / non suivis), e-mail de contact réel (config.js)
- [ ] Statut juridique (micro-entreprise) avant la 1re vente
- [ ] Esteban : créer compte Stripe + secrets + webhook (optionnel)
- [ ] Boxtal : intégration API non faite (documentation non lisible ici, identifiants requis) ; en attendant bouton « Copier pour Boxtal » dans l'admin
