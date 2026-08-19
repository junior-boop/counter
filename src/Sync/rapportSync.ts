import * as EtablissementDb from "../Database/etablissement";
import * as RapportDb from "../Database/rapport";
import { Rapport, SessionCaisse, SessionCaisseModel } from "../Database/db";
import { api } from "../lib/api";
import { getDeviceToken } from "./deviceToken";

export async function pousserRapport(rapport: Rapport, session: SessionCaisse, serverId: string | null | undefined): Promise<void> {
  if (!serverId) return;

  try {
    const deviceToken = await getDeviceToken();
    if (!deviceToken) return;

    await api.post(
      "/rapports",
      {
        session_caisse_id: rapport.session_caisse_id,
        local_rapport_id: rapport.id,
        date_generation: rapport.date_generation,
        total_entrees: rapport.total_entrees,
        total_sorties: rapport.total_sorties,
        montant_reappro: rapport.montant_reappro,
        nombre_reappro: rapport.nombre_reappro,
        nombre_commandes: rapport.nombre_commandes,
        montant_commandes: rapport.montant_commandes,
        quantite_perdue: rapport.quantite_perdue,
        nombre_ecarts_inventaire: rapport.nombre_ecarts_inventaire,
        session_date_ouverture: session.date_ouverture,
        session_date_fermeture: session.date_fermeture ?? null,
        montant_ouverture: session.montant_ouverture,
        montant_fermeture: session.montant_fermeture ?? null,
        ecart: session.ecart ?? null,
      },
      deviceToken
    );

    await RapportDb.marquerSynchronise(rapport.id);
  } catch (error) {
    console.warn("Échec de la synchronisation du rapport avec le serveur patron", error);
  }
}

/**
 * Retente l'envoi des rapports jamais parvenus au serveur (clôture faite hors-ligne).
 * Best-effort, appelée au démarrage de l'app — ne bloque jamais l'utilisateur.
 */
export async function retentativeRapportsNonSynces(): Promise<void> {
  try {
    const etablissement = await EtablissementDb.get();
    if (!etablissement?.server_id) return;

    const rapportsNonSynces = await RapportDb.getRapportsNonSynces();
    for (const rapport of rapportsNonSynces) {
      const session = await SessionCaisseModel.findById(rapport.session_caisse_id);
      if (!session) continue;
      await pousserRapport(rapport, session, etablissement.server_id);
    }
  } catch (error) {
    console.warn("Échec de la retentative de synchronisation des rapports", error);
  }
}
