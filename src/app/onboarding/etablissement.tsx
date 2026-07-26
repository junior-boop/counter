import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { TypeEtablissement } from "@/Database/db";
import { router } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const TYPES_ETABLISSEMENT: { value: TypeEtablissement; label: string }[] = [
    { value: "bar", label: "Snack-Bar | Bars" },
    { value: "restaurant", label: "Café | Restaurants" },
    { value: "les_deux", label: "Les deux" },
];

export default function OnboardingEtablissementScreen() {
    const { updateEtablissement } = useDatabase();
    const { showError } = useAlert();
    const [nom, setNom] = useState("");
    const [type, setType] = useState<TypeEtablissement>("les_deux");

    const handleContinuer = async () => {
        if (!nom.trim()) {
            showError("Le nom de l'établissement est requis.");
            return;
        }
        await updateEtablissement({ nom: nom.trim(), type, commande_temps_reel_active: false });
        router.push("/onboarding/equipe");
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Étape 2/3</Text>
                        <Text style={{ fontSize: theme.size_three }}>Configurez votre établissement</Text>
                    </View>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                            <TextInput
                                value={nom}
                                onChangeText={setNom}
                                placeholder="Nom de l'établissement"
                                placeholderTextColor={"#aaaaaa"}
                                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />

                            <View style={{ gap: 3, overflow: "hidden", borderRadius: theme.internal_radius_2 }}>
                                {TYPES_ETABLISSEMENT.map((option) => {
                                    const isSelected = type === option.value;
                                    return (
                                        <TouchableOpacity
                                            key={option.value}
                                            onPress={() => setType(option.value)}
                                            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: isSelected ? "#eaf4fd" : "#f5f5f5", paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding }}
                                        >
                                            <Text style={{ fontSize: theme.size_two, color: isSelected ? "#0f86e7" : "black" }}>{option.label}</Text>
                                            {isSelected && <Check color="#0f86e7" size={18} strokeWidth={2} />}
                                        </TouchableOpacity>
                                    );
                                })}
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
