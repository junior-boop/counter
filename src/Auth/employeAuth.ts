import { sha256 } from "js-sha256";
import { Utilisateur } from "../Database/db";
import { generateUUID } from "../Database/uuid";
import * as Utilisateurs from "../Database/utilisateurs";
import { ApiError, api } from "../lib/api";
import { getDeviceToken } from "../Sync/deviceToken";
import { ServerEmploye } from "../Sync/serverTypes";

const ITERATIONS = 300;

async function deriverVerificateur(password: string, sel: string): Promise<string> {
  let digest = `${sel}:${password}`;
  for (let i = 0; i < ITERATIONS; i++) {
    digest = sha256(digest);
  }
  return digest;
}

export async function authentifierEmploye(telephone: string, password: string): Promise<Utilisateur> {
  const local = await Utilisateurs.findByTelephone(telephone);

  if (local?.password_verifier && local.password_salt_local) {
    const candidat = await deriverVerificateur(password, local.password_salt_local);
    if (candidat === local.password_verifier) return local;
    throw new Error("Numéro ou mot de passe incorrect.");
  }

  const deviceToken = await getDeviceToken();
  if (!deviceToken) throw new Error("Cet appareil n'est lié à aucun établissement.");

  let distant: ServerEmploye;
  try {
    distant = await api.post<ServerEmploye>("/device/employes/verify", { telephone, password }, deviceToken);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw new Error("Numéro ou mot de passe incorrect.");
    throw new Error("Connexion internet requise pour vérifier cet utilisateur.");
  }

  const sel = generateUUID();
  const verifier = await deriverVerificateur(password, sel);
  const champsSynced = {
    nom: distant.nom,
    role: distant.role,
    telephone: distant.telephone,
    server_employe_id: distant.id,
    password_verifier: verifier,
    password_salt_local: sel,
    password_synced_version: distant.password_updated_at,
  };

  if (local) {
    const mis_a_jour = await Utilisateurs.updated({ ...local, ...champsSynced });
    if (!mis_a_jour) throw new Error("Connexion impossible.");
    return mis_a_jour;
  }

  return await Utilisateurs.created({ code: distant.telephone, ...champsSynced });
}
