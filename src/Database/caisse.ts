import { MouvementCaisse, MouvementCaisseModel, SessionCaisse, SessionCaisseModel, TypeActivite } from "./db";
import { generateUUID } from "./uuid";

export async function createTable() {
  await SessionCaisseModel.createTable();
  await MouvementCaisseModel.createTable();
}

export async function getAllSessions(): Promise<SessionCaisse[]> {
  return await SessionCaisseModel.findAll();
}

export async function getAllMouvements(): Promise<MouvementCaisse[]> {
  return await MouvementCaisseModel.findAll();
}

export async function ouvrirSession(data: {
  type_activite: TypeActivite;
  montant_ouverture: number;
  utilisateur_ouverture_id: string;
}): Promise<SessionCaisse> {
  return await SessionCaisseModel.create({
    id: generateUUID(),
    type_activite: data.type_activite,
    date_ouverture: new Date().toISOString(),
    montant_ouverture: data.montant_ouverture,
    statut: "ouverte",
    utilisateur_ouverture_id: data.utilisateur_ouverture_id,
  });
}

export async function fermerSession(data: {
  id: string;
  montant_fermeture: number;
  ecart: number;
  utilisateur_fermeture_id: string;
}): Promise<SessionCaisse | null> {
  return await SessionCaisseModel.update(data.id, {
    montant_fermeture: data.montant_fermeture,
    date_fermeture: new Date().toISOString(),
    ecart: data.ecart,
    statut: "fermee",
    utilisateur_fermeture_id: data.utilisateur_fermeture_id,
  });
}

export async function ajouterMouvement(data: {
  session_id: string;
  type: MouvementCaisse["type"];
  montant: number;
  motif?: string;
  utilisateur_id: string;
}): Promise<MouvementCaisse> {
  return await MouvementCaisseModel.create({
    id: generateUUID(),
    date: new Date().toISOString(),
    ...data,
  });
}
