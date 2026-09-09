# vms-counter

Gestion de stock et caisse pour bars/restaurants — détection des écarts entre stock théorique et stock réel (fuite de marge, vol, pertes non maîtrisées).

## Language

**Écart**:
Différence entre la quantité comptée physiquement et le stock théorique, calculée lors d'un comptage d'inventaire (ouverture ou fermeture de session de stock). Un écart négatif signale une perte potentielle ; un écart positif signale un surplus.
_Avoid_: manque, différence

**Perte**:
Une diminution de stock rattachée à une cause (`casse`, `peremption`, `offert`, `inexplique`), enregistrée comme mouvement de stock catégorisé. Un écart négatif détecté à la fermeture génère automatiquement une perte de catégorie `inexplique` ; un écart positif n'en génère jamais.
_Avoid_: manquant, disparition

**Surplus**:
Écart positif constaté au comptage. Reste une information neutre portée par le mouvement d'inventaire — n'est jamais transformé en perte, car les catégories de perte n'ont pas de sens pour un excédent de stock.
_Avoid_: gain, bonus
