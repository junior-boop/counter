import { CommandeModel, MouvementCaisseModel, MouvementStockModel, ProduitModel, Rapport, RapportModel, SessionCaisse } from "./db";
import { RapportDetails } from "../lib/rapportDetails";
import { generateUUID } from "./uuid";

export async function createTable() {
  await RapportModel.createTable();
  try {
    await RapportModel.orm.run("ALTER TABLE rapports ADD COLUMN synced_at_server TEXT");
  } catch {
    // colonne déjà présente
  }
  try {
    await RapportModel.orm.run("ALTER TABLE rapports ADD COLUMN details TEXT");
  } catch {
    // colonne déjà présente
  }
}

export async function getAllRapports(): Promise<Rapport[]> {
  return await RapportModel.findAll();
}

export async function getRapportsNonSynces(): Promise<Rapport[]> {
  return (await RapportModel.findAll()).filter((r) => !r.synced_at_server);
}

export async function marquerSynchronise(id: string): Promise<void> {
  await RapportModel.update(id, { synced_at_server: new Date().toISOString() });
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

  const pertes = mouvementsStock.filter((m) => m.type === "perte");
  const ecarts = mouvementsStock.filter(
    (m) => (m.type === "inventaire_ouverture" || m.type === "inventaire_fermeture") && m.ecart != null && m.ecart !== 0
  );
  // Résolus une seule fois pour tous les produits impliqués : le rapport patron
  // n'a pas accès à la base locale, le nom doit donc être figé dans le JSON.
  const produits = await ProduitModel.findAll();
  const nomProduit = (produit_id: string) => produits.find((p) => p.id === produit_id)?.nom ?? "Produit";

  const details: RapportDetails = {
    commandes: commandes.map((c) => ({ date: c.date, montant_total: c.montant_total })),
    mouvementsCaisse: mouvementsNonCommande.map((m) => ({ type: m.type as "entree" | "sortie", montant: m.montant, motif: m.motif ?? null, date: m.date })),
    pertes: pertes.map((m) => ({ produit_nom: nomProduit(m.produit_id), quantite: m.quantite, categorie_perte: m.categorie_perte ?? null })),
    ecarts: ecarts.map((m) => ({ produit_nom: nomProduit(m.produit_id), ecart: m.ecart ?? 0 })),
  };

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
    quantite_perdue: pertes.reduce((s, m) => s + m.quantite, 0),
    nombre_ecarts_inventaire: ecarts.length,
    details: JSON.stringify(details),
  };
  await RapportModel.create(rapport);
  return rapport;
}
