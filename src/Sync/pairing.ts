import * as EtablissementDb from "../Database/etablissement";
import { api } from "../lib/api";
import { setDeviceToken } from "./deviceToken";

interface PairingExchangeResponse {
  etablissement_id: string;
  nom: string;
  type: string;
  device_token: string;
}

export async function pairEtablissement(pairingCode: string): Promise<PairingExchangeResponse> {
  const result = await api.post<PairingExchangeResponse>("/pairing/exchange", { pairing_code: pairingCode });
  await setDeviceToken(result.device_token);
  await EtablissementDb.lierServeur(result.etablissement_id);
  return result;
}
