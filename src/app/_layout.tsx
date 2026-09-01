import { AuthProvider, useAuth } from '@/Auth/auth.context';
import { AlertProvider } from '@/components/alert/alert.context';
import { DatabaseProvider, useDatabase } from '@/Database/database.context';
import { enregistrerTachePurgeProduitsActifs, enregistrerTacheRuptureAppariement } from '@/lib/backgroundTasks';
import { PatronAuthProvider, usePatronAuth } from '@/PatronAuth/patronAuth.context';
import { synchroniserEmployes } from '@/Sync/employesSync';
import { synchroniserProduits } from '@/Sync/produitsSync';
import { retentativeRapportsNonSynces } from '@/Sync/rapportSync';
import { retentativeRuptureAppariement } from '@/Sync/unpair';
import { Stack } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from "expo-status-bar";
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';


SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading: dbLoading, produitsQuery, etablissement, refreshLocalData } = useDatabase();
  const { session, isLoading: authLoading, signOut } = useAuth();
  const { patronSession, isLoading: patronLoading } = usePatronAuth();

  const isReady = !dbLoading && !authLoading && !patronLoading;
  const derniereFermetureAutoRef = useRef<string | null>(null);
  const hasProduits = (produitsQuery?.findAll().length ?? 0) > 0;
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  useEffect(() => {
    if (isUpdatePending) Updates.reloadAsync();
  }, [isUpdatePending]);

  useEffect(() => {
    enregistrerTachePurgeProduitsActifs();
    enregistrerTacheRuptureAppariement();
  }, []);

  useEffect(() => {
    // Priorité : reprendre une rupture d'appariement restée en attente avant toute autre synchro.
    void retentativeRuptureAppariement();
  }, []);

  useEffect(() => {
    if (!etablissement?.fermeture_session_active || etablissement.fermeture_session_heure == null || !session) return;
    const heureCible = etablissement.fermeture_session_heure;

    const verifier = () => {
      const maintenant = new Date();
      if (maintenant.getHours() !== heureCible) return;
      // Une seule déconnexion par fenêtre d'une heure : évite de reboucler si
      // l'employé se reconnecte immédiatement après.
      const cle = `${maintenant.toDateString()}-${heureCible}`;
      if (derniereFermetureAutoRef.current === cle) return;
      derniereFermetureAutoRef.current = cle;
      void signOut();
    };

    verifier();
    const intervalle = setInterval(verifier, 60_000);
    return () => clearInterval(intervalle);
  }, [etablissement?.fermeture_session_active, etablissement?.fermeture_session_heure, session, signOut]);

  useEffect(() => {
    if (Platform.OS === 'android') NavigationBar.setStyle('dark');
  }, []);

  useEffect(() => {
    if (isReady && session) void retentativeRapportsNonSynces();
  }, [isReady, session]);

  useEffect(() => {
    if (!isReady || !session || !etablissement?.server_id) return;
    void synchroniserEmployes(etablissement.server_id).then(() => refreshLocalData(["utilisateurs"]));
    void synchroniserProduits(etablissement.server_id).then(() => refreshLocalData(["categories", "produits"]));
  }, [isReady, session, etablissement?.server_id, refreshLocalData]);

  if (!isReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && hasProduits}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="etablissement" />
        <Stack.Screen name="activite/[type]" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="session-stock/[id]" />
        <Stack.Screen name="inventaire/[mode]" />
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
