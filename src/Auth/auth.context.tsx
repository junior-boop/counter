import * as SecureStore from "expo-secure-store";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Utilisateur } from "@/Database/db";
import { useDatabase } from "@/Database/database.context";

const SESSION_KEY = "session_utilisateur_id";

interface AuthContextType {
  session: Utilisateur | null;
  isLoading: boolean;
  signIn: (utilisateur: Utilisateur) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { utilisateursQuery, isLoading: dbLoading } = useDatabase();
  const [session, setSession] = useState<Utilisateur | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (dbLoading || !utilisateursQuery) return;

    (async () => {
      const storedId = await SecureStore.getItemAsync(SESSION_KEY);
      if (storedId) {
        const utilisateur = utilisateursQuery.findAll().find((u) => u.id === storedId) ?? null;
        if (utilisateur) {
          setSession(utilisateur);
        } else {
          await SecureStore.deleteItemAsync(SESSION_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, [dbLoading, utilisateursQuery]);

  const signIn = useCallback(async (utilisateur: Utilisateur) => {
    setSession(utilisateur);
    await SecureStore.setItemAsync(SESSION_KEY, utilisateur.id);
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ session, isLoading, signIn, signOut }),
    [session, isLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
