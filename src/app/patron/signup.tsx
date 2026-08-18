import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { ApiError, api } from "@/lib/api";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

interface SignupResponse {
    token: string;
    patron: { id: string; email: string };
}

export default function PatronSignupScreen() {
    const { signIn } = usePatronAuth();
    const { showError } = useAlert();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreation = async () => {
        if (!email.trim() || password.length < 8) {
            showError("Email requis et mot de passe d'au moins 8 caractères.");
            return;
        }
        if (password !== confirmation) {
            showError("Les mots de passe ne correspondent pas.");
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await api.post<SignupResponse>("/auth/signup", { email: email.trim(), password });
            await signIn({ token: result.token, patronId: result.patron.id, email: result.patron.email });
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Création du compte impossible.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Créer un compte patron</Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Pour suivre vos établissements à distance</Text>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Email"
                                placeholderTextColor={"#aaaaaa"}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Mot de passe (8 caractères min.)"
                                placeholderTextColor={"#aaaaaa"}
                                secureTextEntry
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />
                            <TextInput
                                value={confirmation}
                                onChangeText={setConfirmation}
                                placeholder="Confirmer le mot de passe"
                                placeholderTextColor={"#aaaaaa"}
                                secureTextEntry
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />
                            <TouchableOpacity
                                onPress={handleCreation}
                                disabled={isSubmitting}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: isSubmitting ? 0.6 : 1 }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>Créer le compte</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => router.push("/patron/login")} style={{ paddingVertical: theme.internal_padding, alignItems: "center" }}>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>J'ai déjà un compte</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
