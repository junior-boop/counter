import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { Role, Utilisateur } from "@/Database/db";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../constants/constant-style";

const ROLE_LABELS: Record<Role, string> = {
    patron: "Patron",
    gerant: "Gérant",
    serveur: "Serveur",
    caissier: "Caissier",
};

export default function LoginScreen() {
    const { utilisateursQuery, etablissement } = useDatabase();
    const { signIn } = useAuth();
    const { showError } = useAlert();

    const [selectedUtilisateur, setSelectedUtilisateur] = useState<Utilisateur | null>(null);
    const [pin, setPin] = useState("");

    const utilisateurs = (utilisateursQuery?.findAll() ?? []).slice().sort((a, b) => a.nom.localeCompare(b.nom));

    const handleValider = async () => {
        if (!selectedUtilisateur) return;
        if (pin !== selectedUtilisateur.code) {
            showError("Code PIN incorrect.");
            setPin("");
            return;
        }
        await signIn(selectedUtilisateur);
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>{etablissement?.nom || "Connexion"}</Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                        {selectedUtilisateur ? "Saisissez votre code PIN" : "Sélectionnez votre nom pour vous connecter"}
                    </Text>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        {!selectedUtilisateur ? (
                            <View style={{ gap: 8 }}>
                                {utilisateurs.map((utilisateur) => (
                                    <TouchableOpacity
                                        key={utilisateur.id}
                                        onPress={() => {
                                            setSelectedUtilisateur(utilisateur);
                                            setPin("");
                                        }}
                                        style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                    >
                                        <Text style={{ fontSize: theme.size_two }}>{utilisateur.nom}</Text>
                                        <Text style={{ fontSize: theme.size_one, color: "#0f86e7" }}>{ROLE_LABELS[utilisateur.role]}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
                                <TouchableOpacity
                                    onPress={() => setSelectedUtilisateur(null)}
                                    style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}
                                >
                                    <ArrowLeft color="black" size={18} strokeWidth={1.5} />
                                    <Text style={{ fontSize: theme.size_two }}>{selectedUtilisateur.nom}</Text>
                                </TouchableOpacity>
                                <TextInput
                                    value={pin}
                                    onChangeText={setPin}
                                    placeholder="Code PIN"
                                    placeholderTextColor={"#aaaaaa"}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry
                                    autoFocus
                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, textAlign: "center", letterSpacing: 8 }}
                                />
                                <TouchableOpacity
                                    onPress={handleValider}
                                    style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                                >
                                    <Text style={{ fontSize: theme.size_two, color: "white" }}>Valider</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
