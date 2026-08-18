import { Etablissement, EtablissementModel } from "./db";

const SINGLETON_ID = "main";

export async function createTable() {
  await EtablissementModel.createTable();
  try {
    await EtablissementModel.orm.run(
      "ALTER TABLE etablissement ADD COLUMN commande_temps_reel_active INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // colonne déjà présente
  }
  try {
    await EtablissementModel.orm.run("ALTER TABLE etablissement ADD COLUMN server_id TEXT");
  } catch {
    // colonne déjà présente
  }
}

export async function get(): Promise<Etablissement | null> {
  return await EtablissementModel.findById(SINGLETON_ID);
}

export async function save(data: Omit<Etablissement, "id">): Promise<Etablissement> {
  return await EtablissementModel.upsert({ id: SINGLETON_ID, ...data });
}

export async function lierServeur(server_id: string): Promise<Etablissement | null> {
  return await EtablissementModel.update(SINGLETON_ID, { server_id });
}
