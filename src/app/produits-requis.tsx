import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { TypeActivite } from "@/Database/db";
import theme from "@/constants/constant-style";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACTIVITES: { value: TypeActivite; label: string }[] = [
    { value: "bar", label: "Snack-Bar | Bars" },
    { value: "restaurant", label: "Café | Restaurants" },
];

export default function ProduitsRequisScreen() {
    const { etablissement, categoriesQuery, produitsQuery, addCategorie, addProduit, deleteCategorie, deleteProduit } = useDatabase();
    const { showError, confirm } = useAlert();

    const [activiteTab, setActiviteTab] = useState<TypeActivite>("bar");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [nouvelleCategorie, setNouvelleCategorie] = useState("");
    const [nouveauProduit, setNouveauProduit] = useState({ nom: "", prix: "", quantite_par_lot: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const activite: TypeActivite = etablissement?.type === "les_deux" ? activiteTab : ((etablissement?.type as TypeActivite) ?? "bar");
    const categories = categoriesQuery?.findBy("type", activite) ?? [];

    const handleAddCategorie = async () => {
        if (isSubmitting) return;
        if (!nouvelleCategorie.trim()) {
            showError("Le nom de la catégorie est requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            await addCategorie({ nom: nouvelleCategorie.trim(), type: activite });
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
        if (activite === "bar" && quantiteBrute && (Number.isNaN(quantiteParLotParsee) || (quantiteParLotParsee as number) <= 0)) {
            showError("La quantité par lot doit être un nombre positif.");
            return;
        }
        const quantite_par_lot = activite === "bar" ? quantiteParLotParsee : undefined;
        // Le premier produit ajouté fait basculer le garde de _layout.tsx : cet
        // écran est démonté dans la foulée. On rend le clavier avant, sinon on
        // détruit une vue native encore focalisée.
        Keyboard.dismiss();
        setIsSubmitting(true);
        try {
            await addProduit({ nom: nouveauProduit.nom.trim(), prix, categorie_id, quantite_par_lot });
            setNouveauProduit({ nom: "", prix: "", quantite_par_lot: "" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding, gap: 4 }}>
                    <Text style={{ fontSize: theme.size_four, fontWeight: "bold" }}>Ajoutez vos produits</Text>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>
                        Ajoutez au moins un produit pour commencer à utiliser {etablissement?.nom ?? "votre établissement"}.
                    </Text>
                </View>

                {etablissement?.type === "les_deux" && (
                    <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding }}>
                        {ACTIVITES.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                onPress={() => setActiviteTab(option.value)}
                                style={{
                                    flex: 1,
                                    paddingVertical: theme.internal_padding_2,
                                    borderRadius: theme.internal_radius_2,
                                    alignItems: "center",
                                    backgroundColor: activite === option.value ? "#0f86e7" : "#f5f5f5",
                                }}
                            >
                                <Text style={{ fontSize: theme.size_one, color: activite === option.value ? "white" : "black" }}>{option.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding }}>
                    <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                        <TextInput
                            value={nouvelleCategorie}
                            onChangeText={setNouvelleCategorie}
                            placeholder="Ajouter une catégorie"
                            placeholderTextColor={"#aaaaaa"}
                            style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, height: theme.touchTarget }}
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

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: 8, paddingVertical: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        {categories.length === 0 && (
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5, textAlign: "center", paddingTop: theme.internal_padding }}>
                                Ajoutez une catégorie pour commencer (ex. Boissons, Plats).
                            </Text>
                        )}
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
                                                <View
                                                    key={produit.id}
                                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: theme.touchTarget }}
                                                >
                                                    <Text style={{ fontSize: theme.size_two }}>
                                                        {produit.nom}{produit.quantite_par_lot ? ` (lot de ${produit.quantite_par_lot})` : ""}
                                                    </Text>
                                                    <TouchableOpacity onPress={async () => {
                                                        if (isSubmitting) return;
                                                        setIsSubmitting(true);
                                                        try {
                                                            await deleteProduit(produit.id);
                                                        } finally {
                                                            setIsSubmitting(false);
                                                        }
                                                    }}>
                                                        <Trash2 color="#e74c3c" size={16} strokeWidth={1.5} />
                                                    </TouchableOpacity>
                                                </View>
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
                                                    {activite === "bar" && (
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
        </SafeAreaView>
    );
}
