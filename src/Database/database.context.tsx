import { QueryForTable } from "../../SimpleORM";
import * as Categories from "./categories";
import { Categorie, Produit } from "./db";
import * as Produits from "./produits";
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
  isLoading: boolean;
  error: DatabaseError | null;
  clearError: () => void;
  addCategorie: (data: Omit<Categorie, "id">) => Promise<Categorie | undefined>;
  updateCategorie: (data: Categorie) => Promise<void>;
  deleteCategorie: (id: string) => Promise<void>;
  addProduit: (data: Omit<Produit, "id">) => Promise<Produit | undefined>;
  updateProduit: (data: Produit) => Promise<void>;
  deleteProduit: (id: string) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const [categoriesQuery, setCategoriesQuery] = useState<QueryForTable<Categorie> | null>(null);
  const [produitsQuery, setProduitsQuery] = useState<QueryForTable<Produit> | null>(null);
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
      const [categoriesResult, produitsResult] = await Promise.all([
        Categories.getall(),
        Produits.getall(),
      ]);
      setCategoriesQuery(new QueryForTable<Categorie>(categoriesResult));
      setProduitsQuery(new QueryForTable<Produit>(produitsResult));
    } catch (error) {
      handleError(error, "local data refresh");
    }
  }, [handleError]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Categories.createTable();
      await Produits.createTable();
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

  const contextValue = useMemo(() => ({
    categoriesQuery,
    produitsQuery,
    isLoading,
    error,
    clearError,
    addCategorie,
    updateCategorie,
    deleteCategorie,
    addProduit,
    updateProduit,
    deleteProduit,
  }), [
    categoriesQuery,
    produitsQuery,
    isLoading,
    error,
    clearError,
    addCategorie,
    updateCategorie,
    deleteCategorie,
    addProduit,
    updateProduit,
    deleteProduit,
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
