import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { Produit } from "@/Database/db";
import { formaterMontant } from "@/lib/currency";
import { synchroniserProduits } from "@/Sync/produitsSync";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Keyboard, KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import theme from "../../constants/constant-style";

const TYPE_ACTIVITE_LABELS: Record<string, string> = {
    bar: "Snack-Bar | Bars",
    restaurant: "Café | Restaurants",
};

const EMPTY_PRODUIT_FORM = { nom: "", prix: "", quantite_par_lot: "" };

export default function ActiviteScreen() {
    const { type: categorieId } = useLocalSearchParams<{ type: string }>();
    const { etablissement, categoriesQuery, produitsQuery, addProduit, updateProduit, deleteCategorie, deleteProduit, refreshLocalData } = useDatabase();
    const { showError, confirm } = useAlert();

    const lectureSeule = true;

    useFocusEffect(
        useCallback(() => {
            if (!etablissement?.server_id) return;
            void synchroniserProduits(etablissement.server_id).then(() => refreshLocalData(["categories", "produits"]));
        }, [etablissement?.server_id, refreshLocalData])
    );

    const categorie = categoriesQuery?.findById(categorieId) ?? null;
    const produits = (produitsQuery?.findBy("categorie_id", categorieId) ?? [])
        .slice()
        .sort((a, b) => a.nom.localeCompare(b.nom));

    const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
    const [nouveauProduit, setNouveauProduit] = useState(EMPTY_PRODUIT_FORM);
    const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
    const [editForm, setEditForm] = useState(EMPTY_PRODUIT_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddProduit = async () => {
        if (isSubmitting) return;
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
            await addProduit({ nom: nouveauProduit.nom.trim(), prix, categorie_id: categorieId, quantite_par_lot });
            setNouveauProduit(EMPTY_PRODUIT_FORM);
            setIsAddSheetOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openProduitSheet = (produit: Produit) => {
        setSelectedProduit(produit);
        setEditForm({
            nom: produit.nom,
            prix: String(produit.prix),
            quantite_par_lot: produit.quantite_par_lot ? String(produit.quantite_par_lot) : "",
        });
    };

    const closeSheet = () => setSelectedProduit(null);

    const handleUpdateProduit = async () => {
        if (isSubmitting || !selectedProduit) return;
        const prix = parseFloat(editForm.prix);
        if (!editForm.nom.trim() || Number.isNaN(prix) || prix <= 0) {
            showError("Le nom et le prix du produit sont requis.");
            return;
        }
        const quantiteBrute = editForm.quantite_par_lot.trim();
        const quantite_par_lot = quantiteBrute ? parseInt(quantiteBrute, 10) : undefined;
        if (quantiteBrute && (Number.isNaN(quantite_par_lot) || (quantite_par_lot as number) <= 0)) {
            showError("La quantité par lot doit être un nombre positif.");
            return;
        }
        setIsSubmitting(true);
        try {
            await updateProduit({ ...selectedProduit, nom: editForm.nom.trim(), prix, quantite_par_lot });
            closeSheet();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProduit = async () => {
        if (isSubmitting || !selectedProduit) return;
        const ok = await confirm(`Supprimer "${selectedProduit.nom}" ?`, { confirmLabel: "Supprimer" });
        if (!ok) return;
        const id = selectedProduit.id;
        // On referme la feuille AVANT de supprimer : effacer le dernier produit
        // fait basculer le garde de navigation dans _layout.tsx, qui démonte cet
        // écran. Le démonter avec une Modal présentée et un champ focalisé fait
        // planter react-native-screens côté natif.
        closeSheet();
        Keyboard.dismiss();
        setIsSubmitting(true);
        try {
            await deleteProduit(id);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCategorie = async () => {
        if (isSubmitting || !categorie) return;
        const ok = await confirm(`Supprimer la catégorie "${categorie.nom}" et ses produits ?`, { confirmLabel: "Supprimer" });
        if (!ok) return;
        setIsSubmitting(true);
        try {
            await deleteCategorie(categorie.id);
            router.back();
        } finally {
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
            <Stack.Screen options={{ title: categorie?.nom ?? "Catégorie", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{categorie?.nom}</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{categorie ? TYPE_ACTIVITE_LABELS[categorie.type] : ""}</Text>
                        </View>
                        {!lectureSeule && (
                            <TouchableOpacity onPress={handleDeleteCategorie} disabled={isSubmitting} style={{ padding: 4 }}>
                                <Trash2 color="#e74c3c" size={20} strokeWidth={1.5} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={{ gap: 12, marginTop: theme.internal_padding_2 }}>
                        {!lectureSeule && (
                            <TouchableOpacity
                                onPress={() => setIsAddSheetOpen(true)}
                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding, backgroundColor: 'white', borderRadius: theme.internal_radius }}>
                                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Produits</Text>
                                <Plus color="black" size={20} strokeWidth={1.5} />
                            </TouchableOpacity>
                        )}
                        {produits.length === 0 && (
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun produit pour l'instant.</Text>
                        )}
                        {produits.length > 0 && (
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
                                        {!lectureSeule && <Pencil color="black" size={16} strokeWidth={1.5} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            {!lectureSeule && (
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
            )}

            <BottomSheet visible={selectedProduit !== null} onClose={closeSheet}>
                {lectureSeule ? (
                    <>
                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{selectedProduit?.nom}</Text>
                        <View style={{ gap: 2, marginTop: theme.internal_padding_2 }}>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{selectedProduit ? formaterMontant(selectedProduit.prix) : ""}</Text>
                            {selectedProduit?.quantite_par_lot ? (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>Lot de {selectedProduit.quantite_par_lot}</Text>
                            ) : null}
                        </View>
                    </>
                ) : (
                    <>
                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Modifier le produit</Text>
                        <View style={{ gap: 8, marginTop: theme.internal_padding }}>
                            {produitFormFields(editForm, setEditForm)}
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
                    </>
                )}
            </BottomSheet>
        </KeyboardAvoidingView>
    );
}
