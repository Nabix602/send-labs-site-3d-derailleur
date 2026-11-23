# Site SendLabs

Site statique (HTML, CSS, JavaScript, sans étape de build) hébergé sur Vercel, avec comptes, commandes et administration sur Supabase.

## Ce qui est dynamique (Supabase)
- **Produits et prix** : table `products`, modifiable dans `admin.html`.
- **Comptes** : inscription / connexion (Supabase Auth), rôle `client` ou `admin` (table `profiles`).
- **Commandes** : créées par la fonction `place_order` (les prix sont relus côté base, jamais envoyés par le navigateur).
- **Formulaires** (contact, ambassadeur, ta surprise) : table `submissions`, lisible uniquement par un admin.
- **Bandeau d'annonce** : table `site_settings`.

La clé de `config.js` est une clé *publishable* : elle est faite pour être publique. La sécurité repose sur les règles RLS de la base.

## Fichiers
- `config.js` : e-mail, réseaux sociaux, accès Supabase.
- `app.js` : en-tête, pied de page, panier, formulaires.
- `pages.js` : accueil, boutique, produit, panier, connexion, compte.
- `admin.js` : espace administrateur.
- `style.css` : tout le design (variables de couleurs en haut).

## Devenir administrateur
Créer un compte sur le site, puis dans Supabase (SQL Editor) :
```sql
update public.profiles set role = 'admin' where email = 'votre@email.fr';
```

## Déploiement
Chaque `git push` sur `main` redéploie automatiquement sur Vercel.


## Boutique (checkout, livraison, QR, admin)
- **Commande** : `panier.html` (prix, livraison, code promo recalculés côté serveur par `quote_order` / `place_order`). N° de commande `SL-1001…`.
- **Paiement** : virement (instructions dans Admin > Livraison & promos) ; carte via Stripe (Edge Functions `create-checkout` + `stripe-webhook`, dossier `supabase/functions/`). Pour l'activer : secrets `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans Supabase, webhook Stripe vers `https://<projet>.supabase.co/functions/v1/stripe-webhook` (événement `checkout.session.completed`), puis cocher « Activer le paiement par carte » dans l'admin.
- **QR « Ta surprise »** : chaque commande a un jeton ; `bordereau.html?o=<id>` imprime le bon de préparation avec le QR, `etiquette.html` imprime des cartes (admin).
- **Admin** : tableau de bord (à encaisser / à expédier / stock bas / export CSV), commandes, produits, drop, livraison & promos, points ambassadeurs.
