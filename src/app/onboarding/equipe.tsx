import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { Role } from "@/Database/db";
import { router } from "expo-router";
import { ArrowLeft, Plus } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const ROLES: { value: Role; label: string }[] = [
    { value: "gerant", label: "Gérant" },
    { value: "serveur", label: "Serveur" },
    { value: "caissier", label: "Caissier" },
];

const ROLE_LABELS: Record<Role, string> = {
    patron: "Patron",
    gerant: "Gérant",
    serveur: "Serveur",
    caissier: "Caissier",
};

export default function OnboardingEquipeScreen() {
    const { utilisateursQuery, addUtilisateur } = useDatabase();
    const { signIn } = useAuth();
    const { showError } = useAlert();

    const [nouvelUtilisateur, setNouvelUtilisateur] = useState({ nom: "", code: "", role: "serveur" as Role });

    const utilisateurs = (utilisateursQuery?.findAll() ?? []).slice().sort((a, b) => a.nom.localeCompare(b.nom));

    const handleAjouter = async () => {
        if (!nouvelUtilisateur.nom.trim() || nouvelUtilisateur.code.trim().length !== 4) {
            showError("Le nom et un code PIN à 4 chiffres sont requis.");
            return;
        }
        const created = await addUtilisateur({ nom: nouvelUtilisateur.nom.trim(), code: nouvelUtilisateur.code.trim(), role: nouvelUtilisateur.role });
        if (!created) {
            showError("Ce code PIN est déjà utilisé. Choisissez-en un autre.");
            return;
        }
        setNouvelUtilisateur({ nom: "", code: "", role: "serveur" });
    };

    const handleTerminer = async () => {
        const patron = utilisateursQuery?.findAll().find((u) => u.role === "patron");
        if (!patron) return;
        await signIn(patron);
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Étape 3/3</Text>
                        <Text style={{ fontSize: theme.size_three }}>Ajoutez votre équipe (facultatif)</Text>
                    </View>
                </View>

                <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    <TextInput
                        value={nouvelUtilisateur.nom}
                        onChangeText={(nom) => setNouvelUtilisateur((prev) => ({ ...prev, nom }))}
                        placeholder="Nom"
                        placeholderTextColor={"#aaaaaa"}
                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                    />
                    <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                        <TextInput
                            value={nouvelUtilisateur.code}
                            onChangeText={(code) => setNouvelUtilisateur((prev) => ({ ...prev, code }))}
                            placeholder="Code (PIN)"
                            placeholderTextColor={"#aaaaaa"}
                            keyboardType="number-pad"
                            maxLength={4}
                            style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                        />
                        <TouchableOpacity
                            onPress={handleAjouter}
                            style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", width: theme.touchTarget }}
                        >
                            <Plus color="white" size={20} strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.internal_padding_2 }}>
                        {ROLES.map((option) => {
                            const isSelected = nouvelUtilisateur.role === option.value;
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => setNouvelUtilisateur((prev) => ({ ...prev, role: option.value }))}
                                    style={{ paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, borderRadius: theme.internal_radius_2, backgroundColor: isSelected ? "#0f86e7" : "#f5f5f5" }}
                                >
                                    <Text style={{ fontSize: theme.size_one, color: isSelected ? "white" : "black" }}>{option.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: 8, paddingVertical: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        {utilisateurs.map((utilisateur) => (
                            <View
                                key={utilisateur.id}
                                style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                            >
                                <Text style={{ fontSize: theme.size_two }}>{utilisateur.nom}</Text>
                                <Text style={{ fontSize: theme.size_one, color: "#0f86e7" }}>{ROLE_LABELS[utilisateur.role]}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    <TouchableOpacity
                        onPress={handleTerminer}
                        style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Terminer</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
