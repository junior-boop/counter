import { authentifierEmploye } from "@/Auth/employeAuth";
import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { synchroniserEmployes } from "@/Sync/employesSync";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../constants/constant-style";

export default function LoginScreen() {
    const { etablissement, refreshLocalData } = useDatabase();
    const { signIn } = useAuth();
    const { showError } = useAlert();

    const [telephone, setTelephone] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        void synchroniserEmployes(etablissement?.server_id).then(() => refreshLocalData(["utilisateurs"]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleValider = async () => {
        if (!telephone.trim() || !password) {
            showError("Numéro de téléphone et mot de passe requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            const utilisateur = await authentifierEmploye(telephone.trim(), password);
            await refreshLocalData(["utilisateurs"]);
            await signIn(utilisateur);
        } catch (error) {
            showError(error instanceof Error ? error.message : "Connexion impossible.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>{etablissement?.nom || "Connexion"}</Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Connectez-vous avec votre numéro et votre mot de passe</Text>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
                            <TextInput
                                value={telephone}
                                onChangeText={setTelephone}
                                placeholder="Numéro de téléphone"
                                placeholderTextColor={"#aaaaaa"}
                                keyboardType="phone-pad"
                                autoFocus
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Mot de passe"
                                placeholderTextColor={"#aaaaaa"}
                                secureTextEntry
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />
                            <TouchableOpacity
                                onPress={handleValider}
                                disabled={isSubmitting}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: isSubmitting ? 0.6 : 1 }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>Valider</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
