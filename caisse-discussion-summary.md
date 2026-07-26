# Résumé de discussion — Module Caisse (vms-counter)

Cette conversation avait pour but de définir les fonctionnalités du module **Caisse** avant de coder quoi que ce soit. Rien n'a encore été implémenté (pas de modèle de données créé, `src/app/(tabs)/caisse.tsx` est toujours un placeholder). À reprendre sur Claude Chat.

## Contexte du projet

- App: React Native/Expo, gestion de stock pour bars/snack-bars/restaurants (Cameroun/Afrique).
- Objectif central de l'app: détecter les écarts entre stock théorique et stock réel (fuite de marge, vol, pertes).
- Spec produit complète: `spec-app-gestion-bar-restaurant.md` (racine du projet).
- Modèle de données actuel (`src/Database/db.ts`): `Categorie` (id, nom, type: "bar"|"restaurant"), `Produit` (id, nom, prix, quantite_par_lot?, categorie_id), `Etablissement` (id, nom, type: "bar"|"restaurant"|"les_deux"), `Utilisateur` (id, nom, code, role).
- Aucun modèle `COMMANDE` / `LIGNE_COMMANDE` / `MOUVEMENT_STOCK` / caisse n'existe encore.
- Le spec initial reléguait les "sessions de caisse (ouverture/fermeture/écart théorique vs réel)" à "hors v1, à détailler plus tard" — cette conversation **redéfinit ça comme la priorité v1** pour le cas bar.

## Idée centrale validée par l'utilisateur

Pour un **bar**, la Caisse ne sert PAS à saisir les ventes en temps réel. Le cycle est :

1. **Ouverture de caisse** (matin) — enregistrer le montant présent en caisse.
2. **Mouvements en cours de journée** :
   - Retrait (sortie d'argent) — **motif obligatoire**
   - Ajout (entrée d'argent hors vente) — **motif obligatoire**
3. **Inventaire de fermeture** (soir) — comptage du stock de boissons restant, produit par produit.
4. **Fermeture de caisse** (soir) — enregistrer le montant réellement présent en caisse.
5. **Calcul automatique de l'écart** — comparer le montant attendu (`ouverture + ventes théoriques (déduites de l'inventaire) − retraits + ajouts`) au montant réellement compté à la fermeture.
6. **Historique des sessions de caisse** — consultation des journées passées (ouverture/fermeture/écart).

Pour un **restaurant**, la même logique de caisse (ouverture/fermeture/écart) s'applique aussi. En plus, si l'établissement souscrit à un **forfait payant adéquat**, une fonctionnalité optionnelle s'ajoute :

7. **Prise de commande en temps réel** (ticket par ticket) — désactivée par défaut, réservée à un plan payant supérieur. Cohérent avec le spec initial qui excluait déjà la saisie temps réel côté bar "trop de friction terrain", mais l'autorisait côté restaurant.

## Cas multi-activité (bar + restaurant, `etablissement.type === "les_deux"`)

Dernier point soulevé, pas encore tranché : quand un établissement a à la fois un bar et un restaurant, il faut **deux caisses indépendantes** (une par activité), chacune avec son propre cycle ouverture/mouvements/fermeture/écart — plutôt qu'une seule caisse globale.

Proposition en discussion : rattacher chaque caisse à l'activité via le champ **déjà existant** `Categorie.type` ("bar" | "restaurant"). Même si le stock est physiquement partagé entre bar et restaurant (comme prévu dans le spec), chaque produit reste catégorisé bar ou restaurant, ce qui permettrait d'attribuer chaque mouvement/vente à la bonne caisse sans dupliquer le stock.

## Questions ouvertes (non résolues, à trancher avant de modéliser)

1. Le montant de caisse (ouverture/fermeture) : un **total unique** (un nombre), ou faut-il un détail billets/pièces ?
2. L'inventaire du soir : saisie manuelle du **stock restant par produit**, avec calcul automatique des ventes théoriques (stock_matin − stock_soir) — ou l'inventaire vient-il d'un autre module déjà existant à réutiliser ?
3. Pour un établissement "les_deux" : les deux caisses (bar + restaurant) doivent-elles être ouvertes/fermées **ensemble** (même horaire), ou **indépendamment** (ex: le bar ferme à minuit, le restaurant à 22h) ?
4. Un produit "mixte" vendu à la fois par le bar et servi en salle par le restaurant (stock partagé) : comment répartir l'écart de stock entre les deux caisses, ou est-ce un cas à ignorer pour l'instant ?

## Prochaine étape suggérée

Une fois ces 4 questions tranchées, modéliser les nouvelles tables (proposition de départ, à valider) :
- `SESSION_CAISSE` (id, etablissement_id, type_activite, date, montant_ouverture, montant_fermeture, statut, ecart)
- `MOUVEMENT_CAISSE` (id, session_id, type: "retrait"|"ajout", montant, motif, date)
- Éventuellement `COMMANDE` / `LIGNE_COMMANDE` (repris du spec initial) pour le mode "commande temps réel" du forfait payant.

Ensuite seulement, implémenter l'UI de `src/app/(tabs)/caisse.tsx` (actuellement un placeholder) et le contexte `useDatabase()` associé (suivre le pattern de `src/Database/produits.ts` / `etablissement.ts`).
