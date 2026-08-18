import * as SecureStore from "expo-secure-store";

const DEVICE_TOKEN_KEY = "etablissement_device_token";

export async function getDeviceToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
}

export async function setDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
}
