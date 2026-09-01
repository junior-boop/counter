import * as SecureStore from "expo-secure-store";

const ALERTES_VUES_KEY = "alertes_stock_vues";

/** Ids de produits dont l'alerte de stock bas a déjà été consultée (badge masqué). */
export async function chargerAlertesVues(): Promise<Set<string>> {
  const raw = await SecureStore.getItemAsync(ALERTES_VUES_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function sauvegarderAlertesVues(ids: Set<string>): Promise<void> {
  await SecureStore.setItemAsync(ALERTES_VUES_KEY, JSON.stringify(Array.from(ids)));
}
