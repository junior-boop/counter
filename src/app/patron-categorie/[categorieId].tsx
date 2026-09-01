import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { Text } from "@/components/text";
import { api, ApiError } from "@/lib/api";
import { formaterMontant } from "@/lib/currency";
import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { ServerProduit } from "@/Sync/serverTypes";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import theme from "../../constants/constant-style";

const TYPE_ACTIVITE_LABELS: Record<string, string> = {
    bar: "Bar",
    restaurant: "Restaurant",
};

const EMPTY_PRODUIT_FORM = { nom: "", prix: "", quantite_par_lot: "" };

export default function PatronCategorieDetailScreen() {
    const { categorieId, etablissementId, nom, type } = useLocalSearchParams<{ categorieId: string; etablissementId: string; nom: string; type: string }>();
    const { patronSession } = usePatronAuth();
    const { showError, confirm } = useAlert();

    const [produits, setProduits] = useState<ServerProduit[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
    const [nouveauProduit, setNouveauProduit] = useState(EMPTY_PRODUIT_FORM);
    const [selectedProduit, setSelectedProduit] = useState<ServerProduit | null>(null);
    const [editProduitForm, setEditProduitForm] = useState(EMPTY_PRODUIT_FORM);
    const [isLoading, setIsLoading] = useState(true);
    const [erreurConnexion, setErreurConnexion] = useState<string | null>(null);

    const charger = useCallback(async () => {
        if (!patronSession || !etablissementId) return;
        setErreurConnexion(null);
        try {
            const produitsEtab = await api.get<ServerProduit[]>(`/etablissements/${etablissementId}/produits`, patronSession.token);
            setProduits(
                produitsEtab
                    .filter((p) => p.categorie_id === categorieId)
                    .sort((a, b) => a.nom.localeCompare(b.nom))
            );
        } catch (error) {
            setErreurConnexion(error instanceof ApiError ? error.message : "Impossible de se connecter au serveur.");
        } finally {
            setIsLoading(false);
        }
    }, [categorieId, etablissementId, patronSession]);

    useFocusEffect(
        useCallback(() => {
            void charger();
        }, [charger])
    );

    const handleAddProduit = async () => {
        if (!patronSession || !etablissementId) return;
        const prix = parseFloat(nouveauProduit.prix);
        if (!nouveauProduit.nom.trim() || Number.isNaN(prix) || prix <= 0) {
            showError("Le nom et le prix du produit sont requis.");
            return;
        }
        const quantiteBrute = nouveauProduit.quantite_par_lot.trim();
        const quantite_par_lot = quantiteBrute ? parseInt(quantiteBrute, 10) : undefined;
        if (quantiteBrute && (Number.isNaN(quantite_par_lot) || (quantite_par_lot as number) <= 0)) {
            showError("La quantité par lot doit être un nombre positif.");
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post(`/etablissements/${etablissementId}/produits`, { nom: nouveauProduit.nom.trim(), prix, quantite_par_lot, categorie_id: categorieId }, patronSession.token);
            setNouveauProduit(EMPTY_PRODUIT_FORM);
            setIsAddSheetOpen(false);
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible d'ajouter ce produit.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openProduitSheet = (produit: ServerProduit) => {
        setSelectedProduit(produit);
        setEditProduitForm({
            nom: produit.nom,
            prix: String(produit.prix),
            quantite_par_lot: produit.quantite_par_lot ? String(produit.quantite_par_lot) : "",
        });
    };

    const closeProduitSheet = () => setSelectedProduit(null);

    const handleUpdateProduit = async () => {
        if (!patronSession || !etablissementId || !selectedProduit) return;
        const prix = parseFloat(editProduitForm.prix);
        if (!editProduitForm.nom.trim() || Number.isNaN(prix) || prix <= 0) {
            showError("Le nom et le prix du produit sont requis.");
            return;
        }
        const quantiteBrute = editProduitForm.quantite_par_lot.trim();
        const quantite_par_lot = quantiteBrute ? parseInt(quantiteBrute, 10) : null;
        if (quantiteBrute && (Number.isNaN(quantite_par_lot) || (quantite_par_lot as number) <= 0)) {
            showError("La quantité par lot doit être un nombre positif.");
            return;
        }
        setIsSubmitting(true);
        try {
            await api.patch(`/etablissements/${etablissementId}/produits/${selectedProduit.id}`, { nom: editProduitForm.nom.trim(), prix, quantite_par_lot }, patronSession.token);
            closeProduitSheet();
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible de modifier ce produit.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProduit = async () => {
        if (!patronSession || !etablissementId || !selectedProduit) return;
        const ok = await confirm(`Supprimer "${selectedProduit.nom}" ?`, { confirmLabel: "Supprimer" });
        if (!ok) return;
        setIsSubmitting(true);
        try {
            await api.delete(`/etablissements/${etablissementId}/produits/${selectedProduit.id}`, patronSession.token);
            closeProduitSheet();
            await charger();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible de supprimer ce produit.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCategorie = async () => {
        if (!patronSession || !etablissementId || !categorieId) return;
        const ok = await confirm(`Supprimer la catégorie "${nom}" et ses produits ?`, { confirmLabel: "Supprimer" });
        if (!ok) return;
        setIsSubmitting(true);
        try {
            await api.delete(`/etablissements/${etablissementId}/categories/${categorieId}`, patronSession.token);
            router.back();
        } catch (error) {
            showError(error instanceof ApiError ? error.message : "Impossible de supprimer cette catégorie.");
            setIsSubmitting(false);
        }
    };

    const produitFormFields = (form: typeof EMPTY_PRODUIT_FORM, setForm: (updater: (prev: typeof EMPTY_PRODUIT_FORM) => typeof EMPTY_PRODUIT_FORM) => void) => (
        <>
            <TextInput
                value={form.nom}
                onChangeText={(val) => setForm((prev) => ({ ...prev, nom: val }))}
                placeholder="Nom du produit"
                placeholderTextColor={"#aaaaaa"}
                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
            />
            <TextInput
                value={form.prix}
                onChangeText={(val) => setForm((prev) => ({ ...prev, prix: val }))}
                placeholder="Prix"
                placeholderTextColor={"#aaaaaa"}
                keyboardType="numeric"
                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
            />
            <TextInput
                value={form.quantite_par_lot}
                onChangeText={(val) => setForm((prev) => ({ ...prev, quantite_par_lot: val }))}
                placeholder="Quantité par lot (optionnel)"
                placeholderTextColor={"#aaaaaa"}
                keyboardType="numeric"
                style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
            />
        </>
    );

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <Stack.Screen options={{ title: nom ?? "Catégorie", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{nom}</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{TYPE_ACTIVITE_LABELS[type] ?? type}</Text>
                        </View>
                        <TouchableOpacity onPress={handleDeleteCategorie} disabled={isSubmitting} style={{ padding: 4 }}>
                            <Trash2 color="#e74c3c" size={20} strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ gap: 12, marginTop: theme.internal_padding_2 }}>
                        <TouchableOpacity
                            onPress={() => setIsAddSheetOpen(true)}
                            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding, backgroundColor: 'white', borderRadius: theme.internal_radius }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Ajouter un produit</Text>
                            <Plus color="black" size={20} strokeWidth={1.5} />

                        </TouchableOpacity>
                        {isLoading && (
                            <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, width: "100%", height: 400, justifyContent: "center", alignItems: "center" }}>
                                <ActivityIndicator size="large" color="#0f86e7" />
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Chargement...</Text>
                            </View>
                        )}
                        {!isLoading && erreurConnexion && (
                            <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, width: "100%", height: 400, justifyContent: "center", alignItems: "center", gap: 8 }}>
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5, textAlign: "center" }}>{erreurConnexion}</Text>
                                <TouchableOpacity onPress={() => { setIsLoading(true); void charger(); }} style={{ paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2 }}>
                                    <Text style={{ fontSize: theme.size_two, color: "white" }}>Réessayer</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {!isLoading && !erreurConnexion && produits.length === 0 && (
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun produit pour le moment.</Text>
                        )}
                        {!isLoading && !erreurConnexion && produits.length > 0 && (
                            <View style={{ gap: 3, overflow: "hidden", borderRadius: theme.internal_radius }}>
                                {produits.map((produit) => (
                                    <TouchableOpacity
                                        key={produit.id}
                                        onPress={() => openProduitSheet(produit)}
                                        style={{ backgroundColor: "white", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                    >
                                        <View style={{ gap: 2 }}>
                                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{produit.nom}</Text>
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                                {formaterMontant(produit.prix)}{produit.quantite_par_lot ? ` · Lot de ${produit.quantite_par_lot}` : ""}
                                            </Text>
                                        </View>
                                        <Pencil color="black" size={16} strokeWidth={1.5} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomSheet visible={isAddSheetOpen} onClose={() => setIsAddSheetOpen(false)}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Ajouter un produit</Text>
                <View style={{ gap: 8, marginTop: theme.internal_padding }}>
                    {produitFormFields(nouveauProduit, setNouveauProduit)}
                    <TouchableOpacity
                        onPress={handleAddProduit}
                        disabled={isSubmitting}
                        style={{ flexDirection: "row", gap: theme.internal_padding_2, backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Plus color="white" size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Ajouter</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheet>

            <BottomSheet visible={selectedProduit !== null} onClose={closeProduitSheet}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Modifier le produit</Text>
                <View style={{ gap: 8, marginTop: theme.internal_padding }}>
                    {produitFormFields(editProduitForm, setEditProduitForm)}
                    <TouchableOpacity
                        onPress={handleUpdateProduit}
                        disabled={isSubmitting}
                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Enregistrer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleDeleteProduit}
                        disabled={isSubmitting}
                        style={{ flexDirection: "row", gap: theme.internal_padding_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding_2, opacity: isSubmitting ? 0.5 : 1 }}
                    >
                        <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, color: "#e74c3c" }}>Supprimer</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheet>
        </KeyboardAvoidingView>
    );
}
