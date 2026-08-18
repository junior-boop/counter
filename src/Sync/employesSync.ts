import * as Utilisateurs from "../Database/utilisateurs";
import { api } from "../lib/api";
import { getDeviceToken } from "./deviceToken";
import { ServerEmploye } from "./serverTypes";

export async function synchroniserEmployes(serverId?: string | null): Promise<void> {
  if (!serverId) return;

  try {
    const deviceToken = await getDeviceToken();
    if (!deviceToken) return;

    const distants = await api.get<ServerEmploye[]>("/device/employes", deviceToken);
    const locaux = await Utilisateurs.getall();
    const idsDistants = new Set(distants.map((e) => e.id));

    for (const employe of distants) {
      const existant = locaux.find((u) => u.server_employe_id === employe.id);
      if (!existant) {
        await Utilisateurs.created({
          nom: employe.nom,
          code: employe.telephone,
          role: employe.role,
          telephone: employe.telephone,
          server_employe_id: employe.id,
          password_verifier: null,
          password_salt_local: null,
          password_synced_version: null,
        });
        continue;
      }

      const motDePasseChange = existant.password_synced_version !== employe.password_updated_at;
      await Utilisateurs.updated({
        ...existant,
        nom: employe.nom,
        code: employe.telephone,
        role: employe.role,
        telephone: employe.telephone,
        ...(motDePasseChange
          ? { password_verifier: null, password_salt_local: null, password_synced_version: null }
          : {}),
      });
    }

    for (const local of locaux) {
      if (local.server_employe_id && !idsDistants.has(local.server_employe_id)) {
        await Utilisateurs.deleted(local.id);
      }
    }
  } catch {
    // best-effort, jamais bloquant
  }
}
