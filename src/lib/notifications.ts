import * as Notifications from "expo-notifications";
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
