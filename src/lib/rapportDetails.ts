/**
 * Détail complet d'un rapport de session, sérialisé en JSON et transmis tel
 * quel au serveur patron (colonne `details`) : c'est ce qui permet à l'écran
 * patron d'afficher le même graphique et les mêmes listes que l'employé,
 * sans avoir accès à la base SQLite locale de l'appareil.
 */
export interface RapportDetails {
  commandes: { date: string; montant_total: number }[];
  mouvementsCaisse: { type: "entree" | "sortie"; montant: number; motif: string | null; date: string }[];
  pertes: { produit_nom: string; quantite: number; categorie_perte: string | null }[];
  ecarts: { produit_nom: string; ecart: number }[];
}

const RAPPORT_DETAILS_VIDE: RapportDetails = { commandes: [], mouvementsCaisse: [], pertes: [], ecarts: [] };

/** Rapports générés avant l'ajout de ce champ (ou jamais synchronisés) n'en ont pas : repli sur un détail vide plutôt que de faire planter l'écran patron. */
export function parseRapportDetails(details: string | null | undefined): RapportDetails {
  if (!details) return RAPPORT_DETAILS_VIDE;
  try {
    return JSON.parse(details) as RapportDetails;
  } catch {
    return RAPPORT_DETAILS_VIDE;
  }
}
