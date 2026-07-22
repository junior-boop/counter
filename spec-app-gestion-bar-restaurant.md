# Application de gestion de stock — Bars, snack-bars & restaurants (Cameroun/Afrique)

## Objectif

Donner aux propriétaires une visibilité claire et régulière sur leur stock, leurs produits et leur caisse — avec pour objectif central la **détection d'écarts entre stock théorique et stock réel** (fuite de marge, vol, pertes non maîtrisées).

## Périmètre

- **Type d'établissement** (configurable par client) :
  - Bar / snack-bar seul
  - Restaurant seul
  - Restaurant + bar (gestion combinée, stock partagé)
- Pour un restaurant, l'app gère la **caisse et l'enregistrement des commandes** (le caissier note toutes les commandes de la journée en temps réel), mais **n'envoie pas** les commandes en cuisine (pas de KDS).

## Fonctionnalités

### v1 (socle)
- Inventaire
- Réapprovisionnement
- Historique
- Caisse
- Tendances (jours à fort potentiel)
- Gestion des pertes/casse, catégorisée :
  - Casse
  - Péremption
  - Offert / consommation interne
  - Écart inexpliqué (alimente la détection de fraude/vol)
- Mode hors-ligne (connectivité instable sur le terrain)
- Multi-utilisateurs avec rôles (patron / gérant / serveur / caissier)
- Alertes de seuil bas
- Module recettes (pour restaurant) : plat composé d'ingrédients, décrémentation automatique du stock à la vente

### Explicitement exclu de la v1
- Saisie de commande en temps réel côté bar (jugé trop de friction terrain pour un premier lancement)

### Système de rapport
- Rapport in-app avec graphiques + analyse = source de vérité
- Notification push liée automatiquement au rapport (uniquement alertes critiques : rupture de stock, écart anormal)
- Message WhatsApp (sans API payante) contenant un **lien vers le rapport** (pas de PDF) — envoyé via partage natif (Web Share API / Share Intent) ou lien `wa.me` pré-rempli

## Rôles & navigation (bottom tab bar dynamique selon le rôle)

| Rôle | Onglets |
|---|---|
| Serveur | Caisse, Stock |
| Gérant | Caisse, Inventaire, Réapprovisionnement |
| Patron | Rapports, Stock (regroupe Inventaire + Réapprovisionnement), Caisse |

## Modèle de données (résumé)

- `ETABLISSEMENT` (id, nom, type)
- `UTILISATEUR` (id, etablissement_id, nom, role)
- `PRODUIT` (id, etablissement_id, nom, unite, prix, stock_actuel, seuil_alerte, est_compose)
- `RECETTE` (id, plat_id → PRODUIT, ingredient_id → PRODUIT, quantite)
- `COMMANDE` (id, etablissement_id, utilisateur_id, date, statut)
- `LIGNE_COMMANDE` (id, commande_id, produit_id, quantite, prix_unitaire)
- `MOUVEMENT_STOCK` (id, produit_id, type, quantite, categorie_perte, date)
- `RAPPORT` (id, etablissement_id, periode, lien)

**Points clés du modèle :**
- `PRODUIT.est_compose` distingue produit vendu directement (bar) vs plat composé (restaurant), sans dupliquer le catalogue.
- Stock **partagé et unique** entre bar et restaurant quand les deux sont actifs pour un même établissement.
- `MOUVEMENT_STOCK` centralise ventes, pertes et réapprovisionnements — table pivot pour la détection d'écarts.
- `COMMANDE.statut` gère le cas commande ouverte (addition en attente) vs soldée.

**À détailler plus tard (hors v1) :** sessions de caisse (ouverture/fermeture/écart théorique vs réel), fournisseurs, permissions fines par rôle.

## Stack technique

- React Native + Expo
- Nativewind
- expo-sqlite
- expo-sharing
- expo-notifications
- expo-navigation-bar
- expo-secure-store
- expo-updates
- react-native-svg
- react-native-reanimated
- react-native-screens
- react-native-safe-area-context
- @shopify/flash-list
- react-hook-form
- zustand
- date-fns
- victory-native
- lucide-react-native

### Backend
- Cloudflare Workers / D1 / R2 / KV / AI Gateway (stack existante de l'agence)
- Package.json séparé du repo app

## Installation des dépendances

```bash
npx expo install \
  nativewind \
  expo-sharing \
  expo-sqlite \
  expo-notifications \
  expo-navigation-bar \
  react-native-svg \
  react-native-reanimated \
  react-native-screens \
  react-native-safe-area-context \
  expo-updates \
  expo-secure-store

npm install \
  @shopify/flash-list \
  react-hook-form \
  zustand \
  date-fns \
  victory-native \
  lucide-react-native
```

## Notes de conception

- Priorité de dev : la couche **sync offline** est la pièce technique la plus délicate — à traiter en premier. LiveStore écarté (ne fonctionne pas) ; envisager une sync maison sur `expo-sqlite` avec pattern outbox (file de mutations en attente poussée vers Cloudflare Workers/D1 au retour de connexion).
- Discours de vente/adoption : positionner l'outil comme protection de la marge du bar, pas comme flicage individuel des employés.
- Saisie terrain : viser une saisie la plus rapide possible (gros boutons, produits à forte rotation en avant) pour éviter le report de saisie et les approximations.
