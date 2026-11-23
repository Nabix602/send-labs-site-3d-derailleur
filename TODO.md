# TODO SendLabs (reprise automatique)

Quand tu reprends cette session : lis ce fichier, fais les points non cochés dans l'ordre, coche-les, pousse sur `main`, vérifie le déploiement Vercel.

## Fait
- [x] Base : livraison (Mondial Relay relais 4,90 €), codes promo (MERCI10), devis serveur `quote_order`, `place_order`, cartes surprise (jeton 16 car. par commande), `claim_surprise`, `get_surprise`, `set_surprise_ambassador`, stock remis si commande annulée, suivi colis
- [x] Checkout (panier.html) : livraison + point relais saisi à la main + code promo + virement
- [x] Page « Ta surprise » (QR par colis) + `etiquette.html` (cartes A4 imprimables avec QR, admin)
- [x] Admin : commandes (relais, suivi, statut), onglet Livraison & promos (codes, points ambassadeurs, instructions de virement)

## À faire (Claude)
- [ ] Test navigateur complet (panier → commande → admin « payée » → QR → code MERCI-xxxxxx)
- [ ] Paiement par carte Stripe (Edge Functions `create-checkout` + `stripe-webhook`, sans abonnement : 1,5 % + 0,25 € par paiement ; clés à mettre par Esteban dans Supabase)
- [ ] Widget officiel Mondial Relay (nécessite code enseigne Mondial Relay ; sinon saisie manuelle)
- [ ] Admin : ajouter/supprimer des modes de livraison ; table `ambassadors` pour valider les codes
- [ ] Page carte cadeau au style du site ; pages légales (CGV, mentions, remboursement) à compléter
- [ ] README : décrire le fonctionnement boutique/QR

## À faire (Esteban)
- [ ] Supabase > Auth > URL Configuration : Site URL `https://sendlabs-site-omega.vercel.app` + Redirect `https://sendlabs-site-omega.vercel.app/**`
- [ ] Auth : activer « Leaked password protection »
- [ ] Remplir l'IBAN dans Admin > Livraison & promos > Instructions de paiement
- [ ] Mettre les vrais stocks (tous à 0 / non suivis), e-mail de contact réel (config.js)
- [ ] Statut juridique (micro-entreprise) avant la 1re vente
