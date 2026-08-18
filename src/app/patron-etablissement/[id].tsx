import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { ApiError, api } from "@/lib/api";
import { formaterMontant } from "@/lib/currency";
import { formaterDateCourte, formaterHeure } from "@/lib/date";
import { ServerEtablissement, ServerRapport } from "@/Sync/serverTypes";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { RefreshCw } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import theme from "../../constants/constant-style";

const TYPE_LABELS: Record<string, string> = {
    bar: "Snack-Bar | Bars",
    restaurant: "Café | Restaurants",
    les_deux: "Les deux",
};

export default function PatronEtablissementDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { patronSession } = usePatronAuth();
    const { showError } = useAlert();

    const [etablissement, setEtablissement] = useState<ServerEtablissement | null>(null);
    const [rapports, setRapports] = useState<ServerRapport[]>([]);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const charger = useCallback(async () => {
        if (!patronSession || !id) return;
        try {
            const [etab, rapportsEtab] = await Promise.all([
                api.get<ServerEtablissement>(`/etablissements/${id}`, patronSession.token),
                api.get<ServerRapport[]>(`/etablissements/${id}/rapports`, patronSession.token),
            ]);
            setEtablissement(etab);
            setRapports(rapportsEtab);
        } catch (error) {
            showError(error instanceof Error ? error.message : "Impossible de charger l'établissement.");
        }
    }, [id, patronSession, showError]);

    useFocusEffect(
        useCallback(() => {
            void charger();
        }, [charger])
    );

    const handleRegenererCode = async () => {
        if (!patronSession || !id) return;
        setIsRegenerating(true);
        try {
            await api.post(`/etablissements/${id}/pairing-code`, undefined, patronSession.token);
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible de générer un nouveau code.");
        } finally {
            setIsRegenerating(false);
        }
    };

    const codeExpire = etablissement?.pairing_code_expires_at ? etablissement.pairing_code_expires_at < new Date().toISOString() : false;

    return (
        <View style={{ flex: 1 }}>
            <Stack.Screen options={{ title: etablissement?.nom ?? "Établissement", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            {!etablissement ? (
                <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding }}>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Chargement...</Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{etablissement.nom}</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{TYPE_LABELS[etablissement.type] ?? etablissement.type}</Text>
                        </View>

                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Liaison</Text>
                            {etablissement.paired_at ? (
                                <Text style={{ fontSize: theme.size_two, color: "#0f86e7" }}>Lié à un appareil</Text>
                            ) : (
                                <>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                        Saisissez ce code dans Préférences → Synchronisation sur l'appareil de l'établissement.
                                    </Text>
                                    <Text style={{ fontSize: theme.size_six, letterSpacing: 4, textAlign: "center", color: codeExpire ? "#e74c3c" : "#0f86e7" }}>
                                        {etablissement.pairing_code ?? "----"}
                                    </Text>
                                    {codeExpire && <Text style={{ fontSize: theme.size_one, color: "#e74c3c", textAlign: "center" }}>Ce code a expiré.</Text>}
                                    <TouchableOpacity
                                        onPress={handleRegenererCode}
                                        disabled={isRegenerating}
                                        style={{ flexDirection: "row", gap: theme.internal_padding_2, alignItems: "center", justifyContent: "center", backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding, opacity: isRegenerating ? 0.6 : 1 }}
                                    >
                                        <RefreshCw color="white" size={16} strokeWidth={1.5} />
                                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Générer un nouveau code</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Rapports</Text>
                            {rapports.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun rapport synchronisé pour l'instant.</Text>
                            )}
                            {rapports.map((rapport) => (
                                <View key={rapport.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{formaterDateCourte(rapport.date_generation)}</Text>
                                        <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterHeure(rapport.date_generation)}</Text>
                                    </View>
                                    <Text style={{ fontSize: theme.size_two, color: (rapport.ecart ?? 0) === 0 ? "#0f86e7" : "#e74c3c" }}>
                                        Écart : {formaterMontant(rapport.ecart ?? 0)}
                                    </Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>
                                        Entrées : {formaterMontant(rapport.total_entrees)} · Sorties : {formaterMontant(rapport.total_sorties)}
                                    </Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>
                                        Commandes : {rapport.nombre_commandes} ({formaterMontant(rapport.montant_commandes)})
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}
