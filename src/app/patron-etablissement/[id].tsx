import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { Text } from "@/components/text";
import { ApiError, api } from "@/lib/api";
import { formaterMontant } from "@/lib/currency";
import { formaterDateCourte, formaterHeure } from "@/lib/date";
import { ServerEmploye, ServerEtablissement, ServerRapport } from "@/Sync/serverTypes";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import theme from "../../constants/constant-style";

const TYPE_LABELS: Record<string, string> = {
    bar: "Snack-Bar | Bars",
    restaurant: "Café | Restaurants",
    les_deux: "Les deux",
};

const ROLES_EMPLOYE = ["gerant", "serveur", "caissier"] as const;
type RoleEmploye = (typeof ROLES_EMPLOYE)[number];

const ROLE_LABELS: Record<RoleEmploye, string> = {
    gerant: "Gérant",
    serveur: "Serveur",
    caissier: "Caissier",
};

const EMPTY_ADD_FORM = { nom: "", telephone: "", password: "", role: "serveur" as RoleEmploye };

export default function PatronEtablissementDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { patronSession } = usePatronAuth();
    const { showError, confirm } = useAlert();

    const [etablissement, setEtablissement] = useState<ServerEtablissement | null>(null);
    const [rapports, setRapports] = useState<ServerRapport[]>([]);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const [employes, setEmployes] = useState<ServerEmploye[]>([]);
    const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedEmploye, setSelectedEmploye] = useState<ServerEmploye | null>(null);
    const [editForm, setEditForm] = useState({ nom: "", telephone: "", password: "", role: "serveur" as RoleEmploye });

    const charger = useCallback(async () => {
        if (!patronSession || !id) return;
        try {
            const [etab, rapportsEtab, employesEtab] = await Promise.all([
                api.get<ServerEtablissement>(`/etablissements/${id}`, patronSession.token),
                api.get<ServerRapport[]>(`/etablissements/${id}/rapports`, patronSession.token),
                api.get<ServerEmploye[]>(`/etablissements/${id}/employes`, patronSession.token),
            ]);
            setEtablissement(etab);
            setRapports(rapportsEtab);
            setEmployes(employesEtab);
        } catch (error) {
            showError(error instanceof Error ? error.message : "Impossible de charger l'établissement.");
        }
    }, [id, patronSession, showError]);

    useFocusEffect(
        useCallback(() => {
            void charger();
        }, [charger])
    );

    const handleRegenererCode = async () => {
        if (!patronSession || !id) return;
        setIsRegenerating(true);
        try {
            await api.post(`/etablissements/${id}/pairing-code`, undefined, patronSession.token);
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible de générer un nouveau code.");
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleAddEmploye = async () => {
        if (!patronSession || !id) return;
        if (!addForm.nom.trim() || !addForm.telephone.trim() || !addForm.password) {
            showError("Nom, téléphone et mot de passe requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post(`/etablissements/${id}/employes`, {
                nom: addForm.nom.trim(),
                telephone: addForm.telephone.trim(),
                password: addForm.password,
                role: addForm.role,
            }, patronSession.token);
            setAddForm(EMPTY_ADD_FORM);
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible d'ajouter cet employé.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEmployeSheet = (employe: ServerEmploye) => {
        setSelectedEmploye(employe);
        setEditForm({ nom: employe.nom, telephone: employe.telephone, password: "", role: employe.role });
    };

    const closeEmployeSheet = () => setSelectedEmploye(null);

    const handleUpdateEmploye = async () => {
        if (!patronSession || !id || !selectedEmploye) return;
        if (!editForm.nom.trim() || !editForm.telephone.trim()) {
            showError("Nom et téléphone requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            const body: Record<string, string> = { nom: editForm.nom.trim(), telephone: editForm.telephone.trim(), role: editForm.role };
            if (editForm.password) body.password = editForm.password;
            await api.patch(`/etablissements/${id}/employes/${selectedEmploye.id}`, body, patronSession.token);
            closeEmployeSheet();
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible de modifier cet employé.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEmploye = async () => {
        if (!patronSession || !id || !selectedEmploye) return;
        const ok = await confirm(`Supprimer ${selectedEmploye.nom} ?`, { confirmLabel: "Supprimer" });
        if (!ok) return;
        setIsSubmitting(true);
        try {
            await api.delete(`/etablissements/${id}/employes/${selectedEmploye.id}`, patronSession.token);
            closeEmployeSheet();
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible de supprimer cet employé.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const codeExpire = etablissement?.pairing_code_expires_at ? etablissement.pairing_code_expires_at < new Date().toISOString() : false;

    return (
        <View style={{ flex: 1 }}>
            <Stack.Screen options={{ title: etablissement?.nom ?? "Établissement", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            {!etablissement ? (
                <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding }}>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Chargement...</Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{etablissement.nom}</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{TYPE_LABELS[etablissement.type] ?? etablissement.type}</Text>
                        </View>

                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Liaison</Text>
                            {etablissement.paired_at ? (
                                <Text style={{ fontSize: theme.size_two, color: "#0f86e7" }}>Lié à un appareil</Text>
                            ) : (
                                <>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                        Saisissez ce code sur l'écran d'accueil de l'appareil de l'établissement (« J'ai un code de pairing »).
                                    </Text>
                                    <Text style={{ fontSize: theme.size_six, letterSpacing: 4, textAlign: "center", color: codeExpire ? "#e74c3c" : "#0f86e7" }}>
                                        {etablissement.pairing_code ?? "----"}
                                    </Text>
                                    {codeExpire && <Text style={{ fontSize: theme.size_one, color: "#e74c3c", textAlign: "center" }}>Ce code a expiré.</Text>}
                                    <TouchableOpacity
                                        onPress={handleRegenererCode}
                                        disabled={isRegenerating}
                                        style={{ flexDirection: "row", gap: theme.internal_padding_2, alignItems: "center", justifyContent: "center", backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding, opacity: isRegenerating ? 0.6 : 1 }}
                                    >
                                        <RefreshCw color="white" size={16} strokeWidth={1.5} />
                                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Générer un nouveau code</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Employés</Text>
                            {employes.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun employé pour l'instant.</Text>
                            )}
                            {employes.map((employe) => (
                                <TouchableOpacity
                                    key={employe.id}
                                    onPress={() => openEmployeSheet(employe)}
                                    style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                >
                                    <View style={{ gap: 2 }}>
                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{employe.nom}</Text>
                                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{employe.telephone} · {ROLE_LABELS[employe.role]}</Text>
                                    </View>
                                    <Pencil color="black" size={16} strokeWidth={1.5} />
                                </TouchableOpacity>
                            ))}

                            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 8, marginTop: 4 }}>
                                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Ajouter un employé</Text>
                                <TextInput
                                    value={addForm.nom}
                                    onChangeText={(nom) => setAddForm((prev) => ({ ...prev, nom }))}
                                    placeholder="Nom"
                                    placeholderTextColor={"#aaaaaa"}
                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                />
                                <TextInput
                                    value={addForm.telephone}
                                    onChangeText={(telephone) => setAddForm((prev) => ({ ...prev, telephone }))}
                                    placeholder="Téléphone"
                                    placeholderTextColor={"#aaaaaa"}
                                    keyboardType="phone-pad"
                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                />
                                <TextInput
                                    value={addForm.password}
                                    onChangeText={(password) => setAddForm((prev) => ({ ...prev, password }))}
                                    placeholder="Mot de passe"
                                    placeholderTextColor={"#aaaaaa"}
                                    secureTextEntry
                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                />
                                <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                                    {ROLES_EMPLOYE.map((role) => (
                                        <TouchableOpacity
                                            key={role}
                                            onPress={() => setAddForm((prev) => ({ ...prev, role }))}
                                            style={{ flex: 1, borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding_2, alignItems: "center", backgroundColor: addForm.role === role ? "#0f86e7" : "#f5f5f5" }}
                                        >
                                            <Text style={{ fontSize: theme.size_one, color: addForm.role === role ? "white" : "black" }}>{ROLE_LABELS[role]}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity
                                    onPress={handleAddEmploye}
                                    disabled={isSubmitting}
                                    style={{ flexDirection: "row", gap: theme.internal_padding_2, backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                                >
                                    <Plus color="white" size={18} strokeWidth={1.5} />
                                    <Text style={{ fontSize: theme.size_two, color: "white" }}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Rapports</Text>
                            {rapports.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun rapport synchronisé pour l'instant.</Text>
                            )}
                            {rapports.map((rapport) => (
                                <View key={rapport.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{formaterDateCourte(rapport.date_generation)}</Text>
                                        <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterHeure(rapport.date_generation)}</Text>
                                    </View>
                                    <Text style={{ fontSize: theme.size_two, color: (rapport.ecart ?? 0) === 0 ? "#0f86e7" : "#e74c3c" }}>
                                        Écart : {formaterMontant(rapport.ecart ?? 0)}
                                    </Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>
                                        Entrées : {formaterMontant(rapport.total_entrees)} · Sorties : {formaterMontant(rapport.total_sorties)}
                                    </Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>
                                        Commandes : {rapport.nombre_commandes} ({formaterMontant(rapport.montant_commandes)})
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            )}

            <BottomSheet visible={selectedEmploye !== null} onClose={closeEmployeSheet}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Modifier l'employé</Text>
                <View style={{ gap: 8, marginTop: theme.internal_padding }}>
                    <TextInput
                        value={editForm.nom}
                        onChangeText={(nom) => setEditForm((prev) => ({ ...prev, nom }))}
                        placeholder="Nom"
                        placeholderTextColor={"#aaaaaa"}
                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                    />
                    <TextInput
                        value={editForm.telephone}
                        onChangeText={(telephone) => setEditForm((prev) => ({ ...prev, telephone }))}
                        placeholder="Téléphone"
                        placeholderTextColor={"#aaaaaa"}
                        keyboardType="phone-pad"
                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                    />
                    <TextInput
                        value={editForm.password}
                        onChangeText={(password) => setEditForm((prev) => ({ ...prev, password }))}
                        placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                        placeholderTextColor={"#aaaaaa"}
                        secureTextEntry
                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                    />
                    <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                        {ROLES_EMPLOYE.map((role) => (
                            <TouchableOpacity
                                key={role}
                                onPress={() => setEditForm((prev) => ({ ...prev, role }))}
                                style={{ flex: 1, borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding_2, alignItems: "center", backgroundColor: editForm.role === role ? "#0f86e7" : "#f5f5f5" }}
                            >
                                <Text style={{ fontSize: theme.size_one, color: editForm.role === role ? "white" : "black" }}>{ROLE_LABELS[role]}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity
                        onPress={handleUpdateEmploye}
                        disabled={isSubmitting}
                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Enregistrer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleDeleteEmploye}
                        disabled={isSubmitting}
                        style={{ flexDirection: "row", gap: theme.internal_padding_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding_2, opacity: isSubmitting ? 0.5 : 1 }}
                    >
                        <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, color: "#e74c3c" }}>Supprimer</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheet>
        </View>
    );
}
