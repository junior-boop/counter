import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { ApiError } from "@/lib/api";
import * as Sync from "@/Sync/pairing";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

export default function OnboardingPairingScreen() {
    const { showError } = useAlert();
    const { refreshLocalData } = useDatabase();
    const [code, setCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleValider = async () => {
        if (code.trim().length === 0) {
            showError("Saisissez le code fourni par le patron.");
            return;
        }
        setIsSubmitting(true);
        try {
            await Sync.pairEtablissement(code.trim().toUpperCase());
            await refreshLocalData(["etablissement", "utilisateurs"]);
            router.replace("/login");
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Code invalide ou expiré.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Lier cet établissement</Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Saisissez le code fourni par le patron</Text>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
                            <TextInput
                                value={code}
                                onChangeText={setCode}
                                placeholder="CODE"
                                placeholderTextColor={"#aaaaaa"}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, textAlign: "center", letterSpacing: 6 }}
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
