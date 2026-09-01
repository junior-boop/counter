import { TypeEtablissement } from "../Database/db";
import * as EtablissementDb from "../Database/etablissement";
import { api } from "../lib/api";
import { getOrCreateDeviceIdentifiant, setDeviceToken } from "./deviceToken";
import { synchroniserEmployes } from "./employesSync";
import { synchroniserProduits } from "./produitsSync";

interface PairingExchangeResponse {
  etablissement_id: string;
  nom: string;
  type: string;
  device_token: string;
}

export async function pairEtablissement(pairingCode: string): Promise<PairingExchangeResponse> {
  const device_identifiant = await getOrCreateDeviceIdentifiant();
  const result = await api.post<PairingExchangeResponse>("/pairing/exchange", { pairing_code: pairingCode, device_identifiant });
  await setDeviceToken(result.device_token);
  await EtablissementDb.save({
    nom: result.nom,
    type: result.type as TypeEtablissement,
    commande_temps_reel_active: true,
    server_id: result.etablissement_id,
  });
  void synchroniserEmployes(result.etablissement_id);
  void synchroniserProduits(result.etablissement_id);
  return result;
}
