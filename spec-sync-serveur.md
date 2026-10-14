# Spécification — Synchronisation temps réel serveur (WebSocket / Durable Objects)

## Contexte
- Backend : Cloudflare Workers + Hono
- App mobile : React Native / Expo, **local-first** (expo-sqlite comme source de vérité locale)
- Besoin métier : synchronisation temps réel entre le patron et les employés autour des sessions de caisse (bar / restaurant), avec permissions différenciées.

---

## 0. Pourquoi un serveur (Durable Object) dans un projet local-first

Le local-first reste la source de vérité pour chaque appareil individuel (résilience hors-ligne, écriture immédiate en SQLite). Mais trois besoins précis, apparus dans les cas d'usage réels du produit, ne peuvent pas être résolus par du local-first seul — ils exigent un point de rendez-vous central :

1. **Visibilité multi-utilisateurs en temps réel.** Le patron doit voir les commandes et l'état de caisse *pendant* que l'employé travaille, pas seulement après une synchronisation différée. Deux bases SQLite locales, chacune sur son propre téléphone, n'ont aucun moyen de "se voir" sans un intermédiaire qui relaie les changements de l'une vers l'autre au moment où ils surviennent.
2. **Présence (qui est connecté maintenant).** Cas concret : le patron absent 3h se connecte et doit savoir si l'employé est actuellement actif. Ça n'existe pas en pur local-first — il faut un endroit où chaque appareil "s'annonce" en se connectant, et où n'importe qui peut demander "qui est là".
3. **Routage sélectif selon les permissions.** Le rapport de clôture doit atteindre uniquement le patron, jamais l'employé qui l'a généré. Ça demande une logique de distribution centralisée : sans serveur, chaque appareil ne connaît que ses propres données locales et ne peut pas décider seul "qui d'autre a le droit de voir ceci".

**Pourquoi un Durable Object précisément, plutôt qu'un Worker HTTP classique ou D1 seul :**
- Les DO gèrent nativement les WebSockets, contrairement à un Worker HTTP classique — c'est le mécanisme de base pour du push temps réel.
- Un DO est **single-threaded avec un état propre à son instance** : pas de race condition entre deux employés qui écrivent en même temps sur la même session de caisse, ce que D1 seul (base partagée, accès concurrent) ne garantit pas aussi facilement pour ce type de coordination fine.
- Intégration directe à la stack Cloudflare déjà en place (Workers, D1, R2, KV) — pas de service tiers à ajouter.
- La Hibernation API permet de garder des dizaines de connexions ouvertes (estimation ~80) pour un coût minime, contrairement à une architecture de polling qui interrogerait D1 en boucle.

En résumé : le local-first gère la résilience hors-ligne de chaque appareil ; le Durable Object gère la coordination en direct entre plusieurs personnes sur un même état partagé (une session de caisse).

## 1. Architecture générale

- **Un Durable Object par établissement** (pas par session individuelle) : il fait office de "room" persistante qui survit aux ouvertures/fermetures de sessions successives.
- **WebSocket Hibernation API obligatoire** — ne pas utiliser `accept()` classique. Sans hibernation, la durée est facturée en continu pour chaque connexion ouverte ; avec ~80 connexions simultanées sur plusieurs heures, l'écart de coût est significatif (estimation : ~5$/mois avec hibernation vs 60-100$/mois sans).
- L'authentification doit être vérifiée **avant** l'upgrade WebSocket (token/session existant), pas seulement déclarée par le client — voir §3.1.
- Chaque connexion est identifiée par des **tags** posés via `ctx.acceptWebSocket(ws, tags)`, pas par un objet en mémoire (voir §3, correction importante) :
  ```ts
  tags = [`user:${userId}`, `role:${role}`, `etablissement:${etablissementId}`]
  ```

## 2. Flux de synchronisation : push, jamais pull

Le Durable Object ne va **jamais** chercher les données dans le storage local d'un client. Le sens du flux est toujours :

1. L'employé écrit en local (SQLite) immédiatement — fonctionne hors ligne.
2. Dès que l'app a du réseau, elle **pousse** chaque changement au DO via message WebSocket (ou les met en file d'attente si hors ligne, et les envoie à la reconnexion — pattern outbox).
3. Le DO persiste l'événement dans son storage intégré (et idéalement relaie vers D1 pour la durabilité au-delà du cycle de vie du DO).
4. Le DO **broadcast** l'événement aux sockets actuellement connectés, filtré par rôle/permissions (voir §5).

Ce sens garantit que l'état côté serveur est toujours à jour dès que l'employé a du réseau, sans dépendre de la présence du patron au même moment.

## 3. Présence (qui est connecté) — corrigé

⚠️ Une `Map<userId, socket>` construite en mémoire (ex: dans le constructeur du DO) est **perdue à chaque mise en hibernation**. Comme la Hibernation API est obligatoire (§1), ce n'est pas une option viable.

La bonne approche Cloudflare :
- Taguer chaque connexion à l'acceptation : `ctx.acceptWebSocket(ws, [\`user:${userId}\`, \`role:${role}\`])`.
- Retrouver les connexions par tag à tout moment, y compris après un réveil du DO : `ctx.getWebSockets('role:patron')`, `ctx.getWebSockets(\`user:${userId}\`)`.
- Cette API survit à l'hibernation ; un Map fait main ne survit pas.
- Le ping/pong WebSocket standard sert uniquement au keep-alive (détecter les connexions mortes), pas à la détection de présence — la présence se lit directement via `getWebSockets`.

### 3.1 Authentification de la connexion WebSocket
Le `role` et les `permissions` ne doivent jamais être acceptés tels que déclarés par le client à la connexion. Avant l'upgrade WebSocket, valider un token/session serveur existant et dériver le rôle/permissions réels depuis la base — sinon un client pourrait se connecter en prétendant être "patron".

### 3.2 Multi-appareils par utilisateur
Un même `userId` peut avoir plusieurs sockets actifs (ex: patron connecté sur deux téléphones). Le tag `user:${userId}` retourne déjà potentiellement plusieurs sockets via `getWebSockets` — s'assurer que la présence et le broadcast itèrent sur tous les sockets d'un utilisateur, pas un seul.

## 4. Connexion du patron : snapshot, pas de re-fetch live

Quand le patron se connecte :

1. Le DO envoie immédiatement un **snapshot** de l'état déjà stocké (commandes en cours + état de caisse) — vue par défaut, légère.
2. Le patron peut ensuite déclencher un **"switch"** vers la vue complète : le client envoie une requête de snapshot supplémentaire (stock), toujours servie depuis les données déjà en storage côté DO — jamais un aller-retour vers l'appareil de l'employé.
3. Après ce snapshot initial, le patron est abonné aux événements futurs en temps réel (mêmes messages broadcastés à tous les rôles autorisés).

### 4.1 Reprise de connexion (résumable)
Le modèle ci-dessus redemande un snapshot complet à chaque reconnexion. Prévoir un `lastSeenSequence` envoyé par le client à la reconnexion, pour que le DO ne renvoie que les événements manqués depuis cette séquence plutôt que tout l'historique — voir §6 pour le numéro de séquence.

## 5. Permissions et routage sélectif

- **Rapport de clôture** : généré uniquement par un employé, jamais par le patron. Une fois généré, il est broadcasté **uniquement aux sockets de rôle `patron`** — ni à l'employé auteur, ni aux autres employés. Il fait office de passerelle de confirmation de l'inventaire du jour.
- **Permissions granulaires** : le patron doit pouvoir accorder à un employé des droits précis au-delà de son rôle de base (ex : modifier les prix produits en tant qu'administrateur, même depuis l'interface employé commune). Prévoir une table ou un champ `permissions: string[]` par utilisateur plutôt qu'un simple rôle binaire patron/employé.
- **Interface commune** : l'interface "employé" devient l'interface par défaut pour tout le monde (patron inclus). Un bouton switch permet au patron de basculer vers sa vue de gestion globale. Les permissions accordées doivent rester actives même quand le patron est dans l'interface commune.

## 6. Schéma de message WebSocket (corrigé)

Ajout d'un `eventId` (idempotence) et d'un `sequence` (ordre) absents du premier jet :

```ts
{
  eventId: string,      // uuid généré côté client, pour dédupliquer un événement rejoué
  sequence: number,      // ordre logique dans la session, assigné par le DO à la réception
  type: 'SESSION_OPENED' | 'SESSION_CLOSED' | 'ORDER_CREATED' | 'CASH_MOVEMENT'
      | 'INVENTORY_SUBMITTED' | 'REPORT_GENERATED'
      | 'SNAPSHOT_REQUEST' | 'SNAPSHOT_RESPONSE' | 'STOCK_SNAPSHOT_REQUEST',
  sessionId: string,
  userId: string,
  role: 'patron' | 'employe',
  payload: Record<string, unknown>,
  timestamp: string // ISO 8601, horodatage client — ne pas utiliser comme seul ordre de vérité
}
```

### 6.1 Idempotence et ordre
- Le DO doit ignorer un `eventId` déjà traité (dédoublonnage après un renvoi suite à coupure réseau).
- Le DO assigne le `sequence` à la réception (source de vérité pour l'ordre), pas le client — l'horodatage client n'est pas fiable pour trancher un ordre entre appareils.

### 6.2 Résolution de conflits
Non résolu dans le modèle actuel : si deux appareils modifient la même donnée hors ligne (ex : deux comptages de stock différents avant sync), aucune règle n'est définie. À trancher avant l'implémentation — options possibles : dernier écrit gagne (simple mais risqué sur des données financières), ou détection de conflit avec résolution manuelle côté patron.

### 6.3 Validation serveur des données financières
Le modèle broadcast actuellement les événements tels que déclarés par le client. Pour les montants de caisse et le calcul d'écart, le DO devrait recalculer/vérifier ces valeurs à partir des événements bruts plutôt que de faire confiance à un total pré-calculé envoyé par le client — sinon une erreur (ou une falsification) côté client passe sans détection.

## 7. Endpoints (Hono sur Workers)

- `POST /etablissement/:id/session/open` — crée/active la session caisse, notifie le DO.
- `GET /etablissement/:id/ws` (upgrade WebSocket, avec vérification d'auth — voir §3.1) — rejoint le DO de l'établissement.
- Une fois connecté, toutes les opérations (commandes, mouvements de caisse, inventaire, rapport) transitent en messages WebSocket, pas en REST — pour rester cohérent avec le broadcast temps réel.

## 8. Contexte métier du flux caisse (pour cadrer les événements à synchroniser)

Ouverture de session → entrée du fond de caisse → inventaire → réapprovisionnement → (déclenche automatiquement une demande de sortie de caisse) → entrée de caisse possible ensuite.

Gestion des écarts : l'app calcule un état interne à partir des commandes et connaît un seuil automatiquement ; après inventaire, en cas d'écart, elle l'estime et en détaille la composition. Cet état/seuil doit être calculable côté DO ou synchronisé avec lui pour rester cohérent entre les clients connectés (et validé côté serveur — voir §6.3).

## 9. Piste d'audit

Absente du modèle actuel. Pour une app qui gère de l'argent, prévoir un journal immuable des événements (qui a fait quoi, quand, depuis quel appareil) — utile en cas de litige sur un écart de caisse. Le storage DO persistant (§2) peut servir de base à ce journal si les événements bruts y sont conservés sans écrasement.

## 10. Points ouverts à trancher avant implémentation

- Persistance : storage DO seul, ou relais systématique vers D1 pour la durabilité long terme et le reporting historique ?
- Modèle de permissions : table dédiée `user_permissions` vs champ JSON sur l'utilisateur ?
- Politique de reconnexion / outbox côté client : taille de la file d'attente hors-ligne, ordre de rejoue des événements en cas de conflit.
- Stratégie de résolution de conflit (§6.2) : dernier écrit gagne, ou arbitrage manuel patron ?
- Granularité de la validation serveur (§6.3) : recalcul complet de l'écart côté DO, ou simple contrôle de cohérence sur les totaux déclarés ?
