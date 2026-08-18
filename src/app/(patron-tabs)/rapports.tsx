import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { formaterMontant } from "@/lib/currency";
import { formaterDateCourte } from "@/lib/date";
import { ServerEtablissement, ServerRapport } from "@/Sync/serverTypes";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

interface RapportAvecEtablissement extends ServerRapport {
    etablissement_nom: string;
}

export default function PatronRapportsScreen() {
    const { patronSession } = usePatronAuth();
    const { showError } = useAlert();
    const insets = useSafeAreaInsets();
    const [rapports, setRapports] = useState<RapportAvecEtablissement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            if (!patronSession) return;
            (async () => {
                setIsLoading(true);
                try {
                    const etablissements = await api.get<ServerEtablissement[]>("/etablissements", patronSession.token);
                    const parEtablissement = await Promise.all(
                        etablissements.map(async (etab) => {
                            const rapportsEtab = await api.get<ServerRapport[]>(`/etablissements/${etab.id}/rapports`, patronSession.token);
                            return rapportsEtab.map((r) => ({ ...r, etablissement_nom: etab.nom }));
                        })
                    );
                    const tous = parEtablissement.flat().sort((a, b) => b.date_generation.localeCompare(a.date_generation));
                    setRapports(tous);
                } catch (error) {
                    showError(error instanceof Error ? error.message : "Impossible de charger les rapports.");
                } finally {
                    setIsLoading(false);
                }
            })();
        }, [patronSession, showError])
    );

    return (
        <View style={{ flex: 1, paddingTop: insets.top }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom }}>
                <View style={{ height: theme.headerHeight, width: "100%", justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Rapports</Text>
                </View>

                <View style={{ paddingHorizontal: theme.screenPadding, gap: 8 }}>
                    {!isLoading && rapports.length === 0 && (
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5, marginTop: theme.internal_padding }}>
                            Aucun rapport synchronisé pour l'instant.
                        </Text>
                    )}
                    {rapports.map((rapport) => (
                        <View key={rapport.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{rapport.etablissement_nom}</Text>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterDateCourte(rapport.date_generation)}</Text>
                            </View>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: (rapport.ecart ?? 0) === 0 ? "#0f86e7" : "#e74c3c" }}>
                                Écart : {formaterMontant(rapport.ecart ?? 0)}
                            </Text>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>
                                Entrées : {formaterMontant(rapport.total_entrees)} · Sorties : {formaterMontant(rapport.total_sorties)}
                            </Text>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>
                                Réappro : {formaterMontant(rapport.montant_reappro)} ({rapport.nombre_reappro}) · Commandes : {rapport.nombre_commandes} ({formaterMontant(rapport.montant_commandes)})
                            </Text>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>
                                Quantité perdue : {rapport.quantite_perdue} · Écarts d'inventaire : {rapport.nombre_ecarts_inventaire}
                            </Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
