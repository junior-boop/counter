import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { ApiError, api } from "@/lib/api";
import { ServerEtablissement } from "@/Sync/serverTypes";
import { router } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const TYPES_ETABLISSEMENT: { value: string; label: string }[] = [
    { value: "bar", label: "Snack-Bar | Bars" },
    { value: "restaurant", label: "Café | Restaurants" },
    { value: "les_deux", label: "Les deux" },
];

export default function NouvelEtablissementScreen() {
    const { patronSession } = usePatronAuth();
    const { showError } = useAlert();
    const [nom, setNom] = useState("");
    const [type, setType] = useState("les_deux");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreer = async () => {
        if (!nom.trim() || !patronSession) {
            showError("Le nom de l'établissement est requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            const etab = await api.post<ServerEtablissement>("/etablissements", { nom: nom.trim(), type }, patronSession.token);
            router.replace({ pathname: "/patron-etablissement/[id]", params: { id: etab.id } });
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Création impossible.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: theme.size_three }}>Nouvel établissement</Text>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
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
                                onPress={handleCreer}
                                disabled={isSubmitting}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: isSubmitting ? 0.6 : 1 }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>Créer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
