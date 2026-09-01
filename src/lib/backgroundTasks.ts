import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { purgerProduitsInactifs } from "../Database/stock";
import { retentativeRuptureAppariement } from "../Sync/unpair";

const TACHE_PURGE_PRODUITS_ACTIFS = "purge-produits-inactifs";
const TACHE_RUPTURE_APPARIEMENT = "rupture-appariement-en-attente";

/**
 * Purge de la liste des "produits actifs" (réapprovisionnés récemment). Le
 * déclenchement réel dépend du système (opportuniste, intervalle minimum
 * 15 min sur Android) : ce n'est qu'un filet de sécurité en complément de la
 * purge faite à chaque ouverture de l'app (`database.context.tsx`).
 */
TaskManager.defineTask(TACHE_PURGE_PRODUITS_ACTIFS, async () => {
  try {
    await purgerProduitsInactifs();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function enregistrerTachePurgeProduitsActifs() {
  const dejaEnregistree = await TaskManager.isTaskRegisteredAsync(TACHE_PURGE_PRODUITS_ACTIFS);
  if (dejaEnregistree) return;

  await BackgroundTask.registerTaskAsync(TACHE_PURGE_PRODUITS_ACTIFS, {
    minimumInterval: 24 * 60, // une fois par jour suffit pour une expiration à 2 semaines
  });
}

/**
 * Filet de sécurité pour la rupture d'appariement demandée à la déconnexion d'un employé :
 * si elle a échoué faute de connexion, cette tâche la retente en arrière-plan sans attendre
 * la prochaine ouverture de l'app.
 */
TaskManager.defineTask(TACHE_RUPTURE_APPARIEMENT, async () => {
  try {
    await retentativeRuptureAppariement();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function enregistrerTacheRuptureAppariement() {
  const dejaEnregistree = await TaskManager.isTaskRegisteredAsync(TACHE_RUPTURE_APPARIEMENT);
  if (dejaEnregistree) return;

  await BackgroundTask.registerTaskAsync(TACHE_RUPTURE_APPARIEMENT, {
    minimumInterval: 15, // minimum autorisé sur Android ; best-effort, l'OS espace les exécutions réelles
  });
}
