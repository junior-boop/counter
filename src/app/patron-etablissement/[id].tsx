import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { Text } from "@/components/text";
import { ApiError, api } from "@/lib/api";
import { formaterMontant } from "@/lib/currency";
import { formaterDateCourte, formaterHeure } from "@/lib/date";
import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { ServerCategorie, ServerEmploye, ServerEtablissement, ServerProduit, ServerRapport } from "@/Sync/serverTypes";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ChevronRight, Eye, EyeOff, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import theme from "../../constants/constant-style";

const TYPE_LABELS: Record<string, string> = {
    bar: "Snack-Bar | Bars",
    restaurant: "Café | Restaurants",
    les_deux: "Les deux",
};

const ROLES_EMPLOYE = ["gerant", "serveur", "caissier"] as const;
type RoleEmploye = (typeof ROLES_EMPLOYE)[number];

const MAX_EMPLOYES = 2;

const ROLE_LABELS: Record<RoleEmploye, string> = {
    gerant: "Gérant",
    serveur: "Serveur",
    caissier: "Caissier",
};

const EMPTY_ADD_FORM = { nom: "", telephone: "", password: "", role: "serveur" as RoleEmploye };

const TYPES_ACTIVITE_CATALOGUE = ["bar", "restaurant"] as const;
type TypeActiviteCatalogue = (typeof TYPES_ACTIVITE_CATALOGUE)[number];
const TYPE_ACTIVITE_LABELS: Record<TypeActiviteCatalogue, string> = {
    bar: "Bar",
    restaurant: "Restaurant",
};
const EMPTY_CATEGORIE_FORM = { nom: "", type: "bar" as TypeActiviteCatalogue };

export default function PatronEtablissementDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { patronSession } = usePatronAuth();
    const { showError, confirm } = useAlert();

    const [etablissement, setEtablissement] = useState<ServerEtablissement | null>(null);
    const [rapports, setRapports] = useState<ServerRapport[]>([]);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [rapportOuvertId, setRapportOuvertId] = useState<string | null>(null);

    const [employes, setEmployes] = useState<ServerEmploye[]>([]);
    const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
    const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedEmploye, setSelectedEmploye] = useState<ServerEmploye | null>(null);
    const [editForm, setEditForm] = useState({ nom: "", telephone: "", password: "", role: "serveur" as RoleEmploye });
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    const [categories, setCategories] = useState<ServerCategorie[]>([]);
    const [produits, setProduits] = useState<ServerProduit[]>([]);
    const [isCategorieSheetOpen, setIsCategorieSheetOpen] = useState(false);
    const [categorieForm, setCategorieForm] = useState(EMPTY_CATEGORIE_FORM);

    const charger = useCallback(async () => {
        if (!patronSession || !id) return;
        try {
            const [etab, rapportsEtab, employesEtab, categoriesEtab, produitsEtab] = await Promise.all([
                api.get<ServerEtablissement>(`/etablissements/${id}`, patronSession.token),
                api.get<ServerRapport[]>(`/etablissements/${id}/rapports`, patronSession.token),
                api.get<ServerEmploye[]>(`/etablissements/${id}/employes`, patronSession.token),
                api.get<ServerCategorie[]>(`/etablissements/${id}/categories`, patronSession.token),
                api.get<ServerProduit[]>(`/etablissements/${id}/produits`, patronSession.token),
            ]);
            setEtablissement(etab);
            setRapports(rapportsEtab);
            setEmployes(employesEtab);
            setCategories(categoriesEtab);
            setProduits(produitsEtab);
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
            setIsAddSheetOpen(false);
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
        setShowEditPassword(false);
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

    const handleAddCategorie = async () => {
        if (!patronSession || !id) return;
        if (!categorieForm.nom.trim()) {
            showError("Le nom de la catégorie est requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post(`/etablissements/${id}/categories`, { nom: categorieForm.nom.trim(), type: categorieForm.type }, patronSession.token);
            setCategorieForm(EMPTY_CATEGORIE_FORM);
            setIsCategorieSheetOpen(false);
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible d'ajouter cette catégorie.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const codeExpire = etablissement?.pairing_code_expires_at ? etablissement.pairing_code_expires_at < new Date().toISOString() : false;

    const addFormFields = (
        <>
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
            <View style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, flexDirection: "row", alignItems: "center" }}>
                <TextInput
                    value={addForm.password}
                    onChangeText={(password) => setAddForm((prev) => ({ ...prev, password }))}
                    placeholder="Mot de passe"
                    placeholderTextColor={"#aaaaaa"}
                    secureTextEntry={!showAddPassword}
                    style={{ flex: 1, color: "black", paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                />
                <TouchableOpacity onPress={() => setShowAddPassword((prev) => !prev)} style={{ paddingHorizontal: theme.internal_padding }}>
                    {showAddPassword ? (
                        <EyeOff color="black" size={18} strokeWidth={1.5} />
                    ) : (
                        <Eye color="black" size={18} strokeWidth={1.5} />
                    )}
                </TouchableOpacity>
            </View>
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
        </>
    );

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <Stack.Screen options={{ title: etablissement?.nom ?? "Établissement", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            {!etablissement ? (
                <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#0f86e7" />
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Chargement...</Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{etablissement.nom}</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{TYPE_LABELS[etablissement.type] ?? etablissement.type}</Text>
                        </View>

                        {/* Liaison */}
                        <View style={{ gap: 6, borderRadius: theme.internal_radius, overflow: "hidden" }}>
                            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, gap: 6 }}>
                                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Liaison</Text>
                                <Text style={{ fontSize: theme.size_two, color: "#0f86e7" }}>
                                    {etablissement.nombre_appareils}/2 appareil{etablissement.nombre_appareils > 1 ? "s" : ""} lié{etablissement.nombre_appareils > 1 ? "s" : ""}
                                </Text>
                                {etablissement.nombre_appareils >= 2 ? (
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Limite de 2 appareils atteinte.</Text>
                                ) : (
                                    <>
                                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                            Saisissez ce code sur l'écran d'accueil du nouvel appareil (« J'ai un code de pairing »).
                                        </Text>
                                        {etablissement.pairing_code && (
                                            <Text style={{ fontSize: theme.size_six, letterSpacing: 4, textAlign: "center", color: codeExpire ? "#e74c3c" : "#0f86e7" }}>
                                                {etablissement.pairing_code}
                                            </Text>
                                        )}
                                        {codeExpire && <Text style={{ fontSize: theme.size_one, color: "#e74c3c", textAlign: "center" }}>Ce code a expiré.</Text>}
                                    </>
                                )}
                            </View>
                            {etablissement.nombre_appareils < 2 && (<TouchableOpacity
                                onPress={handleRegenererCode}
                                disabled={isRegenerating}
                                style={{ flexDirection: "row", gap: theme.internal_padding_2, alignItems: "center", justifyContent: "center", backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding, opacity: isRegenerating ? 0.6 : 1 }}
                            >
                                <RefreshCw color="white" size={16} strokeWidth={1.5} />
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>
                                    {etablissement.pairing_code && !codeExpire ? "Générer un nouveau code" : "Générer un code de pairing"}
                                </Text>
                            </TouchableOpacity>)}
                        </View>

                        {/* Employés */}
                        <View style={{ gap: 6, marginTop: theme.radius }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginBottom: 8, opacity: 0.7 }}>Employés</Text>
                            {employes.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun employé pour l'instant.</Text>
                            )}
                            <View style={{ gap: 4, overflow: "hidden", borderRadius: theme.internal_radius }}>
                                {employes.map((employe) => (
                                    <TouchableOpacity
                                        key={employe.id}
                                        onPress={() => openEmployeSheet(employe)}
                                        style={{ backgroundColor: "white", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                    >
                                        <View style={{ gap: 2 }}>
                                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{employe.nom}</Text>
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{employe.telephone} · {ROLE_LABELS[employe.role]}</Text>
                                        </View>
                                        <Pencil color="black" size={16} strokeWidth={1.5} />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {employes.length >= MAX_EMPLOYES ? (
                                <Text style={{ fontSize: theme.size_one, opacity: 0.6, marginTop: 4 }}>Limite de {MAX_EMPLOYES} employés atteinte pour le moment.</Text>
                            ) : employes.length === 0 ? (
                                <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 8, marginTop: 4 }}>
                                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Ajouter un employé</Text>
                                    {addFormFields}
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setIsAddSheetOpen(true)}
                                    style={{ flexDirection: "row", gap: theme.internal_padding_2, backgroundColor: "#0f86e7", borderRadius: theme.internal_radius, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, marginTop: 4 }}
                                >
                                    <Plus color="white" size={18} strokeWidth={1.5} />
                                    <Text style={{ fontSize: theme.size_two, color: "white" }}>Ajouter un employé</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Catalogue produits */}
                        <View style={{ gap: 6, marginTop: theme.radius }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Catalogue produits</Text>

                            </View>
                            {categories.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucune catégorie pour l'instant.</Text>
                            )}
                            <View style={{ gap: 4, borderRadius: theme.internal_radius, overflow: "hidden" }}>
                                {categories.length > 0 && (
                                    <View style={{ gap: 3, overflow: "hidden", borderRadius: theme.internal_radius_2 }}>
                                        {categories.map((categorie) => {
                                            const produitsCategorie = produits.filter((p) => p.categorie_id === categorie.id);
                                            return (
                                                <TouchableOpacity
                                                    key={categorie.id}
                                                    style={{ backgroundColor: "white", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                                    onPress={() => router.push({ pathname: "/patron-categorie/[categorieId]", params: { categorieId: categorie.id, etablissementId: id, nom: categorie.nom, type: categorie.type } })}
                                                >
                                                    <View>
                                                        <Text style={{ fontSize: theme.size_two }}>{categorie.nom}</Text>
                                                        <Text style={{ fontSize: theme.size_one, color: "#777" }}>{produitsCategorie.length} produit{produitsCategorie.length > 1 ? "s" : ""}</Text>
                                                    </View>
                                                    <ChevronRight color="black" size={20} strokeWidth={1} />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                                <TouchableOpacity
                                    onPress={() => setIsCategorieSheetOpen(true)}
                                    style={{ flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding }}
                                >
                                    <Plus color="white" size={16} strokeWidth={1.5} />
                                    <Text style={{ fontSize: theme.size_two, color: "white" }}>Catégorie</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Rapports */}
                        <View style={{ gap: 6, marginTop: theme.internal_padding_2 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginBottom: 8, opacity: 0.7 }}>Rapports</Text>
                            {rapports.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun rapport synchronisé pour l'instant.</Text>
                            )}
                            {rapports.map((rapport) => {
                                return (
                                    <TouchableOpacity
                                        key={rapport.id}
                                        onPress={() => router.push({ pathname: "/patron-rapport/[id]", params: { id: rapport.id, etablissementId: id } })}
                                        style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}
                                    >
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{formaterDateCourte(rapport.date_generation)}</Text>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterHeure(rapport.date_generation)}</Text>
                                                <ChevronRight color="black" size={18} strokeWidth={1} />
                                            </View>
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
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}

            <BottomSheet visible={isAddSheetOpen} onClose={() => setIsAddSheetOpen(false)}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Ajouter un employé</Text>
                <View style={{ gap: 8, marginTop: theme.internal_padding }}>
                    {addFormFields}
                </View>
            </BottomSheet>

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
                    <View style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, flexDirection: "row", alignItems: "center" }}>
                        <TextInput
                            value={editForm.password}
                            onChangeText={(password) => setEditForm((prev) => ({ ...prev, password }))}
                            placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                            placeholderTextColor={"#aaaaaa"}
                            secureTextEntry={!showEditPassword}
                            style={{ flex: 1, color: "black", paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                        />
                        <TouchableOpacity onPress={() => setShowEditPassword((prev) => !prev)} style={{ paddingHorizontal: theme.internal_padding }}>
                            {showEditPassword ? (
                                <EyeOff color="black" size={18} strokeWidth={1.5} />
                            ) : (
                                <Eye color="black" size={18} strokeWidth={1.5} />
                            )}
                        </TouchableOpacity>
                    </View>
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

            <BottomSheet visible={isCategorieSheetOpen} onClose={() => setIsCategorieSheetOpen(false)}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Ajouter une catégorie</Text>
                <View style={{ gap: 8, marginTop: theme.internal_padding }}>
                    <TextInput
                        value={categorieForm.nom}
                        onChangeText={(nom) => setCategorieForm((prev) => ({ ...prev, nom }))}
                        placeholder="Nom de la catégorie"
                        placeholderTextColor={"#aaaaaa"}
                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                    />
                    <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                        {TYPES_ACTIVITE_CATALOGUE.map((type) => (
                            <TouchableOpacity
                                key={type}
                                onPress={() => setCategorieForm((prev) => ({ ...prev, type }))}
                                style={{ flex: 1, borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding_2, alignItems: "center", backgroundColor: categorieForm.type === type ? "#0f86e7" : "#f5f5f5" }}
                            >
                                <Text style={{ fontSize: theme.size_one, color: categorieForm.type === type ? "white" : "black" }}>{TYPE_ACTIVITE_LABELS[type]}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity
                        onPress={handleAddCategorie}
                        disabled={isSubmitting}
                        style={{ flexDirection: "row", gap: theme.internal_padding_2, backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Plus color="white" size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Ajouter</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheet>
        </KeyboardAvoidingView>
    );
}