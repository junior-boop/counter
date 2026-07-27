import { Commande, CommandeModel, LigneCommande, LigneCommandeModel, MouvementCaisseModel, MouvementStockModel, Produit, ProduitModel, SessionCaisseModel } from "./db";
import { sessionOuvertePour } from "./stock";
import { generateUUID } from "./uuid";

/**
 * Sort du stock les produits d'une commande.
 *
 * Une commande n'a de sens côté stock que s'il existe une session de stock
 * ouverte pour la même activité : sans inventaire d'ouverture il n'y a pas de
 * quantité de référence, donc rien à décrémenter. Dans ce cas on enregistre la
 * commande en caisse sans toucher au stock (la vente reste tracée en caisse).
 */
async function appliquerVentes(data: {
  commande_id: string;
  session_caisse_id: string;
  utilisateur_id: string;
  lignes: { produit: Produit; quantite: number }[];
  date: string;
}): Promise<void> {
  const caisse = await SessionCaisseModel.findById(data.session_caisse_id);
  if (!caisse) return;

  const sessionStock = await sessionOuvertePour(caisse.type_activite);
  if (!sessionStock) return;

  for (const ligne of data.lignes) {
    const produit = await ProduitModel.findById(ligne.produit.id);
    if (!produit) continue;

    // Volontairement pas de clamp à 0 : un stock théorique négatif signifie
    // qu'on a vendu plus que ce qui a été compté à l'ouverture. C'est
    // exactement l'anomalie que l'app doit faire remonter, pas la masquer.
    await ProduitModel.update(produit.id, { stock_actuel: (produit.stock_actuel ?? 0) - ligne.quantite });

    await MouvementStockModel.create({
      id: generateUUID(),
      session_id: sessionStock.id,
      produit_id: produit.id,
      type: "vente",
      quantite: ligne.quantite,
      ecart: null,
      categorie_perte: null,
      motif: null,
      utilisateur_id: data.utilisateur_id,
      date: data.date,
      commande_id: data.commande_id,
    });
  }
}

/** Remet en stock ce qu'une commande avait sorti, et efface ses mouvements `vente`. */
async function annulerVentes(commande_id: string): Promise<void> {
  const mouvements = await MouvementStockModel.findAll({ where: { commande_id, type: "vente" } });

  for (const mouvement of mouvements) {
    const produit = await ProduitModel.findById(mouvement.produit_id);
    if (produit) {
      await ProduitModel.update(produit.id, { stock_actuel: (produit.stock_actuel ?? 0) + mouvement.quantite });
    }
    await MouvementStockModel.delete(mouvement.id);
  }
}

export async function createTable() {
  await CommandeModel.createTable();
  await LigneCommandeModel.createTable();
}

export async function getAllCommandes(): Promise<Commande[]> {
  return await CommandeModel.findAll();
}

export async function getAllLignesCommande(): Promise<LigneCommande[]> {
  return await LigneCommandeModel.findAll();
}

export async function passerCommande(data: {
  session_id: string;
  utilisateur_id: string;
  lignes: { produit: Produit; quantite: number }[];
}): Promise<Commande> {
  const montant_total = data.lignes.reduce((sum, l) => sum + l.produit.prix * l.quantite, 0);
  const date = new Date().toISOString();

  const commande = await CommandeModel.create({
    id: generateUUID(),
    session_id: data.session_id,
    utilisateur_id: data.utilisateur_id,
    date,
    montant_total,
  });

  for (const ligne of data.lignes) {
    await LigneCommandeModel.create({
      id: generateUUID(),
      commande_id: commande.id,
      produit_id: ligne.produit.id,
      produit_nom: ligne.produit.nom,
      prix_unitaire: ligne.produit.prix,
      quantite: ligne.quantite,
    });
  }

  await MouvementCaisseModel.create({
    id: generateUUID(),
    session_id: data.session_id,
    type: "entree",
    montant: montant_total,
    motif: `Commande (${data.lignes.length} article${data.lignes.length > 1 ? "s" : ""})`,
    utilisateur_id: data.utilisateur_id,
    date,
    commande_id: commande.id,
  });

  await appliquerVentes({
    commande_id: commande.id,
    session_caisse_id: data.session_id,
    utilisateur_id: data.utilisateur_id,
    lignes: data.lignes,
    date,
  });

  return commande;
}

export async function modifierCommande(data: {
  commande_id: string;
  lignes: { produit: Produit; quantite: number }[];
}): Promise<void> {
  const montant_total = data.lignes.reduce((sum, l) => sum + l.produit.prix * l.quantite, 0);

  await LigneCommandeModel.deleteWhere({ commande_id: data.commande_id });
  for (const ligne of data.lignes) {
    await LigneCommandeModel.create({
      id: generateUUID(),
      commande_id: data.commande_id,
      produit_id: ligne.produit.id,
      produit_nom: ligne.produit.nom,
      prix_unitaire: ligne.produit.prix,
      quantite: ligne.quantite,
    });
  }

  await CommandeModel.update(data.commande_id, { montant_total });
  await MouvementCaisseModel.updateWhere(
    { commande_id: data.commande_id },
    { montant: montant_total, motif: `Commande (${data.lignes.length} article${data.lignes.length > 1 ? "s" : ""})` }
  );

  // On rejoue la sortie de stock au lieu de calculer un delta ligne à ligne :
  // les lignes sont de toute façon supprimées puis recréées juste au-dessus.
  const commande = await CommandeModel.findById(data.commande_id);
  await annulerVentes(data.commande_id);
  if (commande) {
    await appliquerVentes({
      commande_id: commande.id,
      session_caisse_id: commande.session_id,
      utilisateur_id: commande.utilisateur_id,
      lignes: data.lignes,
      date: new Date().toISOString(),
    });
  }
}

export async function supprimerCommande(commande_id: string): Promise<void> {
  await annulerVentes(commande_id);
  await LigneCommandeModel.deleteWhere({ commande_id });
  await MouvementCaisseModel.deleteWhere({ commande_id });
  await CommandeModel.delete(commande_id);
}
