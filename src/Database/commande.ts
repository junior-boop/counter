import { Commande, CommandeModel, LigneCommande, LigneCommandeModel, MouvementCaisseModel, Produit } from "./db";
import { generateUUID } from "./uuid";

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
}

export async function supprimerCommande(commande_id: string): Promise<void> {
  await LigneCommandeModel.deleteWhere({ commande_id });
  await MouvementCaisseModel.deleteWhere({ commande_id });
  await CommandeModel.delete(commande_id);
}
