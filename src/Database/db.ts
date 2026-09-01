import { DatabaseRow, ModelFactory, SimpleORM } from "../../SimpleORM";

export type TypeActivite = "bar" | "restaurant";
export type TypeEtablissement = "bar" | "restaurant" | "les_deux";
export type Role = "patron" | "gerant" | "serveur" | "caissier";

export interface Categorie extends DatabaseRow {
  id: string;
  nom: string;
  type: TypeActivite;
  /** Seuil par défaut pour les produits de la catégorie qui n'ont pas de seuil propre. */
  seuil_alerte?: number | null;
  server_categorie_id?: string | null;
}

export interface Etablissement extends DatabaseRow {
  id: string;
  nom: string;
  type: TypeEtablissement;
  commande_temps_reel_active: boolean;
  /** Id de l'établissement côté serveur patron, si lié via un code de pairing. */
  server_id?: string | null;
  /** Déconnexion automatique des employés à une heure fixe (sécurité en fin de service). */
  fermeture_session_active?: boolean;
  /** Heure (0-23) de déclenchement, pertinente seulement si `fermeture_session_active`. */
  fermeture_session_heure?: number | null;
}

export interface Produit extends DatabaseRow {
  id: string;
  nom: string;
  prix: number;
  quantite_par_lot?: number | null;
  categorie_id: string;
  stock_actuel?: number | null;
  seuil_alerte?: number | null;
  server_produit_id?: string | null;
}

export type TypeMouvementStock = "reapprovisionnement" | "perte" | "vente" | "inventaire_ouverture" | "inventaire_fermeture";
export type CategoriePerte = "casse" | "peremption" | "offert" | "inexplique";
export type StatutSessionStock = "ouverte" | "fermee";

export interface SessionStock extends DatabaseRow {
  id: string;
  type_activite: TypeActivite;
  date_ouverture: string;
  date_fermeture?: string | null;
  statut: StatutSessionStock;
  utilisateur_ouverture_id: string;
  utilisateur_fermeture_id?: string | null;
}

export interface MouvementStock extends DatabaseRow {
  id: string;
  session_id: string;
  produit_id: string;
  type: TypeMouvementStock;
  quantite: number;
  ecart?: number | null;
  categorie_perte?: CategoriePerte | null;
  motif?: string | null;
  utilisateur_id: string;
  date: string;
  /** Renseigné uniquement pour les mouvements `vente` : permet de rejouer/annuler
   *  la sortie de stock quand la commande est modifiée ou supprimée. */
  commande_id?: string | null;
}

export interface Utilisateur extends DatabaseRow {
  id: string;
  nom: string;
  code: string; // legacy PIN ; pour un employé synchronisé = telephone
  role: Role;
  telephone?: string | null;
  server_employe_id?: string | null;
  password_verifier?: string | null;
  password_salt_local?: string | null;
  /** = password_updated_at côté serveur au moment où le vérificateur local a été dérivé */
  password_synced_version?: string | null;
}

export type StatutSessionCaisse = "ouverte" | "fermee";
export type TypeMouvementCaisse = "entree" | "sortie";

export interface SessionCaisse extends DatabaseRow {
  id: string;
  type_activite: TypeActivite;
  date_ouverture: string;
  montant_ouverture: number;
  date_fermeture?: string | null;
  montant_fermeture?: number | null;
  ecart?: number | null;
  statut: StatutSessionCaisse;
  utilisateur_ouverture_id: string;
  utilisateur_fermeture_id?: string | null;
}

export interface MouvementCaisse extends DatabaseRow {
  id: string;
  session_id: string;
  type: TypeMouvementCaisse;
  montant: number;
  motif?: string | null;
  utilisateur_id: string;
  date: string;
  commande_id?: string | null;
}

export interface Commande extends DatabaseRow {
  id: string;
  session_id: string;
  utilisateur_id: string;
  date: string;
  montant_total: number;
}

export interface LigneCommande extends DatabaseRow {
  id: string;
  commande_id: string;
  produit_id: string;
  produit_nom: string;
  prix_unitaire: number;
  quantite: number;
}

/**
 * Liste des produits réapprovisionnés récemment ("actifs"). Un produit qui
 * passe 2 semaines sans réapprovisionnement est purgé de cette table (voir
 * `Stock.purgerProduitsInactifs`), déclenché à l'ouverture de l'app et par
 * une tâche en arrière-plan (`src/lib/backgroundTasks.ts`).
 */
export interface ProduitActif extends DatabaseRow {
  id: string; // produit_id
  derniere_activite: string;
}

/**
 * Bilan généré à la clôture d'une session de caisse. Les montants
 * d'ouverture/fermeture/écart restent sur `SessionCaisse` (pas de
 * duplication) — le rapport ne stocke que les agrégats propres à la session
 * (voir `Database/rapport.ts:genererRapportPourSession`).
 */
export interface Rapport extends DatabaseRow {
  id: string;
  session_caisse_id: string; // un seul rapport par session fermée
  date_generation: string;
  total_entrees: number;
  total_sorties: number;
  montant_reappro: number;
  nombre_reappro: number;
  nombre_commandes: number;
  montant_commandes: number;
  quantite_perdue: number;
  nombre_ecarts_inventaire: number;
  synced_at_server?: string | null;
}

const orm = new SimpleORM("vms-counter.db");
const factory = new ModelFactory(orm);

export const CategorieModel = factory.createModel<Categorie>("categories", {
  id: "TEXT PRIMARY KEY",
  nom: "TEXT NOT NULL",
  type: "TEXT NOT NULL",
});

export const ProduitModel = factory.createModel<Produit>("produits", {
  id: "TEXT PRIMARY KEY",
  nom: "TEXT NOT NULL",
  prix: "REAL NOT NULL",
  quantite_par_lot: "INTEGER",
  categorie_id: "TEXT NOT NULL",
});

export const EtablissementModel = factory.createModel<Etablissement>("etablissement", {
  id: "TEXT PRIMARY KEY",
  nom: "TEXT NOT NULL",
  type: "TEXT NOT NULL",
  commande_temps_reel_active: "INTEGER NOT NULL",
  server_id: "TEXT",
  fermeture_session_active: "INTEGER",
  fermeture_session_heure: "INTEGER",
});

export const UtilisateurModel = factory.createModel<Utilisateur>("utilisateurs", {
  id: "TEXT PRIMARY KEY",
  nom: "TEXT NOT NULL",
  code: "TEXT NOT NULL UNIQUE",
  role: "TEXT NOT NULL",
  telephone: "TEXT",
  server_employe_id: "TEXT",
  password_verifier: "TEXT",
  password_salt_local: "TEXT",
  password_synced_version: "TEXT",
});

export const SessionCaisseModel = factory.createModel<SessionCaisse>("sessions_caisse", {
  id: "TEXT PRIMARY KEY",
  type_activite: "TEXT NOT NULL",
  date_ouverture: "TEXT NOT NULL",
  montant_ouverture: "REAL NOT NULL",
  date_fermeture: "TEXT",
  montant_fermeture: "REAL",
  ecart: "REAL",
  statut: "TEXT NOT NULL",
  utilisateur_ouverture_id: "TEXT NOT NULL",
  utilisateur_fermeture_id: "TEXT",
});

export const MouvementCaisseModel = factory.createModel<MouvementCaisse>("mouvements_caisse", {
  id: "TEXT PRIMARY KEY",
  session_id: "TEXT NOT NULL",
  type: "TEXT NOT NULL",
  montant: "REAL NOT NULL",
  motif: "TEXT",
  utilisateur_id: "TEXT NOT NULL",
  date: "TEXT NOT NULL",
  commande_id: "TEXT",
});

export const CommandeModel = factory.createModel<Commande>("commandes", {
  id: "TEXT PRIMARY KEY",
  session_id: "TEXT NOT NULL",
  utilisateur_id: "TEXT NOT NULL",
  date: "TEXT NOT NULL",
  montant_total: "REAL NOT NULL",
});

export const LigneCommandeModel = factory.createModel<LigneCommande>("lignes_commande", {
  id: "TEXT PRIMARY KEY",
  commande_id: "TEXT NOT NULL",
  produit_id: "TEXT NOT NULL",
  produit_nom: "TEXT NOT NULL",
  prix_unitaire: "REAL NOT NULL",
  quantite: "INTEGER NOT NULL",
});

export const ProduitActifModel = factory.createModel<ProduitActif>("produits_actifs", {
  id: "TEXT PRIMARY KEY",
  derniere_activite: "TEXT NOT NULL",
});

export const RapportModel = factory.createModel<Rapport>("rapports", {
  id: "TEXT PRIMARY KEY",
  session_caisse_id: "TEXT NOT NULL",
  date_generation: "TEXT NOT NULL",
  total_entrees: "REAL NOT NULL",
  total_sorties: "REAL NOT NULL",
  montant_reappro: "REAL NOT NULL",
  nombre_reappro: "INTEGER NOT NULL",
  nombre_commandes: "INTEGER NOT NULL",
  montant_commandes: "REAL NOT NULL",
  quantite_perdue: "REAL NOT NULL",
  nombre_ecarts_inventaire: "INTEGER NOT NULL",
});

export const SessionStockModel = factory.createModel<SessionStock>("sessions_stock", {
  id: "TEXT PRIMARY KEY",
  type_activite: "TEXT NOT NULL",
  date_ouverture: "TEXT NOT NULL",
  date_fermeture: "TEXT",
  statut: "TEXT NOT NULL",
  utilisateur_ouverture_id: "TEXT NOT NULL",
  utilisateur_fermeture_id: "TEXT",
});

export const MouvementStockModel = factory.createModel<MouvementStock>("mouvements_stock", {
  id: "TEXT PRIMARY KEY",
  session_id: "TEXT NOT NULL",
  produit_id: "TEXT NOT NULL",
  type: "TEXT NOT NULL",
  quantite: "REAL NOT NULL",
  ecart: "REAL",
  categorie_perte: "TEXT",
  motif: "TEXT",
  utilisateur_id: "TEXT NOT NULL",
  date: "TEXT NOT NULL",
  commande_id: "TEXT",
});
