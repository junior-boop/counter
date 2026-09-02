import { RapportDetail } from "@/components/RapportDetail";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { formaterDateCourte } from "@/lib/date";
import { RapportDetails } from "@/lib/rapportDetails";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import theme from "../../constants/constant-style";

export default function RapportDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { rapportsQuery, sessionsCaisseQuery, commandesQuery, mouvementsCaisseQuery, mouvementsStockQuery, produitsQuery } = useDatabase();

    const rapport = rapportsQuery?.findById(id);
    const session = rapport ? sessionsCaisseQuery?.findById(rapport.session_caisse_id) : null;

    const commandes = session ? (commandesQuery?.findBy("session_id", session.id) ?? []) : [];

    const mouvementsCaisse = session
        ? (mouvementsCaisseQuery?.findBy("session_id", session.id) ?? []).filter((m) => !m.commande_id)
        : [];

    // MouvementStock est rattaché à une SessionStock (cycle indépendant de la
    // caisse), donc corrélé par fenêtre de dates de la session caisse — même
    // logique que la génération du rapport (Database/rapport.ts).
    const finFenetre = session?.date_fermeture ?? new Date().toISOString();
    const mouvementsStockFenetre = session
        ? (mouvementsStockQuery?.findAll() ?? []).filter((m) => m.date >= session.date_ouverture && m.date <= finFenetre)
        : [];
    const pertes = mouvementsStockFenetre.filter((m) => m.type === "perte");
    const ecarts = mouvementsStockFenetre.filter(
        (m) => (m.type === "inventaire_ouverture" || m.type === "inventaire_fermeture") && m.ecart != null && m.ecart !== 0
    );

    const details: RapportDetails = {
        commandes: commandes.map((c) => ({ date: c.date, montant_total: c.montant_total })),
        mouvementsCaisse: mouvementsCaisse.map((m) => ({ type: m.type, montant: m.montant, motif: m.motif ?? null, date: m.date })),
        pertes: pertes.map((m) => ({ produit_nom: produitsQuery?.findById(m.produit_id)?.nom ?? "Produit", quantite: m.quantite, categorie_perte: m.categorie_perte ?? null })),
        ecarts: ecarts.map((m) => ({ produit_nom: produitsQuery?.findById(m.produit_id)?.nom ?? "Produit", ecart: m.ecart ?? 0 })),
    };

    return (
        <View style={{ flex: 1 }}>
            <Stack.Screen options={{ title: "Rapport", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            {!rapport || !session ? (
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Rapport introuvable.</Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1, backgroundColor: "#f5f5f5" }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                            Session du {formaterDateCourte(session.date_fermeture ?? session.date_ouverture)}
                        </Text>

                        <RapportDetail session={session} rapport={rapport} details={details} />
                    </View>
                </ScrollView>
            )}
        </View>
    );
}
