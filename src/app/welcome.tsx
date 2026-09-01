import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../constants/constant-style";

export default function WelcomeScreen() {
    const { utilisateursQuery } = useDatabase();
    const hasAccount = (utilisateursQuery?.findAll().length ?? 0) > 0;

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                <View style={{ marginBottom: theme.internal_padding * 2, alignItems: "center" }}>
                    <Text style={{ fontSize: theme.size_six, textAlign: "center" }}>Bienvenue</Text>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5, textAlign: "center", width: "80%" }}>Gérez votre bar ou restaurant simplement.</Text>
                </View>

                {!hasAccount && (
                    <TouchableOpacity
                        onPress={() => router.push("/onboarding/pairing")}
                        style={{ backgroundColor: "white", borderRadius: theme.internal_radius, paddingVertical: theme.internal_padding, paddingHorizontal: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                        <View style={{ gap: 5, width: "80%" }} >
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>J'ai un code de pairing</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Liez cet appareil à un établissement de votre patron</Text>
                        </View>
                        <ChevronRight color="black" size={20} strokeWidth={1} />
                    </TouchableOpacity>
                )}

                {hasAccount && (
                    <TouchableOpacity
                        onPress={() => router.push("/login")}
                        style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius, paddingVertical: theme.internal_padding, paddingHorizontal: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                        <View style={{ gap: 5, width: "80%" }}>
                            <Text style={{ fontSize: theme.size_three, color: "white", fontWeight: "bold" }}>J'ai déjà un compte</Text>
                            <Text style={{ fontSize: theme.size_two, color: "white", opacity: 0.8 }}>Connectez-vous avec votre numéro et votre mot de passe</Text>
                        </View>
                        <ChevronRight color="white" size={20} strokeWidth={1} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={() => router.push("/patron/login")}
                    style={{ backgroundColor: "white", borderRadius: theme.internal_radius, paddingVertical: theme.internal_padding, paddingHorizontal: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                    <View style={{ gap: 5, width: "80%" }}>
                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Je suis patron</Text>
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Suivez vos établissements</Text>
                    </View>
                    <ChevronRight color="black" size={20} strokeWidth={1} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
