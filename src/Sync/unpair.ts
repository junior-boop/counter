import * as SecureStore from "expo-secure-store";
import * as EtablissementDb from "../Database/etablissement";
import { api } from "../lib/api";
import { clearDeviceToken, getDeviceToken } from "./deviceToken";

const RUPTURE_EN_ATTENTE_KEY = "appariement_rupture_en_attente";

/**
 * Déclenchée à la déconnexion d'un employé : l'appariement de l'appareil doit être
 * rompu côté serveur. L'intention est mémorisée avant la tentative réseau pour
 * qu'elle survive un échec (mode hors-ligne) et soit reprise en priorité plus tard.
 */
export async function demanderRuptureAppariement(): Promise<void> {
  await SecureStore.setItemAsync(RUPTURE_EN_ATTENTE_KEY, "1");
  await retentativeRuptureAppariement();
}

/**
 * Reprend une rupture d'appariement restée en attente (échouée hors-ligne).
 * Best-effort, appelée au démarrage de l'app et depuis la tâche de fond — ne bloque jamais l'utilisateur.
 */
export async function retentativeRuptureAppariement(): Promise<void> {
  const enAttente = await SecureStore.getItemAsync(RUPTURE_EN_ATTENTE_KEY);
  if (!enAttente) return;

  try {
    const deviceToken = await getDeviceToken();
    if (!deviceToken) {
      await SecureStore.deleteItemAsync(RUPTURE_EN_ATTENTE_KEY);
      return;
    }

    await api.delete("/device/unpair", deviceToken);
    await clearDeviceToken();
    await EtablissementDb.clearServerId();
    await SecureStore.deleteItemAsync(RUPTURE_EN_ATTENTE_KEY);
  } catch (error) {
    console.warn("Échec de la rupture d'appariement, nouvelle tentative plus tard", error);
  }
}
