import * as SecureStore from "expo-secure-store";
import { generateUUID } from "../Database/uuid";

const DEVICE_TOKEN_KEY = "etablissement_device_token";
const DEVICE_IDENTIFIANT_KEY = "device_identifiant_local";

export async function getDeviceToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
}

export async function setDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
}

export async function clearDeviceToken(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
}

/**
 * Identifiant propre à cet appareil physique, généré une seule fois puis conservé
 * entre les cycles d'appariement/rupture, pour que le serveur reconnaisse un même
 * appareil qui reprend un nouveau code de pairing au lieu de créer un doublon.
 */
export async function getOrCreateDeviceIdentifiant(): Promise<string> {
  const existant = await SecureStore.getItemAsync(DEVICE_IDENTIFIANT_KEY);
  if (existant) return existant;

  const identifiant = generateUUID();
  await SecureStore.setItemAsync(DEVICE_IDENTIFIANT_KEY, identifiant);
  return identifiant;
}
