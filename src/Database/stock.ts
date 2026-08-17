import { Categorie, CategorieModel, CategoriePerte, MouvementStock, MouvementStockModel, Produit, ProduitActif, ProduitActifModel, ProduitModel, SessionStock, SessionStockModel, TypeActivite, TypeMouvementStock } from "./db";
import { generateUUID } from "./uuid";

const DUREE_INACTIVITE_MS = 14 * 24 * 60 * 60 * 1000; // 2 semaines

export async function createTable() {
  await SessionStockModel.createTable();
  await MouvementStockModel.createTable();
  await ProduitActifModel.createTable();
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
  try {
    await CategorieModel.orm.run("ALTER TABLE categories ADD COLUMN seuil_alerte REAL");
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
  if (data.type === "reapprovisionnement") await marquerProduitActif(data.produit_id);

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

export async function modifierMouvement(data: {
  id: string;
  quantite: number;
  categorie_perte?: CategoriePerte;
  motif?: string;
}): Promise<MouvementStock | null> {
  const mouvement = await MouvementStockModel.findById(data.id);
  if (!mouvement) return null;

  const produit = await ProduitModel.findById(mouvement.produit_id);
  if (produit) {
    const stockActuel = produit.stock_actuel ?? 0;
    const stockSansAncienMouvement = mouvement.type === "reapprovisionnement"
      ? stockActuel - mouvement.quantite
      : stockActuel + mouvement.quantite;
    const nouveauStock = mouvement.type === "reapprovisionnement"
      ? stockSansAncienMouvement + data.quantite
      : Math.max(0, stockSansAncienMouvement - data.quantite);
    await ProduitModel.update(mouvement.produit_id, { stock_actuel: nouveauStock });
    if (mouvement.type === "reapprovisionnement") await marquerProduitActif(mouvement.produit_id);
  }

  return await MouvementStockModel.update(data.id, {
    quantite: data.quantite,
    categorie_perte: mouvement.type === "perte" ? data.categorie_perte ?? mouvement.categorie_perte ?? null : null,
    motif: data.motif ?? null,
  });
}

export async function supprimerMouvement(id: string): Promise<void> {
  const mouvement = await MouvementStockModel.findById(id);
  if (!mouvement) return;

  const produit = await ProduitModel.findById(mouvement.produit_id);
  if (produit) {
    const stockActuel = produit.stock_actuel ?? 0;
    const nouveauStock = mouvement.type === "reapprovisionnement"
      ? Math.max(0, stockActuel - mouvement.quantite)
      : stockActuel + mouvement.quantite;
    await ProduitModel.update(mouvement.produit_id, { stock_actuel: nouveauStock });
  }

  await MouvementStockModel.delete(id);
}

export async function modifierSeuilAlerte(produit_id: string, seuil_alerte: number | null) {
  return await ProduitModel.update(produit_id, { seuil_alerte });
}

export async function modifierSeuilAlerteCategorie(categorie_id: string, seuil_alerte: number | null) {
  return await CategorieModel.update(categorie_id, { seuil_alerte });
}

/** Seuil produit prioritaire, sinon celui de la catégorie, sinon pas d'alerte. */
export function seuilEffectif(produit: Produit, categorie: Categorie | null): number | null {
  return produit.seuil_alerte ?? categorie?.seuil_alerte ?? null;
}

export function estStockBas(produit: Produit, categorie: Categorie | null): boolean {
  const seuil = seuilEffectif(produit, categorie);
  return seuil != null && (produit.stock_actuel ?? 0) <= seuil;
}

const TYPES_MOUVEMENT_SUIVI: readonly TypeMouvementStock[] = ["reapprovisionnement", "inventaire_ouverture", "inventaire_fermeture"];

/**
 * Un produit est "suivi" dès qu'il a déjà été compté en inventaire ou
 * réapprovisionné au moins une fois, tous historiques confondus. Signal
 * indépendant de stock_actuel (initialisé à 0 dès la création du produit,
 * donc jamais null — inutilisable pour distinguer "jamais suivi" de "à 0")
 * et de la session en cours (contrairement à l'éligibilité de recomptage
 * utilisée en fermeture d'inventaire, volontairement scopée à la session).
 */
export function produitsDejaSuivis(mouvements: MouvementStock[]): Set<string> {
  const suivis = new Set<string>();
  for (const m of mouvements) {
    if (TYPES_MOUVEMENT_SUIVI.includes(m.type)) suivis.add(m.produit_id);
  }
  return suivis;
}

/** Marque un produit comme réapprovisionné récemment (voir `ProduitActif`). */
export async function marquerProduitActif(produit_id: string): Promise<void> {
  const derniere_activite = new Date().toISOString();
  const existant = await ProduitActifModel.findById(produit_id);
  if (existant) {
    await ProduitActifModel.update(produit_id, { derniere_activite });
  } else {
    await ProduitActifModel.create({ id: produit_id, derniere_activite });
  }
}

export async function getProduitsActifs(): Promise<ProduitActif[]> {
  return await ProduitActifModel.findAll();
}

/**
 * Amorce le cache `produits_actifs` s'il est vide (ex : premier lancement
 * après l'ajout de cette fonctionnalité) avec les produits ayant déjà un
 * stock, pour ne pas masquer un produit existant simplement parce qu'il n'a
 * jamais généré de mouvement de réapprovisionnement.
 */
export async function initialiserProduitsActifsSiVide(): Promise<void> {
  const actifs = await ProduitActifModel.findAll();
  if (actifs.length > 0) return;
  const produits = await ProduitModel.findAll();
  const derniere_activite = new Date().toISOString();
  for (const produit of produits) {
    if ((produit.stock_actuel ?? 0) > 0) {
      await ProduitActifModel.create({ id: produit.id, derniere_activite });
    }
  }
}

/**
 * Retire de la liste des "produits actifs" ceux qui n'ont pas été
 * réapprovisionnés depuis 2 semaines. Appelé à l'ouverture de l'app et par
 * la tâche en arrière-plan `purge-produits-inactifs` (`src/lib/backgroundTasks.ts`).
 */
export async function purgerProduitsInactifs(): Promise<number> {
  const seuil = Date.now() - DUREE_INACTIVITE_MS;
  const actifs = await ProduitActifModel.findAll();
  let purges = 0;
  for (const actif of actifs) {
    if (new Date(actif.derniere_activite).getTime() < seuil) {
      await ProduitActifModel.delete(actif.id);
      purges++;
    }
  }
  return purges;
}
