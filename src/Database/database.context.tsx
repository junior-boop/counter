import { QueryForTable } from "../../SimpleORM";
import * as Caisse from "./caisse";
import * as Categories from "./categories";
import * as CommandeDb from "./commande";
import { CategoriePerte, Categorie, Commande, Etablissement, LigneCommande, MouvementCaisse, MouvementStock, Produit, SessionCaisse, SessionStock, TypeActivite, TypeMouvementStock, Utilisateur } from "./db";
import * as EtablissementDb from "./etablissement";
import * as Produits from "./produits";
import * as Stock from "./stock";
import * as Utilisateurs from "./utilisateurs";
import { notifierOuvertureSessionCaisse, notifierStockBas } from "../lib/notifications";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type DatabaseError = {
  message: string;
  code: string;
  details?: unknown;
};

interface DatabaseContextType {
  categoriesQuery: QueryForTable<Categorie> | null;
  produitsQuery: QueryForTable<Produit> | null;
  utilisateursQuery: QueryForTable<Utilisateur> | null;
  etablissement: Etablissement | null;
  isLoading: boolean;
  error: DatabaseError | null;
  clearError: () => void;
  addCategorie: (data: Omit<Categorie, "id">) => Promise<Categorie | undefined>;
  updateCategorie: (data: Categorie) => Promise<void>;
  deleteCategorie: (id: string) => Promise<void>;
  addProduit: (data: Omit<Produit, "id">) => Promise<Produit | undefined>;
  updateProduit: (data: Produit) => Promise<void>;
  deleteProduit: (id: string) => Promise<void>;
  updateEtablissement: (data: Omit<Etablissement, "id">) => Promise<void>;
  addUtilisateur: (data: Omit<Utilisateur, "id">) => Promise<Utilisateur | undefined>;
  updateUtilisateur: (data: Utilisateur) => Promise<void>;
  deleteUtilisateur: (id: string) => Promise<void>;
  sessionsCaisseQuery: QueryForTable<SessionCaisse> | null;
  mouvementsCaisseQuery: QueryForTable<MouvementCaisse> | null;
  ouvrirSessionCaisse: (data: { type_activite: SessionCaisse["type_activite"]; montant_ouverture: number; utilisateur_ouverture_id: string }) => Promise<SessionCaisse | undefined>;
  fermerSessionCaisse: (data: { id: string; montant_fermeture: number; ecart: number; utilisateur_fermeture_id: string }) => Promise<void>;
  ajouterMouvementCaisse: (data: { session_id: string; type: MouvementCaisse["type"]; montant: number; motif?: string; utilisateur_id: string }) => Promise<MouvementCaisse | undefined>;
  modifierMouvementCaisse: (data: { id: string; type: MouvementCaisse["type"]; montant: number; motif?: string }) => Promise<void>;
  supprimerMouvementCaisse: (id: string) => Promise<void>;
  commandesQuery: QueryForTable<Commande> | null;
  lignesCommandeQuery: QueryForTable<LigneCommande> | null;
  passerCommande: (data: { session_id: string; utilisateur_id: string; lignes: { produit: Produit; quantite: number }[] }) => Promise<Commande | undefined>;
  modifierCommande: (data: { commande_id: string; lignes: { produit: Produit; quantite: number }[] }) => Promise<void>;
  supprimerCommande: (commande_id: string) => Promise<void>;
  mouvementsStockQuery: QueryForTable<MouvementStock> | null;
  sessionsStockQuery: QueryForTable<SessionStock> | null;
  ouvrirSessionStock: (data: { type_activite: TypeActivite; utilisateur_ouverture_id: string; comptages: { produit_id: string; quantite: number }[] }) => Promise<SessionStock | undefined>;
  fermerSessionStock: (data: { id: string; utilisateur_fermeture_id: string; comptages: { produit_id: string; quantite: number }[] }) => Promise<void>;
  ajouterMouvementStock: (data: { session_id: string; produit_id: string; type: TypeMouvementStock; quantite: number; categorie_perte?: CategoriePerte; motif?: string; utilisateur_id: string }) => Promise<MouvementStock | undefined>;
  modifierMouvementStock: (data: { id: string; quantite: number; categorie_perte?: CategoriePerte; motif?: string }) => Promise<void>;
  supprimerMouvementStock: (id: string) => Promise<void>;
  modifierSeuilAlerteProduit: (produit_id: string, seuil_alerte: number | null) => Promise<void>;
  modifierSeuilAlerteCategorie: (categorie_id: string, seuil_alerte: number | null) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

/**
 * Compare le stock d'avant-mutation (lu en mémoire, donc forcément juste avant
 * l'écriture) au stock d'après (relu en base, car l'état React n'est pas encore
 * à jour juste après refreshLocalData). Ne notifie que le franchissement du
 * seuil vers le bas, jamais un produit déjà bas — sinon chaque mouvement sur un
 * produit en rupture spammerait une notification.
 */
async function verifierSeuilsFranchis(
  produitIds: string[],
  stockAvant: Map<string, number | null | undefined>,
  categoriesQuery: QueryForTable<Categorie> | null
) {
  const uniqueIds = Array.from(new Set(produitIds));
  if (uniqueIds.length === 0) return;
  const produitsApres = await Produits.getall();
  for (const id of uniqueIds) {
    const produit = produitsApres.find((p) => p.id === id);
    if (!produit) continue;
    const categorie = categoriesQuery?.findById(produit.categorie_id) ?? null;
    const seuil = Stock.seuilEffectif(produit, categorie);
    if (seuil === null) continue;
    const avant = stockAvant.get(id);
    const etaitBasAvant = avant != null && avant <= seuil;
    if (!etaitBasAvant && Stock.estStockBas(produit, categorie)) {
      notifierStockBas(produit.nom, produit.stock_actuel ?? 0, seuil);
    }
  }
}

/**
 * Chaque mutation déclare les tables qu'elle touche. Avant, la moindre écriture
 * relisait les 10 tables et recréait les 10 QueryForTable : identité du contexte
 * changée à chaque fois, donc *tous* les écrans se re-rendaient et tous les index
 * étaient jetés. Un simple changement de seuil d'alerte relisait l'historique
 * complet des mouvements.
 */
type TableLocale =
  | "categories"
  | "produits"
  | "utilisateurs"
  | "etablissement"
  | "sessionsCaisse"
  | "mouvementsCaisse"
  | "commandes"
  | "lignesCommande"
  | "mouvementsStock"
  | "sessionsStock";

const TOUTES_LES_TABLES: readonly TableLocale[] = [
  "categories",
  "produits",
  "utilisateurs",
  "etablissement",
  "sessionsCaisse",
  "mouvementsCaisse",
  "commandes",
  "lignesCommande",
  "mouvementsStock",
  "sessionsStock",
];

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const [categoriesQuery, setCategoriesQuery] = useState<QueryForTable<Categorie> | null>(null);
  const [produitsQuery, setProduitsQuery] = useState<QueryForTable<Produit> | null>(null);
  const [utilisateursQuery, setUtilisateursQuery] = useState<QueryForTable<Utilisateur> | null>(null);
  const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
  const [sessionsCaisseQuery, setSessionsCaisseQuery] = useState<QueryForTable<SessionCaisse> | null>(null);
  const [mouvementsCaisseQuery, setMouvementsCaisseQuery] = useState<QueryForTable<MouvementCaisse> | null>(null);
  const [commandesQuery, setCommandesQuery] = useState<QueryForTable<Commande> | null>(null);
  const [lignesCommandeQuery, setLignesCommandeQuery] = useState<QueryForTable<LigneCommande> | null>(null);
  const [mouvementsStockQuery, setMouvementsStockQuery] = useState<QueryForTable<MouvementStock> | null>(null);
  const [sessionsStockQuery, setSessionsStockQuery] = useState<QueryForTable<SessionStock> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<DatabaseError | null>(null);

  const handleError = useCallback((error: unknown, operation: string) => {
    const dbError: DatabaseError = {
      message: `Error during ${operation}`,
      code: "DB_ERROR",
      details: error,
    };
    setError(dbError);
    console.error(`Database error during ${operation}:`, error);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshLocalData = useCallback(async (tables: readonly TableLocale[] = TOUTES_LES_TABLES) => {
    try {
      await Promise.all(tables.map(async (table) => {
        switch (table) {
          case "categories":
            return setCategoriesQuery(new QueryForTable<Categorie>(await Categories.getall()));
          case "produits":
            return setProduitsQuery(new QueryForTable<Produit>(await Produits.getall()));
          case "utilisateurs":
            return setUtilisateursQuery(new QueryForTable<Utilisateur>(await Utilisateurs.getall()));
          case "etablissement":
            return setEtablissement(await EtablissementDb.get());
          case "sessionsCaisse":
            return setSessionsCaisseQuery(new QueryForTable<SessionCaisse>(await Caisse.getAllSessions()));
          case "mouvementsCaisse":
            return setMouvementsCaisseQuery(new QueryForTable<MouvementCaisse>(await Caisse.getAllMouvements()));
          case "commandes":
            return setCommandesQuery(new QueryForTable<Commande>(await CommandeDb.getAllCommandes()));
          case "lignesCommande":
            return setLignesCommandeQuery(new QueryForTable<LigneCommande>(await CommandeDb.getAllLignesCommande()));
          case "mouvementsStock":
            return setMouvementsStockQuery(new QueryForTable<MouvementStock>(await Stock.getAllMouvements()));
          case "sessionsStock":
            return setSessionsStockQuery(new QueryForTable<SessionStock>(await Stock.getAllSessions()));
        }
      }));
    } catch (error) {
      handleError(error, "local data refresh");
    }
  }, [handleError]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Categories.createTable();
      await Produits.createTable();
      await Utilisateurs.createTable();
      await EtablissementDb.createTable();
      await Caisse.createTable();
      await CommandeDb.createTable();
      await Stock.createTable();
      clearError();
      await refreshLocalData();
    } catch (error) {
      handleError(error, "initial data loading");
    } finally {
      setIsLoading(false);
    }
  }, [handleError, clearError, refreshLocalData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const addCategorie = useCallback(async (data: Omit<Categorie, "id">) => {
    clearError();
    try {
      const result = await Categories.created(data);
      await refreshLocalData(["categories"]);
      return result;
    } catch (error) {
      handleError(error, "adding categorie");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateCategorie = useCallback(async (data: Categorie) => {
    clearError();
    try {
      await Categories.updated(data);
      await refreshLocalData(["categories"]);
    } catch (error) {
      handleError(error, "updating categorie");
    }
  }, [clearError, handleError, refreshLocalData]);

  const deleteCategorie = useCallback(async (id: string) => {
    clearError();
    try {
      await Categories.deleted(id);
      await refreshLocalData(["categories"]);
    } catch (error) {
      handleError(error, "deleting categorie");
    }
  }, [clearError, handleError, refreshLocalData]);

  const addProduit = useCallback(async (data: Omit<Produit, "id">) => {
    clearError();
    try {
      const result = await Produits.created(data);
      await refreshLocalData(["produits"]);
      return result;
    } catch (error) {
      handleError(error, "adding produit");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateProduit = useCallback(async (data: Produit) => {
    clearError();
    try {
      await Produits.updated(data);
      await refreshLocalData(["produits"]);
    } catch (error) {
      handleError(error, "updating produit");
    }
  }, [clearError, handleError, refreshLocalData]);

  const deleteProduit = useCallback(async (id: string) => {
    clearError();
    try {
      await Produits.deleted(id);
      await refreshLocalData(["produits"]);
    } catch (error) {
      handleError(error, "deleting produit");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateEtablissement = useCallback(async (data: Omit<Etablissement, "id">) => {
    clearError();
    try {
      await EtablissementDb.save(data);
      await refreshLocalData(["etablissement"]);
    } catch (error) {
      handleError(error, "updating etablissement");
    }
  }, [clearError, handleError, refreshLocalData]);

  const addUtilisateur = useCallback(async (data: Omit<Utilisateur, "id">) => {
    clearError();
    try {
      const result = await Utilisateurs.created(data);
      await refreshLocalData(["utilisateurs"]);
      return result;
    } catch (error) {
      handleError(error, "adding utilisateur");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateUtilisateur = useCallback(async (data: Utilisateur) => {
    clearError();
    try {
      await Utilisateurs.updated(data);
      await refreshLocalData(["utilisateurs"]);
    } catch (error) {
      handleError(error, "updating utilisateur");
    }
  }, [clearError, handleError, refreshLocalData]);

  const deleteUtilisateur = useCallback(async (id: string) => {
    clearError();
    try {
      await Utilisateurs.deleted(id);
      await refreshLocalData(["utilisateurs"]);
    } catch (error) {
      handleError(error, "deleting utilisateur");
    }
  }, [clearError, handleError, refreshLocalData]);

  const ouvrirSessionCaisse = useCallback(async (data: { type_activite: SessionCaisse["type_activite"]; montant_ouverture: number; utilisateur_ouverture_id: string }) => {
    clearError();
    try {
      const result = await Caisse.ouvrirSession(data);
      await refreshLocalData(["sessionsCaisse"]);
      notifierOuvertureSessionCaisse(data.montant_ouverture);
      return result;
    } catch (error) {
      handleError(error, "ouverture de la caisse");
    }
  }, [clearError, handleError, refreshLocalData]);

  const fermerSessionCaisse = useCallback(async (data: { id: string; montant_fermeture: number; ecart: number; utilisateur_fermeture_id: string }) => {
    clearError();
    try {
      await Caisse.fermerSession(data);
      await refreshLocalData(["sessionsCaisse"]);
    } catch (error) {
      handleError(error, "fermeture de la caisse");
    }
  }, [clearError, handleError, refreshLocalData]);

  const ajouterMouvementCaisse = useCallback(async (data: { session_id: string; type: MouvementCaisse["type"]; montant: number; motif?: string; utilisateur_id: string }) => {
    clearError();
    try {
      const result = await Caisse.ajouterMouvement(data);
      await refreshLocalData(["mouvementsCaisse"]);
      return result;
    } catch (error) {
      handleError(error, "ajout d'un mouvement de caisse");
    }
  }, [clearError, handleError, refreshLocalData]);

  const modifierMouvementCaisse = useCallback(async (data: { id: string; type: MouvementCaisse["type"]; montant: number; motif?: string }) => {
    clearError();
    try {
      await Caisse.modifierMouvement(data);
      await refreshLocalData(["mouvementsCaisse"]);
    } catch (error) {
      handleError(error, "modification du mouvement de caisse");
    }
  }, [clearError, handleError, refreshLocalData]);

  const supprimerMouvementCaisse = useCallback(async (id: string) => {
    clearError();
    try {
      await Caisse.supprimerMouvement(id);
      await refreshLocalData(["mouvementsCaisse"]);
    } catch (error) {
      handleError(error, "suppression du mouvement de caisse");
    }
  }, [clearError, handleError, refreshLocalData]);

  const passerCommande = useCallback(async (data: { session_id: string; utilisateur_id: string; lignes: { produit: Produit; quantite: number }[] }) => {
    clearError();
    const produitIds = data.lignes.map((l) => l.produit.id);
    const stockAvant = new Map(produitIds.map((id) => [id, produitsQuery?.findById(id)?.stock_actuel]));
    try {
      const result = await CommandeDb.passerCommande(data);
      await refreshLocalData(["commandes", "lignesCommande", "mouvementsCaisse", "mouvementsStock", "produits"]);
      verifierSeuilsFranchis(produitIds, stockAvant, categoriesQuery);
      return result;
    } catch (error) {
      handleError(error, "passer une commande");
    }
  }, [clearError, handleError, refreshLocalData, produitsQuery, categoriesQuery]);

  const modifierCommande = useCallback(async (data: { commande_id: string; lignes: { produit: Produit; quantite: number }[] }) => {
    clearError();
    const produitIds = data.lignes.map((l) => l.produit.id);
    const stockAvant = new Map(produitIds.map((id) => [id, produitsQuery?.findById(id)?.stock_actuel]));
    try {
      await CommandeDb.modifierCommande(data);
      await refreshLocalData(["commandes", "lignesCommande", "mouvementsCaisse", "mouvementsStock", "produits"]);
      verifierSeuilsFranchis(produitIds, stockAvant, categoriesQuery);
    } catch (error) {
      handleError(error, "modification de la commande");
    }
  }, [clearError, handleError, refreshLocalData, produitsQuery, categoriesQuery]);

  const supprimerCommande = useCallback(async (commande_id: string) => {
    clearError();
    try {
      await CommandeDb.supprimerCommande(commande_id);
      await refreshLocalData(["commandes", "lignesCommande", "mouvementsCaisse", "mouvementsStock", "produits"]);
    } catch (error) {
      handleError(error, "suppression de la commande");
    }
  }, [clearError, handleError, refreshLocalData]);

  const ouvrirSessionStock = useCallback(async (data: { type_activite: TypeActivite; utilisateur_ouverture_id: string; comptages: { produit_id: string; quantite: number }[] }) => {
    clearError();
    const produitIds = data.comptages.map((c) => c.produit_id);
    const stockAvant = new Map(produitIds.map((id) => [id, produitsQuery?.findById(id)?.stock_actuel]));
    try {
      const result = await Stock.ouvrirSession(data);
      await refreshLocalData(["sessionsStock", "mouvementsStock", "produits"]);
      verifierSeuilsFranchis(produitIds, stockAvant, categoriesQuery);
      return result;
    } catch (error) {
      handleError(error, "ouverture de l'inventaire");
      // Rethrow : l'écran d'inventaire navigue en arrière après un `await` réussi.
      // Sans ça, un échec d'écriture silencieux se présentait comme un succès.
      throw error;
    }
  }, [clearError, handleError, refreshLocalData, produitsQuery, categoriesQuery]);

  const fermerSessionStock = useCallback(async (data: { id: string; utilisateur_fermeture_id: string; comptages: { produit_id: string; quantite: number }[] }) => {
    clearError();
    const produitIds = data.comptages.map((c) => c.produit_id);
    const stockAvant = new Map(produitIds.map((id) => [id, produitsQuery?.findById(id)?.stock_actuel]));
    try {
      await Stock.fermerSession(data);
      await refreshLocalData(["sessionsStock", "mouvementsStock", "produits"]);
      verifierSeuilsFranchis(produitIds, stockAvant, categoriesQuery);
    } catch (error) {
      handleError(error, "fermeture de l'inventaire");
      throw error;
    }
  }, [clearError, handleError, refreshLocalData, produitsQuery, categoriesQuery]);

  const ajouterMouvementStock = useCallback(async (data: { session_id: string; produit_id: string; type: TypeMouvementStock; quantite: number; categorie_perte?: CategoriePerte; motif?: string; utilisateur_id: string }) => {
    clearError();
    const stockAvant = new Map([[data.produit_id, produitsQuery?.findById(data.produit_id)?.stock_actuel]]);
    try {
      const result = await Stock.ajouterMouvement(data);
      await refreshLocalData(["mouvementsStock", "produits"]);
      verifierSeuilsFranchis([data.produit_id], stockAvant, categoriesQuery);
      return result;
    } catch (error) {
      handleError(error, "enregistrement d'un mouvement de stock");
    }
  }, [clearError, handleError, refreshLocalData, produitsQuery, categoriesQuery]);

  const modifierSeuilAlerteProduit = useCallback(async (produit_id: string, seuil_alerte: number | null) => {
    clearError();
    try {
      await Stock.modifierSeuilAlerte(produit_id, seuil_alerte);
      await refreshLocalData(["produits"]);
    } catch (error) {
      handleError(error, "modification du seuil d'alerte");
    }
  }, [clearError, handleError, refreshLocalData]);

  const modifierSeuilAlerteCategorie = useCallback(async (categorie_id: string, seuil_alerte: number | null) => {
    clearError();
    try {
      await Stock.modifierSeuilAlerteCategorie(categorie_id, seuil_alerte);
      await refreshLocalData(["categories"]);
    } catch (error) {
      handleError(error, "modification du seuil d'alerte de la catégorie");
    }
  }, [clearError, handleError, refreshLocalData]);

  const modifierMouvementStock = useCallback(async (data: { id: string; quantite: number; categorie_perte?: CategoriePerte; motif?: string }) => {
    clearError();
    try {
      await Stock.modifierMouvement(data);
      await refreshLocalData(["mouvementsStock", "produits"]);
    } catch (error) {
      handleError(error, "modification du mouvement de stock");
    }
  }, [clearError, handleError, refreshLocalData]);

  const supprimerMouvementStock = useCallback(async (id: string) => {
    clearError();
    try {
      await Stock.supprimerMouvement(id);
      await refreshLocalData(["mouvementsStock", "produits"]);
    } catch (error) {
      handleError(error, "suppression du mouvement de stock");
    }
  }, [clearError, handleError, refreshLocalData]);

  const contextValue = useMemo(() => ({
    categoriesQuery,
    produitsQuery,
    utilisateursQuery,
    etablissement,
    sessionsCaisseQuery,
    mouvementsCaisseQuery,
    isLoading,
    error,
    clearError,
    addCategorie,
    updateCategorie,
    deleteCategorie,
    addProduit,
    updateProduit,
    deleteProduit,
    updateEtablissement,
    addUtilisateur,
    updateUtilisateur,
    deleteUtilisateur,
    ouvrirSessionCaisse,
    fermerSessionCaisse,
    ajouterMouvementCaisse,
    modifierMouvementCaisse,
    supprimerMouvementCaisse,
    commandesQuery,
    lignesCommandeQuery,
    passerCommande,
    modifierCommande,
    supprimerCommande,
    mouvementsStockQuery,
    sessionsStockQuery,
    ouvrirSessionStock,
    fermerSessionStock,
    ajouterMouvementStock,
    modifierMouvementStock,
    supprimerMouvementStock,
    modifierSeuilAlerteProduit,
    modifierSeuilAlerteCategorie,
  }), [
    categoriesQuery,
    produitsQuery,
    utilisateursQuery,
    etablissement,
    sessionsCaisseQuery,
    mouvementsCaisseQuery,
    isLoading,
    error,
    clearError,
    addCategorie,
    updateCategorie,
    deleteCategorie,
    addProduit,
    updateProduit,
    deleteProduit,
    updateEtablissement,
    addUtilisateur,
    updateUtilisateur,
    deleteUtilisateur,
    ouvrirSessionCaisse,
    fermerSessionCaisse,
    ajouterMouvementCaisse,
    modifierMouvementCaisse,
    supprimerMouvementCaisse,
    commandesQuery,
    lignesCommandeQuery,
    passerCommande,
    modifierCommande,
    supprimerCommande,
    mouvementsStockQuery,
    sessionsStockQuery,
    ouvrirSessionStock,
    fermerSessionStock,
    ajouterMouvementStock,
    modifierMouvementStock,
    supprimerMouvementStock,
    modifierSeuilAlerteProduit,
    modifierSeuilAlerteCategorie,
  ]);

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
};
