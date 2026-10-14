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

export async function modifierMouvement(data: {
  id: string;
  type: MouvementCaisse["type"];
  montant: number;
  motif?: string;
}): Promise<MouvementCaisse | null> {
  return await MouvementCaisseModel.update(data.id, {
    type: data.type,
    montant: data.montant,
    motif: data.motif ?? null,
  });
}

export async function supprimerMouvement(id: string): Promise<void> {
  await MouvementCaisseModel.delete(id);
}

/**
 * Applique un mouvement de caisse reçu depuis un autre terminal en temps réel.
 * Idempotent.
 */
export async function ajouterMouvementDistant(data: {
  id: string;
  session_id: string;
  type: MouvementCaisse["type"];
  montant: number;
  motif?: string;
  utilisateur_id: string;
  date: string;
}): Promise<MouvementCaisse | null> {
  const existant = await MouvementCaisseModel.findById(data.id);
  if (existant) return existant;
  return await MouvementCaisseModel.create(data);
}

