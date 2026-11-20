/* ===== Configuration du site : c'est le seul fichier à modifier pour changer les liens et produits ===== */
window.SITE = {
  brand: "SendLabs",
  email: "contact@exemple.fr",          // À remplacer
  vintedProfile: "",                    // Lien de votre profil Vinted (laisser vide tant que non prêt)
  instagram: "",                        // ex. https://www.instagram.com/sendlabs
  tiktok: ""                            // ex. https://www.tiktok.com/@sendlabs
};

window.PRODUCTS = [
  {
    slug: "protege-derailleur",
    name: "Protège-dérailleur",
    short: "Un dérailleur coûte cher et casse vite lors d'une chute. Notre protège-dérailleur en TPU encaisse les chocs à sa place.",
    long: "Un dérailleur coûte cher et casse vite lors d'une chute. Notre protège-dérailleur en TPU encaisse les chocs à sa place. Souple et léger, il est modélisé sur mesure et imprimé en 3D par SendLabs.",
    material: "TPU, flexible et résistant aux chocs et à l'abrasion",
    compat: "À compléter (modèles de dérailleurs compatibles)",
    image: "",            // ex. "photos/protege-derailleur.jpg"
    vinted: "",           // lien de l'annonce Vinted
    status: "available"
  },
  {
    slug: "protege-disque",
    name: "Protège-disque de frein",
    short: "Une protection en TPU pour vos disques de frein, conçue et imprimée par nos soins.",
    long: "Une protection en TPU pour vos disques de frein, conçue et imprimée par nos soins. Légère et résistante.",
    material: "TPU, flexible et résistant aux chocs et à l'abrasion",
    compat: "À compléter (tailles de disques compatibles)",
    image: "",
    vinted: "",
    status: "available"
  },
  {
    slug: "garde-boue",
    name: "Garde-boue finition carbone",
    short: "Un garde-boue propre et léger, en finition carbone, modélisé par nos soins.",
    long: "Un garde-boue propre et léger, en finition carbone, modélisé par nos soins. Bientôt disponible.",
    material: "À préciser",
    compat: "À compléter",
    image: "",
    vinted: "",
    status: "soon"
  }
];
