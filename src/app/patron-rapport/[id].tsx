import { useAlert } from "@/components/alert/alert.context";
import { RapportDetail } from "@/components/RapportDetail";
import { Text } from "@/components/text";
import { ApiError, api } from "@/lib/api";
import { formaterDateCourte } from "@/lib/date";
import { parseRapportDetails } from "@/lib/rapportDetails";
import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { ServerRapport } from "@/Sync/serverTypes";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import theme from "../../constants/constant-style";

export default function PatronRapportDetailScreen() {
    const { id, etablissementId } = useLocalSearchParams<{ id: string; etablissementId: string }>();
    const { patronSession } = usePatronAuth();
    const { showError } = useAlert();

    const [rapport, setRapport] = useState<ServerRapport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [erreurConnexion, setErreurConnexion] = useState<string | null>(null);

    const charger = useCallback(async () => {
        if (!patronSession || !etablissementId) return;
        setErreurConnexion(null);
        try {
            const rapports = await api.get<ServerRapport[]>(`/etablissements/${etablissementId}/rapports`, patronSession.token);
            setRapport(rapports.find((r) => r.id === id) ?? null);
        } catch (error) {
            setErreurConnexion(error instanceof ApiError ? error.message : "Impossible de se connecter au serveur.");
        } finally {
            setIsLoading(false);
        }
    }, [id, etablissementId, patronSession]);

    useFocusEffect(
        useCallback(() => {
            void charger();
        }, [charger])
    );

    return (
        <View style={{ flex: 1 }}>
            <Stack.Screen options={{ title: "Rapport", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    {isLoading && (
                        <View style={{ paddingTop: theme.internal_padding, width: "100%", height: 400, justifyContent: "center", alignItems: "center" }}>
                            <ActivityIndicator size="large" color="#0f86e7" />
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Chargement...</Text>
                        </View>
                    )}
                    {!isLoading && erreurConnexion && (
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>{erreurConnexion}</Text>
                    )}
                    {!isLoading && !erreurConnexion && !rapport && (
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Rapport introuvable.</Text>
                    )}
                    {!isLoading && rapport && (
                        <>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                Session du {formaterDateCourte(rapport.session_date_fermeture ?? rapport.session_date_ouverture)}
                            </Text>
                            <RapportDetail
                                session={{
                                    date_ouverture: rapport.session_date_ouverture,
                                    date_fermeture: rapport.session_date_fermeture,
                                    montant_ouverture: rapport.montant_ouverture,
                                    montant_fermeture: rapport.montant_fermeture,
                                    ecart: rapport.ecart,
                                }}
                                rapport={rapport}
                                details={parseRapportDetails(rapport.details)}
                            />
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
