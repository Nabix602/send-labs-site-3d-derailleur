# Site SendLabs

Site vitrine statique (HTML, CSS, JavaScript), sans étape de build.

## Modifier le site
- **Liens, e-mail, réseaux, produits** : tout est dans `data.js` (liens Vinted, textes produits, photos).
- **Photos** : mettez-les dans un dossier `photos/` puis renseignez `image: "photos/nom.jpg"` dans `data.js`.
- **Logo** : remplacez `logo.svg` (favicon et logo du header).
- **Couleurs** : variables en haut de `style.css`.
- **Pages légales** : complétez les champs entre crochets dans `mentions-legales.html` et `confidentialite.html`.

## Tester en local
```
npx serve .
```

## Déployer sur Netlify
1. Sur Netlify : Add new site → Import an existing project → GitHub → choisir ce dépôt (privé accepté).
2. Build command : vide. Publish directory : `.`
3. Les formulaires (contact, ambassadeur, ta surprise) sont gérés par Netlify Forms : les messages arrivent dans l'onglet Forms du site.

Chaque `git push` met le site à jour automatiquement.
