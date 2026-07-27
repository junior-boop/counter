import { CategoriePerte, MouvementStock, MouvementStockModel, ProduitModel, SessionStock, SessionStockModel, TypeActivite, TypeMouvementStock } from "./db";
import { generateUUID } from "./uuid";

export async function createTable() {
  await SessionStockModel.createTable();
  await MouvementStockModel.createTable();
  try {
    await ProduitModel.orm.run("ALTER TABLE produits ADD COLUMN stock_actuel REAL NOT NULL DEFAULT 0");
  } catch {
    // colonne déjà présente
  }
  try {
    await ProduitModel.orm.run("ALTER TABLE produits ADD COLUMN seuil_alerte REAL");
  } catch {
    // colonne déjà présente
  }
  try {
    await MouvementStockModel.orm.run("ALTER TABLE mouvements_stock ADD COLUMN session_id TEXT NOT NULL DEFAULT ''");
  } catch {
    // colonne déjà présente
  }
  try {
    await MouvementStockModel.orm.run("ALTER TABLE mouvements_stock ADD COLUMN ecart REAL");
  } catch {
    // colonne déjà présente
  }
  try {
    await MouvementStockModel.orm.run("ALTER TABLE mouvements_stock ADD COLUMN commande_id TEXT");
  } catch {
    // colonne déjà présente
  }
}

/**
 * Session de stock actuellement ouverte pour une activité.
 * Les commandes sont rattachées à une session de *caisse* ; c'est ce point de
 * jonction qui permet de retrouver le stock du jour à décrémenter.
 */
export async function sessionOuvertePour(type_activite: TypeActivite): Promise<SessionStock | null> {
  const sessions = await SessionStockModel.findAll({ where: { type_activite, statut: "ouverte" } });
  return sessions.sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0] ?? null;
}

export async function getAllSessions(): Promise<SessionStock[]> {
  return await SessionStockModel.findAll();
}

export async function getAllMouvements(): Promise<MouvementStock[]> {
  return await MouvementStockModel.findAll();
}

export async function ouvrirSession(data: {
  type_activite: TypeActivite;
  utilisateur_ouverture_id: string;
  comptages: { produit_id: string; quantite: number }[];
}): Promise<SessionStock> {
  const session = await SessionStockModel.create({
    id: generateUUID(),
    type_activite: data.type_activite,
    date_ouverture: new Date().toISOString(),
    statut: "ouverte",
    utilisateur_ouverture_id: data.utilisateur_ouverture_id,
  });

  for (const comptage of data.comptages) {
    await ProduitModel.update(comptage.produit_id, { stock_actuel: comptage.quantite });
    await MouvementStockModel.create({
      id: generateUUID(),
      session_id: session.id,
      produit_id: comptage.produit_id,
      type: "inventaire_ouverture",
      quantite: comptage.quantite,
      categorie_perte: null,
      motif: null,
      utilisateur_id: data.utilisateur_ouverture_id,
      date: session.date_ouverture,
    });
  }

  return session;
}

export async function fermerSession(data: {
  id: string;
  utilisateur_fermeture_id: string;
  comptages: { produit_id: string; quantite: number }[];
}): Promise<SessionStock | null> {
  const date = new Date().toISOString();

  for (const comptage of data.comptages) {
    const produit = await ProduitModel.findById(comptage.produit_id);
    const stockTheorique = produit?.stock_actuel ?? 0;
    const ecart = comptage.quantite - stockTheorique;

    await ProduitModel.update(comptage.produit_id, { stock_actuel: comptage.quantite });
    await MouvementStockModel.create({
      id: generateUUID(),
      session_id: data.id,
      produit_id: comptage.produit_id,
      type: "inventaire_fermeture",
      quantite: comptage.quantite,
      ecart,
      categorie_perte: null,
      motif: null,
      utilisateur_id: data.utilisateur_fermeture_id,
      date,
    });
  }

  return await SessionStockModel.update(data.id, {
    date_fermeture: date,
    statut: "fermee",
    utilisateur_fermeture_id: data.utilisateur_fermeture_id,
  });
}

export async function ajouterMouvement(data: {
  session_id: string;
  produit_id: string;
  type: TypeMouvementStock;
  quantite: number;
  categorie_perte?: CategoriePerte;
  motif?: string;
  utilisateur_id: string;
}): Promise<MouvementStock> {
  const produit = await ProduitModel.findById(data.produit_id);
  if (!produit) throw new Error("Produit introuvable");

  const stockActuel = produit.stock_actuel ?? 0;
  const nouveauStock = data.type === "reapprovisionnement"
    ? stockActuel + data.quantite
    : Math.max(0, stockActuel - data.quantite);

  await ProduitModel.update(data.produit_id, { stock_actuel: nouveauStock });

  return await MouvementStockModel.create({
    id: generateUUID(),
    session_id: data.session_id,
    produit_id: data.produit_id,
    type: data.type,
    quantite: data.quantite,
    categorie_perte: data.type === "perte" ? data.categorie_perte ?? null : null,
    motif: data.motif ?? null,
    utilisateur_id: data.utilisateur_id,
    date: new Date().toISOString(),
  });
}

export async function modifierSeuilAlerte(produit_id: string, seuil_alerte: number | null) {
  return await ProduitModel.update(produit_id, { seuil_alerte });
}
