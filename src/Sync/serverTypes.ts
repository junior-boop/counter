export interface ServerEtablissement {
  id: string;
  patron_id: string;
  nom: string;
  type: string;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  paired_at: string | null;
  nombre_appareils: number;
  created_at: string;
}

export interface ServerRapport {
  id: string;
  etablissement_id: string;
  session_caisse_id: string;
  local_rapport_id: string;
  date_generation: string;
  total_entrees: number;
  total_sorties: number;
  montant_reappro: number;
  nombre_reappro: number;
  nombre_commandes: number;
  montant_commandes: number;
  quantite_perdue: number;
  nombre_ecarts_inventaire: number;
  session_date_ouverture: string;
  session_date_fermeture: string | null;
  montant_ouverture: number;
  montant_fermeture: number | null;
  ecart: number | null;
  synced_at: string;
}

export interface ServerEmploye {
  id: string;
  etablissement_id: string;
  nom: string;
  telephone: string;
  role: "gerant" | "serveur" | "caissier";
  password_updated_at: string;
  created_at: string;
}

export interface ServerCategorie {
  id: string;
  etablissement_id: string;
  nom: string;
  type: "bar" | "restaurant";
  created_at: string;
}

export interface ServerProduit {
  id: string;
  etablissement_id: string;
  categorie_id: string;
  nom: string;
  prix: number;
  quantite_par_lot: number | null;
  created_at: string;
}
