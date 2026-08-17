import { CommandeModel, MouvementCaisseModel, MouvementStockModel, Rapport, RapportModel, SessionCaisse } from "./db";
import { generateUUID } from "./uuid";

export async function createTable() {
  await RapportModel.createTable();
}

export async function getAllRapports(): Promise<Rapport[]> {
  return await RapportModel.findAll();
}

/**
 * Génère (ou retourne, si déjà existant) le rapport d'une session de caisse
 * fermée. Les mouvements de stock sont rattachés à une `SessionStock`, un
 * cycle indépendant de `SessionCaisse` (voir session/[id].tsx) : ils sont
 * donc corrélés par fenêtre de dates plutôt que par session_id.
 */
export async function genererRapportPourSession(session: SessionCaisse): Promise<Rapport> {
  const existant = (await RapportModel.findAll({ where: { session_caisse_id: session.id } }))[0];
  if (existant) return existant;

  const mouvementsCaisse = await MouvementCaisseModel.findAll({ where: { session_id: session.id } });
  const commandes = await CommandeModel.findAll({ where: { session_id: session.id } });
  const finFenetre = session.date_fermeture ?? new Date().toISOString();
  const mouvementsStock = (await MouvementStockModel.findAll())
    .filter((m) => m.date >= session.date_ouverture && m.date <= finFenetre);

  const mouvementsNonCommande = mouvementsCaisse.filter((m) => !m.commande_id);
  const total_entrees = mouvementsNonCommande.filter((m) => m.type === "entree").reduce((s, m) => s + m.montant, 0);
  const total_sorties = mouvementsNonCommande.filter((m) => m.type === "sortie").reduce((s, m) => s + m.montant, 0);
  const montant_reappro = mouvementsNonCommande
    .filter((m) => m.type === "sortie" && m.motif === "Réapprovisionnement stock")
    .reduce((s, m) => s + m.montant, 0);

  const rapport: Rapport = {
    id: generateUUID(),
    session_caisse_id: session.id,
    date_generation: new Date().toISOString(),
    total_entrees,
    total_sorties,
    montant_reappro,
    nombre_reappro: mouvementsStock.filter((m) => m.type === "reapprovisionnement").length,
    nombre_commandes: commandes.length,
    montant_commandes: commandes.reduce((s, c) => s + c.montant_total, 0),
    quantite_perdue: mouvementsStock.filter((m) => m.type === "perte").reduce((s, m) => s + m.quantite, 0),
    nombre_ecarts_inventaire: mouvementsStock.filter(
      (m) => (m.type === "inventaire_ouverture" || m.type === "inventaire_fermeture") && m.ecart != null && m.ecart !== 0
    ).length,
  };
  await RapportModel.create(rapport);
  return rapport;
}
