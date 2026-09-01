import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { formaterMontant } from "./currency";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function notifierOuvertureSessionCaisse(montant: number) {
  const { status } = await Notifications.getPermissionsAsync();
  let finalStatus = status;
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    finalStatus = newStatus;
  }
  if (finalStatus !== "granted") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Session de caisse ouverte",
      body: `Montant d'ouverture : ${formaterMontant(montant)}`,
    },
    trigger: null,
  });
}

export async function enregistrerPushTokenPatron(patronToken: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    if (Platform.OS === "android" && !Constants.expoConfig?.android?.googleServicesFile) return;

    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== "granted") {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      finalStatus = newStatus;
    }
    if (finalStatus !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post("/patron/push-tokens", { token, platform: Platform.OS }, patronToken);
  } catch (error) {
    console.warn("Échec de l'enregistrement du token push patron", error);
  }
}

export async function notifierStockBas(nomProduit: string, stockActuel: number, seuil: number) {
  const { status } = await Notifications.getPermissionsAsync();
  let finalStatus = status;
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    finalStatus = newStatus;
  }
  if (finalStatus !== "granted") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Stock bas",
      body: `${nomProduit} : il reste ${stockActuel} (seuil d'alerte : ${seuil}).`,
    },
    trigger: null,
  });
}
