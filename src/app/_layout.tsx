import { AuthProvider, useAuth } from '@/Auth/auth.context';
import { AlertProvider } from '@/components/alert/alert.context';
import { DatabaseProvider, useDatabase } from '@/Database/database.context';
import { enregistrerTachePurgeProduitsActifs } from '@/lib/backgroundTasks';
import { PatronAuthProvider, usePatronAuth } from '@/PatronAuth/patronAuth.context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from "expo-status-bar";
import { useEffect } from 'react';


SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading: dbLoading, produitsQuery } = useDatabase();
  const { session, isLoading: authLoading } = useAuth();
  const { patronSession, isLoading: patronLoading } = usePatronAuth();

  const isReady = !dbLoading && !authLoading && !patronLoading;
  const hasProduits = (produitsQuery?.findAll().length ?? 0) > 0;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  useEffect(() => {
    enregistrerTachePurgeProduitsActifs();
  }, []);

  if (!isReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && hasProduits}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="etablissement" />
        <Stack.Screen name="utilisateurs" />
        <Stack.Screen name="activite/[type]" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="session-stock/[id]" />
        <Stack.Screen name="inventaire/[mode]" />
        <Stack.Screen name="lier-etablissement" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !hasProduits}>
        <Stack.Screen name="produits-requis" />
      </Stack.Protected>
      <Stack.Protected guard={!!patronSession}>
        <Stack.Screen name="(patron-tabs)" />
        <Stack.Screen name="patron-etablissement/[id]" />
        <Stack.Screen name="patron-etablissement/nouveau" />
      </Stack.Protected>
      <Stack.Protected guard={!session && !patronSession}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="patron" />
      </Stack.Protected>
    </Stack>
  );
}

export default function TabLayout() {
  return (
    <DatabaseProvider>
      <AuthProvider>
        <PatronAuthProvider>
          <AlertProvider>
            <StatusBar style='dark' />
            <RootNavigator />
          </AlertProvider>
        </PatronAuthProvider>
      </AuthProvider>
    </DatabaseProvider>
  );
}
