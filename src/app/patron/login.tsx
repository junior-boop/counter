import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { ApiError, api } from "@/lib/api";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

interface LoginResponse {
    token: string;
    patron: { id: string; email: string };
}

export default function PatronLoginScreen() {
    const { signIn } = usePatronAuth();
    const { showError } = useAlert();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConnexion = async () => {
        if (!email.trim() || !password) {
            showError("Email et mot de passe requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await api.post<LoginResponse>("/auth/login", { email: email.trim(), password });
            await signIn({ token: result.token, patronId: result.patron.id, email: result.patron.email });
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Connexion impossible.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Espace patron</Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Connectez-vous avec votre compte patron</Text>
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
                                placeholder="Mot de passe"
                                placeholderTextColor={"#aaaaaa"}
                                secureTextEntry
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />
                            <TouchableOpacity
                                onPress={handleConnexion}
                                disabled={isSubmitting}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: isSubmitting ? 0.6 : 1 }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>Se connecter</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => router.push("/patron/signup")} style={{ paddingVertical: theme.internal_padding, alignItems: "center" }}>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>Créer un compte patron</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
