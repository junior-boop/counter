import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

export default function OnboardingCompteScreen() {
    const { addUtilisateur } = useDatabase();
    const { showError } = useAlert();
    const [nom, setNom] = useState("");
    const [code, setCode] = useState("");

    const handleContinuer = async () => {
        if (!nom.trim() || code.trim().length !== 4) {
            showError("Le nom et un code PIN à 4 chiffres sont requis.");
            return;
        }
        const created = await addUtilisateur({ nom: nom.trim(), code: code.trim(), role: "patron" });
        if (!created) {
            showError("Ce code PIN est déjà utilisé. Choisissez-en un autre.");
            return;
        }
        router.push("/onboarding/etablissement");
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Étape 1/3</Text>
                    <Text style={{ fontSize: theme.size_four }}>Créez votre compte</Text>
                </View>
                <View style={{ paddingHorizontal: theme.screenPadding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5, marginBottom: theme.internal_padding_2 }}>
                        Créez votre compte propriétaire pour commencer à configurer votre établissement.
                    </Text>
                </View>
                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                Vous serez le propriétaire de l'établissement.
                            </Text>
                            <View style={{ gap: 4 }}>
                                <TextInput
                                    value={nom}
                                    onChangeText={setNom}
                                    placeholder="Votre nom"
                                    placeholderTextColor={"#aaaaaa"}
                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                />
                            </View>
                            <View style={{ gap: 4 }}>
                                <TextInput
                                    value={code}
                                    onChangeText={setCode}
                                    placeholder="Code PIN (4 chiffres)"
                                    placeholderTextColor={"#aaaaaa"}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry
                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={handleContinuer}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>Continuer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
