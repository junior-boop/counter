import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { CategoriePerte } from "@/Database/db";
import { formaterDateRelative, formaterHeure } from "@/lib/date";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const CATEGORIES_PERTE: { value: CategoriePerte; label: string }[] = [
    { value: "casse", label: "Casse" },
    { value: "peremption", label: "Péremption" },
    { value: "offert", label: "Offert / conso. interne" },
    { value: "inexplique", label: "Écart inexpliqué" },
];

export default function SessionStockDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { sessionsStockQuery, mouvementsStockQuery, produitsQuery } = useDatabase();

    const session = sessionsStockQuery?.findById(id);
    const mouvements = (mouvementsStockQuery?.findBy("session_id", id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));

    const produitIds = Array.from(new Set(mouvements.map((m) => m.produit_id)));
    const parProduit = produitIds
        .map((produitId) => {
            const produit = produitsQuery?.findById(produitId);
            const mvts = mouvements.filter((m) => m.produit_id === produitId);
            const ouverture = mvts.find((m) => m.type === "inventaire_ouverture")?.quantite ?? null;
            const totalReappro = mvts.filter((m) => m.type === "reapprovisionnement").reduce((sum, m) => sum + m.quantite, 0);
            const totalPerte = mvts.filter((m) => m.type === "perte").reduce((sum, m) => sum + m.quantite, 0);
            const totalVente = mvts.filter((m) => m.type === "vente").reduce((sum, m) => sum + m.quantite, 0);
            const fermetureMouvement = mvts.find((m) => m.type === "inventaire_fermeture") ?? null;
            const pertes = mvts.filter((m) => m.type === "perte");
            return { produitId, produit, ouverture, totalReappro, totalPerte, totalVente, fermetureMouvement, pertes };
        })
        .sort((a, b) => (a.produit?.nom ?? "").localeCompare(b.produit?.nom ?? ""));

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View style={{ height: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                </TouchableOpacity>
                <Text style={{ fontSize: theme.size_three }}>Détail de l'inventaire</Text>
            </View>

            {!session ? (
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Session introuvable.</Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: theme.internal_padding }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                {session.statut === "ouverte" ? "Session ouverte : " : "Ouverte "}{formaterDateRelative(session.date_ouverture)}
                            </Text>
                            {session.statut === "fermee" && session.date_fermeture && (
                                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Fermée {formaterDateRelative(session.date_fermeture)}</Text>
                            )}
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>
                                {session.statut === "ouverte" ? "Inventaire en cours" : "Inventaire fermé"}
                            </Text>
                        </View>

                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginTop: theme.internal_padding }}>Détail par produit</Text>
                        <View style={{ gap: 5 }}>
                            {parProduit.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun mouvement enregistré.</Text>
                            )}
                            {parProduit.map(({ produitId, produit, ouverture, totalReappro, totalPerte, totalVente, fermetureMouvement, pertes }) => (
                                <View key={produitId} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{produit?.nom ?? "Produit supprimé"}</Text>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                        {ouverture !== null && (
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>Ouverture : {ouverture}</Text>
                                        )}
                                        {totalReappro > 0 && (
                                            <Text style={{ fontSize: theme.size_one, color: "#0f86e7" }}>Réappro. : +{totalReappro}</Text>
                                        )}
                                        {totalVente > 0 && (
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>Vendus : -{totalVente}</Text>
                                        )}
                                        {totalPerte > 0 && (
                                            <Text style={{ fontSize: theme.size_one, color: "#e74c3c" }}>Pertes : -{totalPerte}</Text>
                                        )}
                                        {fermetureMouvement && (
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>Fermeture : {fermetureMouvement.quantite}</Text>
                                        )}
                                    </View>
                                    {fermetureMouvement?.ecart != null && fermetureMouvement.ecart !== 0 && (
                                        <Text style={{ fontSize: theme.size_one, color: "#e74c3c", fontWeight: "bold" }}>
                                            Écart : {fermetureMouvement.ecart > 0 ? "+" : ""}{fermetureMouvement.ecart}
                                        </Text>
                                    )}
                                    {pertes.map((p) => (
                                        <Text key={p.id} style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                            -{p.quantite} · {p.categorie_perte ? CATEGORIES_PERTE.find((c) => c.value === p.categorie_perte)?.label : "Perte"}{p.motif ? " · " + p.motif : ""} · {formaterHeure(p.date)}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
