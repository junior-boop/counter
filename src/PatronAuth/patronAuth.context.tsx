import * as SecureStore from "expo-secure-store";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SESSION_KEY = "patron_session";

export interface PatronSession {
  token: string;
  patronId: string;
  email: string;
}

interface PatronAuthContextType {
  patronSession: PatronSession | null;
  isLoading: boolean;
  signIn: (session: PatronSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const PatronAuthContext = createContext<PatronAuthContextType | undefined>(undefined);

export const PatronAuthProvider = ({ children }: { children: ReactNode }) => {
  const [patronSession, setPatronSession] = useState<PatronSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(SESSION_KEY);
      if (stored) {
        try {
          setPatronSession(JSON.parse(stored) as PatronSession);
        } catch {
          await SecureStore.deleteItemAsync(SESSION_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (session: PatronSession) => {
    setPatronSession(session);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }, []);

  const signOut = useCallback(async () => {
    setPatronSession(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }, []);

  const value = useMemo<PatronAuthContextType>(
    () => ({ patronSession, isLoading, signIn, signOut }),
    [patronSession, isLoading, signIn, signOut]
  );

  return <PatronAuthContext.Provider value={value}>{children}</PatronAuthContext.Provider>;
};

export const usePatronAuth = () => {
  const context = useContext(PatronAuthContext);
  if (context === undefined) {
    throw new Error("usePatronAuth must be used within a PatronAuthProvider");
  }
  return context;
};
