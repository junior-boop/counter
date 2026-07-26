import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { Role, Utilisateur } from "@/Database/db";
import { router } from "expo-router";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../constants/constant-style";

const ROLES: { value: Role; label: string }[] = [
    { value: "patron", label: "Patron" },
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

function RoleSelector({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
    return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.internal_padding_2 }}>
            {ROLES.map((option) => {
                const isSelected = value === option.value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        style={{ paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, borderRadius: theme.internal_radius_2, backgroundColor: isSelected ? "#0f86e7" : "#f5f5f5" }}
                    >
                        <Text style={{ fontSize: theme.size_one, color: isSelected ? "white" : "black" }}>{option.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function UtilisateursScreen() {
    const { utilisateursQuery, addUtilisateur, updateUtilisateur, deleteUtilisateur } = useDatabase();
    const { showError, confirm } = useAlert();

    const [nouvelUtilisateur, setNouvelUtilisateur] = useState({ nom: "", code: "", role: "serveur" as Role });

    const [selectedUtilisateur, setSelectedUtilisateur] = useState<Utilisateur | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ nom: "", code: "", role: "serveur" as Role });

    const utilisateurs = (utilisateursQuery?.findAll() ?? []).slice().sort((a, b) => a.nom.localeCompare(b.nom));

    const handleAddUtilisateur = async () => {
        if (!nouvelUtilisateur.nom.trim() || !nouvelUtilisateur.code.trim()) {
            showError("Le nom et le code PIN sont requis.");
            return;
        }
        await addUtilisateur({ nom: nouvelUtilisateur.nom.trim(), code: nouvelUtilisateur.code.trim(), role: nouvelUtilisateur.role });
        setNouvelUtilisateur({ nom: "", code: "", role: "serveur" });
    };

    const closeSheet = () => {
        setSelectedUtilisateur(null);
        setIsEditing(false);
    };

    const openSheet = (utilisateur: Utilisateur) => {
        setSelectedUtilisateur(utilisateur);
        setIsEditing(false);
    };

    const startEditing = () => {
        if (!selectedUtilisateur) return;
        setEditForm({ nom: selectedUtilisateur.nom, code: selectedUtilisateur.code, role: selectedUtilisateur.role });
        setIsEditing(true);
    };

    const handleUpdateUtilisateur = async () => {
        if (!selectedUtilisateur) return;
        if (!editForm.nom.trim() || !editForm.code.trim()) {
            showError("Le nom et le code PIN sont requis.");
            return;
        }
        await updateUtilisateur({ ...selectedUtilisateur, nom: editForm.nom.trim(), code: editForm.code.trim(), role: editForm.role });
        closeSheet();
    };

    const handleDeleteUtilisateur = async () => {
        if (!selectedUtilisateur) return;
        const ok = await confirm(`Supprimer l'utilisateur "${selectedUtilisateur.nom}" ?`, { confirmLabel: "Supprimer" });
        if (!ok) return;
        await deleteUtilisateur(selectedUtilisateur.id);
        closeSheet();
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View>
                    <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: theme.size_three }}>Utilisateurs</Text>
                    </View>
                    <View style={{ paddingHorizontal: theme.screenPadding, borderBottomWidth: 1, borderBottomColor: "#e0e0e0", paddingBottom: theme.internal_padding, gap: theme.internal_padding_2 }}>
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
                                style={{ flex: 1, color: "black", backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                            />
                            <TouchableOpacity
                                onPress={handleAddUtilisateur}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", width: theme.touchTarget }}
                            >
                                <Plus color="white" size={20} strokeWidth={1.5} />
                            </TouchableOpacity>
                        </View>
                        <RoleSelector value={nouvelUtilisateur.role} onChange={(role) => setNouvelUtilisateur((prev) => ({ ...prev, role }))} />
                    </View>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: 8, paddingVertical: theme.internal_padding }}>
                        {utilisateurs.map((utilisateur) => (
                            <TouchableOpacity
                                key={utilisateur.id}
                                onPress={() => openSheet(utilisateur)}
                                style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                            >
                                <Text style={{ fontSize: theme.size_two }}>{utilisateur.nom}</Text>
                                <Text style={{ fontSize: theme.size_one, color: "#0f86e7" }}>{ROLE_LABELS[utilisateur.role]}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={selectedUtilisateur !== null} transparent animationType="slide" onRequestClose={closeSheet}>
                <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior="padding">
                    <View style={{ flex: 1, position: 'relative', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={closeSheet} />
                        <View style={{ backgroundColor: "white", padding: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth }}>
                            {!isEditing ? (
                                <>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{selectedUtilisateur?.nom}</Text>
                                    <TouchableOpacity
                                        onPress={startEditing}
                                        style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2, paddingVertical: theme.internal_padding_2 }}
                                    >
                                        <Pencil color="black" size={18} strokeWidth={1.5} />
                                        <Text style={{ fontSize: theme.size_two }}>Modifier</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleDeleteUtilisateur}
                                        style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2, paddingVertical: theme.internal_padding_2 }}
                                    >
                                        <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                                        <Text style={{ fontSize: theme.size_two, color: "#e74c3c" }}>Supprimer</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Modifier l'utilisateur</Text>
                                    <TextInput
                                        value={editForm.nom}
                                        onChangeText={(nom) => setEditForm((prev) => ({ ...prev, nom }))}
                                        placeholder="Nom"
                                        placeholderTextColor={"#aaaaaa"}
                                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                    />
                                    <TextInput
                                        value={editForm.code}
                                        onChangeText={(code) => setEditForm((prev) => ({ ...prev, code }))}
                                        placeholder="Code (PIN)"
                                        placeholderTextColor={"#aaaaaa"}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                    />
                                    <RoleSelector value={editForm.role} onChange={(role) => setEditForm((prev) => ({ ...prev, role }))} />
                                    <TouchableOpacity
                                        onPress={handleUpdateUtilisateur}
                                        style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                                    >
                                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Enregistrer</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
