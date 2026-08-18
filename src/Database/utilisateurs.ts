import { Utilisateur, UtilisateurModel } from "./db";
import { generateUUID } from "./uuid";

export async function createTable() {
  await UtilisateurModel.createTable();
  for (const colonne of [
    "telephone TEXT",
    "server_employe_id TEXT",
    "password_verifier TEXT",
    "password_salt_local TEXT",
    "password_synced_version TEXT",
  ]) {
    try {
      await UtilisateurModel.orm.run(`ALTER TABLE utilisateurs ADD COLUMN ${colonne}`);
    } catch {
      // colonne déjà présente
    }
  }
  try {
    await UtilisateurModel.orm.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_utilisateurs_telephone ON utilisateurs(telephone)"
    );
  } catch {
    // index déjà présent
  }
}

export async function getall(): Promise<Utilisateur[]> {
  return await UtilisateurModel.findAll();
}

export async function findByTelephone(telephone: string): Promise<Utilisateur | null> {
  return await UtilisateurModel.findOne({ where: { telephone } });
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
