import { DatabaseProvider } from '@/Database/database.context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from "expo-status-bar";


SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <DatabaseProvider>
      <StatusBar style='dark' />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
      </Stack>
    </DatabaseProvider>
  );
}
