import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { Produit, TypeActivite } from "@/Database/db";
import { formaterMontant } from "@/lib/currency";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const TITRES: Record<TypeActivite, string> = {
    bar: "Snack-Bar | Bars",
    restaurant: "Café | Restaurants",
};

export default function ActiviteScreen() {
    const { type } = useLocalSearchParams<{ type: TypeActivite }>();
    const { categoriesQuery, produitsQuery, addCategorie, addProduit, updateProduit, deleteCategorie, deleteProduit } = useDatabase();
    const { showError, confirm } = useAlert();

    const [expanded, setExpanded] = useState<string | null>(null);
    const [nouvelleCategorie, setNouvelleCategorie] = useState("");
    const [nouveauProduit, setNouveauProduit] = useState({ nom: "", prix: "", quantite_par_lot: "" });

    const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ nom: "", prix: "", quantite_par_lot: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categories = categoriesQuery?.findBy("type", type) ?? [];

    const handleAddCategorie = async () => {
        if (isSubmitting) return;
        if (!nouvelleCategorie.trim()) {
            showError("Le nom de la catégorie est requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            await addCategorie({ nom: nouvelleCategorie.trim(), type });
            setNouvelleCategorie("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddProduit = async (categorie_id: string) => {
        if (isSubmitting) return;
        const prix = parseFloat(nouveauProduit.prix);
        if (!nouveauProduit.nom.trim() || Number.isNaN(prix) || prix <= 0) {
            showError("Le nom et le prix du produit sont requis.");
            return;
        }
        const quantiteBrute = nouveauProduit.quantite_par_lot.trim();
        const quantiteParLotParsee = quantiteBrute ? parseInt(quantiteBrute, 10) : undefined;
        if (type === "bar" && quantiteBrute && (Number.isNaN(quantiteParLotParsee) || (quantiteParLotParsee as number) <= 0)) {
            showError("La quantité par lot doit être un nombre positif.");
            return;
        }
        const quantite_par_lot = type === "bar" ? quantiteParLotParsee : undefined;
        setIsSubmitting(true);
        try {
            await addProduit({ nom: nouveauProduit.nom.trim(), prix, categorie_id, quantite_par_lot });
            setNouveauProduit({ nom: "", prix: "", quantite_par_lot: "" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeSheet = () => {
        setSelectedProduit(null);
        setIsEditing(false);
    };

    const openSheet = (produit: Produit) => {
        setSelectedProduit(produit);
        setIsEditing(false);
    };

    const startEditing = () => {
        if (!selectedProduit) return;
        setEditForm({
            nom: selectedProduit.nom,
            prix: String(selectedProduit.prix),
            quantite_par_lot: selectedProduit.quantite_par_lot ? String(selectedProduit.quantite_par_lot) : "",
        });
        setIsEditing(true);
    };

    const handleUpdateProduit = async () => {
        if (isSubmitting || !selectedProduit) return;
        const prix = parseFloat(editForm.prix);
        if (!editForm.nom.trim() || Number.isNaN(prix) || prix <= 0) {
            showError("Le nom et le prix du produit sont requis.");
            return;
        }
        const quantiteBrute = editForm.quantite_par_lot.trim();
        const quantiteParLotParsee = quantiteBrute ? parseInt(quantiteBrute, 10) : undefined;
        if (type === "bar" && quantiteBrute && (Number.isNaN(quantiteParLotParsee) || (quantiteParLotParsee as number) <= 0)) {
            showError("La quantité par lot doit être un nombre positif.");
            return;
        }
        const quantite_par_lot = type === "bar" ? quantiteParLotParsee : undefined;
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
        setIsSubmitting(true);
        try {
            await deleteProduit(selectedProduit.id);
            closeSheet();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View>
                    <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: theme.size_three }}>{TITRES[type]}</Text>
                    </View>
                    <View style={{ paddingHorizontal: theme.screenPadding, borderBottomWidth: 1, borderBottomColor: "#e0e0e0", paddingBottom: theme.internal_padding }}>
                        <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                            <TextInput
                                value={nouvelleCategorie}
                                onChangeText={setNouvelleCategorie}
                                placeholder="Ajouter une catégorie"
                                placeholderTextColor={"#aaaaaa"}
                                style={{ flex: 1, backgroundColor: "transparent", borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, height: theme.touchTarget }}
                            />
                            <TouchableOpacity
                                onPress={handleAddCategorie}
                                disabled={isSubmitting}
                                style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", width: theme.touchTarget, height: theme.touchTarget }}
                            >
                                <Plus color="white" size={20} strokeWidth={1.5} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    {/* <Titre titre="Catégories" /> */}
                    <View style={{ paddingHorizontal: 12, gap: 8, paddingVertical: theme.internal_padding }}>


                        {categories.map((categorie) => {
                            const isExpanded = expanded === categorie.id;
                            const produits = (produitsQuery?.findBy("categorie_id", categorie.id) ?? [])
                                .slice()
                                .sort((a, b) => a.nom.localeCompare(b.nom));
                            return (
                                <View key={categorie.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding }}>
                                    <TouchableOpacity
                                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                        onPress={() => setExpanded(isExpanded ? null : categorie.id)}
                                    >
                                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{categorie.nom}</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding }}>
                                            <TouchableOpacity onPress={async () => {
                                                if (isSubmitting) return;
                                                const ok = await confirm(`Supprimer la catégorie "${categorie.nom}" et ses produits ?`, { confirmLabel: "Supprimer" });
                                                if (!ok) return;
                                                setIsSubmitting(true);
                                                try {
                                                    await deleteCategorie(categorie.id);
                                                } finally {
                                                    setIsSubmitting(false);
                                                }
                                            }}>
                                                <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                                            </TouchableOpacity>
                                            {isExpanded ? <ChevronDown color="black" size={20} strokeWidth={1} /> : <ChevronRight color="black" size={20} strokeWidth={1} />}
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={{ marginTop: theme.internal_padding, gap: 8 }}>
                                            {produits.map((produit) => (
                                                <TouchableOpacity
                                                    key={produit.id}
                                                    onPress={() => openSheet(produit)}
                                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: theme.touchTarget }}
                                                >
                                                    <Text style={{ fontSize: theme.size_two }}>
                                                        {produit.nom}{produit.quantite_par_lot ? ` (lot de ${produit.quantite_par_lot})` : ""}
                                                    </Text>
                                                    <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{formaterMontant(produit.prix)}</Text>
                                                </TouchableOpacity>
                                            ))}

                                            <View style={{ gap: theme.internal_padding_2 }}>
                                                <TextInput
                                                    value={nouveauProduit.nom}
                                                    onChangeText={(nom) => setNouveauProduit((prev) => ({ ...prev, nom }))}
                                                    placeholder="Produit"
                                                    placeholderTextColor={"#aaaaaa"}
                                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                                />
                                                <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                                                    <TextInput
                                                        value={nouveauProduit.prix}
                                                        onChangeText={(prix) => setNouveauProduit((prev) => ({ ...prev, prix }))}
                                                        placeholder="Prix"
                                                        placeholderTextColor={"#aaaaaa"}
                                                        keyboardType="numeric"
                                                        style={{ flex: 3, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                                    />
                                                    {type === "bar" && (
                                                        <TextInput
                                                            value={nouveauProduit.quantite_par_lot}
                                                            onChangeText={(quantite_par_lot) => setNouveauProduit((prev) => ({ ...prev, quantite_par_lot }))}
                                                            placeholder="Qte/lot"
                                                            placeholderTextColor={"#aaaaaa"}
                                                            keyboardType="numeric"
                                                            style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                                        />
                                                    )}
                                                    <TouchableOpacity
                                                        onPress={() => handleAddProduit(categorie.id)}
                                                        disabled={isSubmitting}
                                                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", height: theme.touchTarget, width: theme.touchTarget }}
                                                    >
                                                        <Plus color="white" size={20} strokeWidth={1.5} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={selectedProduit !== null} transparent animationType="slide" onRequestClose={closeSheet}>
                <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior="padding">
                    <View style={{ flex: 1, position: 'relative', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={closeSheet} />
                        <View style={{ backgroundColor: "white", padding: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth }}>
                            {!isEditing ? (
                                <>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{selectedProduit?.nom}</Text>
                                    <TouchableOpacity
                                        onPress={startEditing}
                                        disabled={isSubmitting}
                                        style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2, paddingVertical: theme.internal_padding_2, opacity: isSubmitting ? 0.5 : 1 }}
                                    >
                                        <Pencil color="black" size={18} strokeWidth={1.5} />
                                        <Text style={{ fontSize: theme.size_two }}>Modifier</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleDeleteProduit}
                                        disabled={isSubmitting}
                                        style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2, paddingVertical: theme.internal_padding_2, opacity: isSubmitting ? 0.5 : 1 }}
                                    >
                                        <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                                        <Text style={{ fontSize: theme.size_two, color: "#e74c3c" }}>Supprimer</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Modifier le produit</Text>
                                    <TextInput
                                        value={editForm.nom}
                                        onChangeText={(nom) => setEditForm((prev) => ({ ...prev, nom }))}
                                        placeholder="Produit"
                                        placeholderTextColor={"#aaaaaa"}
                                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                    />
                                    <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                                        <TextInput
                                            value={editForm.prix}
                                            onChangeText={(prix) => setEditForm((prev) => ({ ...prev, prix }))}
                                            placeholder="Prix"
                                            placeholderTextColor={"#aaaaaa"}
                                            keyboardType="numeric"
                                            style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                        />
                                        {type === "bar" && (
                                            <TextInput
                                                value={editForm.quantite_par_lot}
                                                onChangeText={(quantite_par_lot) => setEditForm((prev) => ({ ...prev, quantite_par_lot }))}
                                                placeholder="Qte/lot"
                                                placeholderTextColor={"#aaaaaa"}
                                                keyboardType="numeric"
                                                style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                            />
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleUpdateProduit}
                                        disabled={isSubmitting}
                                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
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
