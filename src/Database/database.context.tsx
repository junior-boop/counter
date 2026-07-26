import { QueryForTable } from "../../SimpleORM";
import * as Caisse from "./caisse";
import * as Categories from "./categories";
import * as CommandeDb from "./commande";
import { CategoriePerte, Categorie, Commande, Etablissement, LigneCommande, MouvementCaisse, MouvementStock, Produit, SessionCaisse, SessionStock, TypeActivite, TypeMouvementStock, Utilisateur } from "./db";
import * as EtablissementDb from "./etablissement";
import * as Produits from "./produits";
import * as Stock from "./stock";
import * as Utilisateurs from "./utilisateurs";
import { notifierOuvertureSessionCaisse } from "../lib/notifications";
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
  modifierSeuilAlerteProduit: (produit_id: string, seuil_alerte: number | null) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

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

  const refreshLocalData = useCallback(async () => {
    try {
      const [categoriesResult, produitsResult, utilisateursResult, etablissementResult, sessionsCaisseResult, mouvementsCaisseResult, commandesResult, lignesCommandeResult, mouvementsStockResult, sessionsStockResult] = await Promise.all([
        Categories.getall(),
        Produits.getall(),
        Utilisateurs.getall(),
        EtablissementDb.get(),
        Caisse.getAllSessions(),
        Caisse.getAllMouvements(),
        CommandeDb.getAllCommandes(),
        CommandeDb.getAllLignesCommande(),
        Stock.getAllMouvements(),
        Stock.getAllSessions(),
      ]);
      setCategoriesQuery(new QueryForTable<Categorie>(categoriesResult));
      setProduitsQuery(new QueryForTable<Produit>(produitsResult));
      setUtilisateursQuery(new QueryForTable<Utilisateur>(utilisateursResult));
      setEtablissement(etablissementResult);
      setSessionsCaisseQuery(new QueryForTable<SessionCaisse>(sessionsCaisseResult));
      setMouvementsCaisseQuery(new QueryForTable<MouvementCaisse>(mouvementsCaisseResult));
      setCommandesQuery(new QueryForTable<Commande>(commandesResult));
      setLignesCommandeQuery(new QueryForTable<LigneCommande>(lignesCommandeResult));
      setMouvementsStockQuery(new QueryForTable<MouvementStock>(mouvementsStockResult));
      setSessionsStockQuery(new QueryForTable<SessionStock>(sessionsStockResult));
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
      await refreshLocalData();
      return result;
    } catch (error) {
      handleError(error, "adding categorie");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateCategorie = useCallback(async (data: Categorie) => {
    clearError();
    try {
      await Categories.updated(data);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "updating categorie");
    }
  }, [clearError, handleError, refreshLocalData]);

  const deleteCategorie = useCallback(async (id: string) => {
    clearError();
    try {
      await Categories.deleted(id);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "deleting categorie");
    }
  }, [clearError, handleError, refreshLocalData]);

  const addProduit = useCallback(async (data: Omit<Produit, "id">) => {
    clearError();
    try {
      const result = await Produits.created(data);
      await refreshLocalData();
      return result;
    } catch (error) {
      handleError(error, "adding produit");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateProduit = useCallback(async (data: Produit) => {
    clearError();
    try {
      await Produits.updated(data);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "updating produit");
    }
  }, [clearError, handleError, refreshLocalData]);

  const deleteProduit = useCallback(async (id: string) => {
    clearError();
    try {
      await Produits.deleted(id);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "deleting produit");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateEtablissement = useCallback(async (data: Omit<Etablissement, "id">) => {
    clearError();
    try {
      await EtablissementDb.save(data);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "updating etablissement");
    }
  }, [clearError, handleError, refreshLocalData]);

  const addUtilisateur = useCallback(async (data: Omit<Utilisateur, "id">) => {
    clearError();
    try {
      const result = await Utilisateurs.created(data);
      await refreshLocalData();
      return result;
    } catch (error) {
      handleError(error, "adding utilisateur");
    }
  }, [clearError, handleError, refreshLocalData]);

  const updateUtilisateur = useCallback(async (data: Utilisateur) => {
    clearError();
    try {
      await Utilisateurs.updated(data);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "updating utilisateur");
    }
  }, [clearError, handleError, refreshLocalData]);

  const deleteUtilisateur = useCallback(async (id: string) => {
    clearError();
    try {
      await Utilisateurs.deleted(id);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "deleting utilisateur");
    }
  }, [clearError, handleError, refreshLocalData]);

  const ouvrirSessionCaisse = useCallback(async (data: { type_activite: SessionCaisse["type_activite"]; montant_ouverture: number; utilisateur_ouverture_id: string }) => {
    clearError();
    try {
      const result = await Caisse.ouvrirSession(data);
      await refreshLocalData();
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
      await refreshLocalData();
    } catch (error) {
      handleError(error, "fermeture de la caisse");
    }
  }, [clearError, handleError, refreshLocalData]);

  const ajouterMouvementCaisse = useCallback(async (data: { session_id: string; type: MouvementCaisse["type"]; montant: number; motif?: string; utilisateur_id: string }) => {
    clearError();
    try {
      const result = await Caisse.ajouterMouvement(data);
      await refreshLocalData();
      return result;
    } catch (error) {
      handleError(error, "ajout d'un mouvement de caisse");
    }
  }, [clearError, handleError, refreshLocalData]);

  const passerCommande = useCallback(async (data: { session_id: string; utilisateur_id: string; lignes: { produit: Produit; quantite: number }[] }) => {
    clearError();
    try {
      const result = await CommandeDb.passerCommande(data);
      await refreshLocalData();
      return result;
    } catch (error) {
      handleError(error, "passer une commande");
    }
  }, [clearError, handleError, refreshLocalData]);

  const modifierCommande = useCallback(async (data: { commande_id: string; lignes: { produit: Produit; quantite: number }[] }) => {
    clearError();
    try {
      await CommandeDb.modifierCommande(data);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "modification de la commande");
    }
  }, [clearError, handleError, refreshLocalData]);

  const supprimerCommande = useCallback(async (commande_id: string) => {
    clearError();
    try {
      await CommandeDb.supprimerCommande(commande_id);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "suppression de la commande");
    }
  }, [clearError, handleError, refreshLocalData]);

  const ouvrirSessionStock = useCallback(async (data: { type_activite: TypeActivite; utilisateur_ouverture_id: string; comptages: { produit_id: string; quantite: number }[] }) => {
    clearError();
    try {
      const result = await Stock.ouvrirSession(data);
      await refreshLocalData();
      return result;
    } catch (error) {
      handleError(error, "ouverture de l'inventaire");
    }
  }, [clearError, handleError, refreshLocalData]);

  const fermerSessionStock = useCallback(async (data: { id: string; utilisateur_fermeture_id: string; comptages: { produit_id: string; quantite: number }[] }) => {
    clearError();
    try {
      await Stock.fermerSession(data);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "fermeture de l'inventaire");
    }
  }, [clearError, handleError, refreshLocalData]);

  const ajouterMouvementStock = useCallback(async (data: { session_id: string; produit_id: string; type: TypeMouvementStock; quantite: number; categorie_perte?: CategoriePerte; motif?: string; utilisateur_id: string }) => {
    clearError();
    try {
      const result = await Stock.ajouterMouvement(data);
      await refreshLocalData();
      return result;
    } catch (error) {
      handleError(error, "enregistrement d'un mouvement de stock");
    }
  }, [clearError, handleError, refreshLocalData]);

  const modifierSeuilAlerteProduit = useCallback(async (produit_id: string, seuil_alerte: number | null) => {
    clearError();
    try {
      await Stock.modifierSeuilAlerte(produit_id, seuil_alerte);
      await refreshLocalData();
    } catch (error) {
      handleError(error, "modification du seuil d'alerte");
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
    modifierSeuilAlerteProduit,
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
    modifierSeuilAlerteProduit,
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
