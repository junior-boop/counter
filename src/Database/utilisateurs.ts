import { Utilisateur, UtilisateurModel } from "./db";
import { generateUUID } from "./uuid";

export async function createTable() {
  return await UtilisateurModel.createTable();
}

export async function getall(): Promise<Utilisateur[]> {
  return await UtilisateurModel.findAll();
}

export async function created(data: Omit<Utilisateur, "id">): Promise<Utilisateur> {
  return await UtilisateurModel.create({ id: generateUUID(), ...data });
}

export async function updated(data: Utilisateur): Promise<Utilisateur | null> {
  const { id, ...rest } = data;
  return await UtilisateurModel.update(id, rest);
}

export async function deleted(id: string): Promise<boolean> {
  return await UtilisateurModel.delete(id);
}
