import { useAuth } from "@/Auth/auth.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { synchroniserEtablissementPourPatron } from "@/Sync/patronSync";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import theme from "../../../constants/constant-style";

export default function PatronGererEtablissementScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { patronSession } = usePatronAuth();
    const { signIn } = useAuth();
    const { refreshLocalData } = useDatabase();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const chargerEtBasculer = async () => {
        if (!patronSession || !id) {
            setError("Session patron ou identifiant établissement introuvable.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Synchronise le catalogue de l'établissement et prépare l'utilisateur Patron local
            const patronUser = await synchroniserEtablissementPourPatron(
                id,
                patronSession.token,
                patronSession.patronId,
                patronSession.email
            );

            // 2. Connecte le patron en tant qu'utilisateur local actif avec tous les droits
            await signIn(patronUser);

            // 3. Rafraîchit les données du contexte
            await refreshLocalData([
                "etablissement",
                "categories",
                "produits",
                "utilisateurs",
                "sessionsCaisse",
                "mouvementsCaisse",
                "commandes",
                "lignesCommande",
                "mouvementsStock",
                "sessionsStock",
                "produitsActifs",
            ]);

            // 4. Redirige directement vers l'interface de travail
            router.replace("/(tabs)");
        } catch (err: any) {
            setError(err?.message || "Impossible de synchroniser cet établissement.");
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void chargerEtBasculer();
    }, [id, patronSession]);

    return (
        <View style={{ flex: 1, backgroundColor: "#f8f9fa", justifyContent: "center", alignItems: "center", padding: theme.screenPadding }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#e3f2fd", justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
                <ShieldCheck size={36} color="#0f86e7" strokeWidth={1.75} />
            </View>

            <Text style={{ fontSize: theme.size_three, fontWeight: "600", color: "#111827", textAlign: "center", marginBottom: 8 }}>
                Accès Administrateur
            </Text>

            {isLoading && (
                <View style={{ alignItems: "center", gap: 14, marginTop: 10 }}>
                    <ActivityIndicator size="large" color="#0f86e7" />
                    <Text style={{ fontSize: theme.size_two, color: "#6b7280", textAlign: "center", maxWidth: 280 }}>
                        Chargement du stock, de la caisse et des commandes de l'établissement...
                    </Text>
                </View>
            )}

            {error && (
                <View style={{ alignItems: "center", gap: 16, marginTop: 16, width: "100%" }}>
                    <Text style={{ fontSize: theme.size_two, color: "#dc2626", textAlign: "center" }}>
                        {error}
                    </Text>

                    <TouchableOpacity
                        onPress={chargerEtBasculer}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: "#0f86e7",
                            paddingVertical: 12,
                            paddingHorizontal: 20,
                            borderRadius: 8,
                        }}
                    >
                        <RefreshCw size={18} color="#fff" />
                        <Text style={{ color: "#fff", fontWeight: "600" }}>Réessayer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingVertical: 10,
                        }}
                    >
                        <ArrowLeft size={18} color="#6b7280" />
                        <Text style={{ color: "#6b7280" }}>Retourner à l'établissement</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
