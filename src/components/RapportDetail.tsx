import { ArrowDownCircle, ArrowUpCircle } from "lucide-react-native";
import { View } from "react-native";
import theme from "../constants/constant-style";
import { formaterMontant } from "../lib/currency";
import { formaterHeure } from "../lib/date";
import { RapportDetails } from "../lib/rapportDetails";
import { CommandesTimelineChart } from "./CommandesTimelineChart";
import { Text } from "./text";

interface RapportDetailProps {
    session: {
        date_ouverture: string;
        date_fermeture?: string | null;
        montant_ouverture: number;
        montant_fermeture?: number | null;
        ecart?: number | null;
    };
    rapport: {
        total_entrees: number;
        total_sorties: number;
        montant_reappro: number;
        nombre_reappro: number;
        nombre_commandes: number;
        montant_commandes: number;
        quantite_perdue: number;
        nombre_ecarts_inventaire: number;
    };
    details: RapportDetails;
}

/**
 * Rendu complet d'un rapport de session (chiffres, graphique des commandes,
 * inventaire, historique de caisse). Partagé entre l'écran employé
 * (`app/rapport/[id].tsx`, données lues en direct dans la base locale) et les
 * écrans patron (données reconstruites depuis le JSON `details` synchronisé)
 * pour garantir que le boss voit exactement le même rapport que l'employé.
 */
export function RapportDetail({ session, rapport, details }: RapportDetailProps) {
    const historiqueCaisse = details.mouvementsCaisse.slice().sort((a, b) => b.date.localeCompare(a.date));

    return (
        <View style={{ gap: theme.internal_padding }}>
            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Ouverture : {formaterMontant(session.montant_ouverture)}</Text>
                <Text style={{ fontSize: theme.size_two }}>Fermeture : {formaterMontant(session.montant_fermeture ?? 0)}</Text>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: (session.ecart ?? 0) === 0 ? "#0f86e7" : "#e74c3c" }}>
                    Écart : {formaterMontant(session.ecart ?? 0)}
                </Text>
            </View>

            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 6 }}>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginBottom: 4 }}>Mouvements de caisse</Text>
                <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>Entrées : {formaterMontant(rapport.total_entrees)}</Text>
                <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>Sorties : {formaterMontant(rapport.total_sorties)}</Text>
                <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>
                    Réapprovisionnement : {formaterMontant(rapport.montant_reappro)} ({rapport.nombre_reappro})
                </Text>
                <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>
                    Commandes : {rapport.nombre_commandes} ({formaterMontant(rapport.montant_commandes)})
                </Text>
            </View>

            {details.commandes.length > 0 && (
                <CommandesTimelineChart commandes={details.commandes} debut={session.date_ouverture} fin={session.date_fermeture} />
            )}

            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 6 }}>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginBottom: 4 }}>Inventaire du stock</Text>
                <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>Quantité perdue : {rapport.quantite_perdue}</Text>
                {details.pertes.length > 0 && (
                    <View style={{ gap: 4 }}>
                        {details.pertes.map((m, index) => (
                            <Text key={index} style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                {m.produit_nom} — {m.quantite} ({m.categorie_perte ?? "inexpliqué"})
                            </Text>
                        ))}
                    </View>
                )}
                <Text style={{ fontSize: theme.size_two, opacity: 0.7, marginTop: 6 }}>
                    Écarts d'inventaire : {rapport.nombre_ecarts_inventaire}
                </Text>
                {details.ecarts.length > 0 && (
                    <View style={{ gap: 4 }}>
                        {details.ecarts.map((m, index) => (
                            <Text key={index} style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                {m.produit_nom} — écart : {m.ecart}
                            </Text>
                        ))}
                    </View>
                )}
            </View>

            <View style={{ gap: 6 }}>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Historique de caisse</Text>
                {historiqueCaisse.length === 0 && (
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun mouvement manuel enregistré.</Text>
                )}
                {historiqueCaisse.map((m, index) => (
                    <View key={index} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                        {m.type === "entree" ? <ArrowUpCircle color="#0f86e7" size={20} strokeWidth={1.5} /> : <ArrowDownCircle color="#e74c3c" size={20} strokeWidth={1.5} />}
                        <View style={{ flex: 1, gap: 2 }}>
                            <Text style={{ fontSize: theme.size_two }}>{formaterMontant(m.montant)}</Text>
                            {m.motif && <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{m.motif}</Text>}
                        </View>
                        <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterHeure(m.date)}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
