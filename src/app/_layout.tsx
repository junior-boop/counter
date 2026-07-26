import { AuthProvider, useAuth } from '@/Auth/auth.context';
import { AlertProvider } from '@/components/alert/alert.context';
import { DatabaseProvider, useDatabase } from '@/Database/database.context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from "expo-status-bar";
import { useEffect } from 'react';


SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading: dbLoading } = useDatabase();
  const { session, isLoading: authLoading } = useAuth();

  const isReady = !dbLoading && !authLoading;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="etablissement" />
        <Stack.Screen name="utilisateurs" />
        <Stack.Screen name="activite/[type]" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="session-stock/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

export default function TabLayout() {
  return (
    <DatabaseProvider>
      <AuthProvider>
        <AlertProvider>
          <StatusBar style='dark' />
          <RootNavigator />
        </AlertProvider>
      </AuthProvider>
    </DatabaseProvider>
  );
}
