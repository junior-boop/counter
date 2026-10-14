import { WS_URL } from "../lib/api";
import { appliquerCommandeDistante } from "../Database/commande";
import { ajouterMouvementDistant } from "../Database/caisse";
import { appliquerMouvementStockDistant } from "../Database/stock";
import { SessionCaisseModel } from "../Database/db";

export type RealtimeEventType =
  | "ORDER_CREATED"
  | "CASH_MOVEMENT"
  | "STOCK_MOVEMENT"
  | "SESSION_OPENED"
  | "SESSION_CLOSED"
  | "REPORT_GENERATED"
  | "SNAPSHOT_REQUEST";

interface RealtimeConfig {
  etablissementId: string;
  token: string;
  nom?: string;
  onRefresh: (tables: readonly string[]) => Promise<void>;
}

let activeSocket: WebSocket | null = null;
let activeConfig: RealtimeConfig | null = null;
let reconnectTimer: any = null;
let shouldReconnect = true;
let lastSequence: number | null = null;
const outboxQueue: Array<{ eventId: string; type: RealtimeEventType; payload: any; timestamp: string }> = [];

/**
 * Initialise la connexion WebSocket en temps réel pour l'établissement.
 * Modèle "WhatsApp" : chaque terminal connecté reçoit et applique immédiatement
 * les modifications en SQLite local.
 */
export function initRealtimeSync(config: RealtimeConfig): () => void {
  activeConfig = config;
  shouldReconnect = true;
  connectWebSocket();

  return () => {
    stopRealtimeSync();
  };
}

export function stopRealtimeSync(): void {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeSocket) {
    try {
      activeSocket.close();
    } catch {
      // Ignorer si déjà fermé
    }
    activeSocket = null;
  }
  activeConfig = null;
}

function connectWebSocket(): void {
  if (!activeConfig || !shouldReconnect) return;

  const { etablissementId, token, nom } = activeConfig;
  let url = `${WS_URL}/etablissements/${encodeURIComponent(etablissementId)}/ws?token=${encodeURIComponent(token)}`;
  if (nom) {
    url += `&nom=${encodeURIComponent(nom)}`;
  }
  if (lastSequence !== null) {
    url += `&lastSeenSequence=${lastSequence}`;
  }

  try {
    const ws = new WebSocket(url);
    activeSocket = ws;

    ws.onopen = () => {
      // Vider la file d'attente hors-ligne (Outbox) dès le retour de la connexion
      flushOutbox();
    };

    ws.onmessage = async (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : "";
        if (!raw) return;

        const message = JSON.parse(raw);
        if (message.sequence !== undefined) {
          lastSequence = message.sequence;
        }

        await handleIncomingEvent(message);
      } catch (err) {
        console.warn("[RealtimeSync] Erreur traitement message entrant:", err);
      }
    };

    ws.onclose = () => {
      activeSocket = null;
      if (shouldReconnect) {
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // Ignorer
      }
    };
  } catch (err) {
    console.warn("[RealtimeSync] Impossible d'ouvrir le WebSocket:", err);
    if (shouldReconnect) {
      reconnectTimer = setTimeout(connectWebSocket, 5000);
    }
  }
}

/**
 * Traite un événement reçu en temps réel et l'applique dans la base SQLite locale.
 */
async function handleIncomingEvent(message: any): Promise<void> {
  if (!activeConfig) return;
  const { onRefresh } = activeConfig;
  const { type, payload } = message;

  switch (type) {
    case "ORDER_CREATED": {
      if (!payload?.orderId) return;
      await appliquerCommandeDistante({
        orderId: payload.orderId,
        sessionId: payload.sessionId || "",
        userId: payload.employeId || payload.userId || "",
        date: payload.date || new Date().toISOString(),
        montantTotal: Number(payload.montantTotal) || 0,
        modePaiement: payload.modePaiement,
        lignes: payload.lignes || [],
      });
      await onRefresh(["commandes", "lignesCommande", "mouvementsCaisse", "mouvementsStock", "produits"]);
      break;
    }

    case "CASH_MOVEMENT": {
      if (!payload?.movementId) return;
      await ajouterMouvementDistant({
        id: payload.movementId,
        session_id: payload.sessionId || "",
        type: payload.type,
        montant: Number(payload.montant) || 0,
        motif: payload.motif,
        utilisateur_id: payload.employeId || payload.userId || "",
        date: payload.date || new Date().toISOString(),
      });
      await onRefresh(["mouvementsCaisse"]);
      break;
    }

    case "STOCK_MOVEMENT": {
      if (!payload?.movementId || !payload?.produitId) return;
      await appliquerMouvementStockDistant({
        id: payload.movementId,
        session_id: payload.sessionId,
        produit_id: payload.produitId,
        type: payload.type,
        quantite: Number(payload.quantite) || 0,
        categorie_perte: payload.categoriePerte,
        motif: payload.motif,
        utilisateur_id: payload.utilisateurId,
        date: payload.date || new Date().toISOString(),
      });
      await onRefresh(["mouvementsStock", "produits", "produitsActifs"]);
      break;
    }

    case "SESSION_OPENED": {
      if (!payload?.sessionId) return;
      const existante = await SessionCaisseModel.findById(payload.sessionId);
      if (!existante) {
        await SessionCaisseModel.create({
          id: payload.sessionId,
          type_activite: payload.type_activite || "bar",
          date_ouverture: payload.dateOuverture || new Date().toISOString(),
          montant_ouverture: Number(payload.fondDeCaisse) || 0,
          statut: "ouverte",
          utilisateur_ouverture_id: payload.ouvertPar?.userId || "",
        });
        await onRefresh(["sessionsCaisse"]);
      }
      break;
    }

    case "SESSION_CLOSED": {
      if (!payload?.sessionId) return;
      await SessionCaisseModel.update(payload.sessionId, {
        statut: "fermee",
        date_fermeture: payload.dateFermeture || new Date().toISOString(),
        montant_fermeture: Number(payload.montantFermeture) || 0,
        ecart: payload.ecart !== undefined ? Number(payload.ecart) : null,
        utilisateur_fermeture_id: payload.fermePar?.userId || "",
      });
      await onRefresh(["sessionsCaisse"]);
      break;
    }

    case "SNAPSHOT_RESPONSE": {
      // Snapshot reçu à la connexion : facultatif si local-first SQLite est déjà peuplé
      break;
    }

    default:
      break;
  }
}

/**
 * Émet un événement local vers le serveur WebSocket pour diffusion aux collègues.
 * Pattern Outbox : si déconnecté, met en file d'attente et envoie dès retour du réseau.
 */
export function broadcastRealtimeEvent(type: RealtimeEventType, payload: any): void {
  const event = {
    eventId: payload?.movementId || payload?.orderId || payload?.sessionId || crypto.randomUUID(),
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
    try {
      activeSocket.send(JSON.stringify(event));
      return;
    } catch {
      // Échec envoi, mise en file d'attente
    }
  }

  // Stocker dans la file d'attente hors-ligne (limité à 100 événements)
  outboxQueue.push(event);
  if (outboxQueue.length > 100) {
    outboxQueue.shift();
  }
}

function flushOutbox(): void {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;

  while (outboxQueue.length > 0) {
    const item = outboxQueue.shift();
    if (!item) break;
    try {
      activeSocket.send(JSON.stringify(item));
    } catch {
      // Remettre au début en cas d'erreur
      outboxQueue.unshift(item);
      break;
    }
  }
}
