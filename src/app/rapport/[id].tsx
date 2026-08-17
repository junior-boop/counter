import { CommandesTimelineChart } from "@/components/CommandesTimelineChart";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { formaterMontant } from "@/lib/currency";
import { formaterDateCourte, formaterHeure } from "@/lib/date";
import { Stack, useLocalSearchParams } from "expo-router";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import theme from "../../constants/constant-style";

export default function RapportDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { rapportsQuery, sessionsCaisseQuery, commandesQuery, mouvementsCaisseQuery, mouvementsStockQuery, produitsQuery } = useDatabase();

    const rapport = rapportsQuery?.findById(id);
    const session = rapport ? sessionsCaisseQuery?.findById(rapport.session_caisse_id) : null;

    const commandes = session ? (commandesQuery?.findBy("session_id", session.id) ?? []) : [];

    const historiqueCaisse = session
        ? (mouvementsCaisseQuery?.findBy("session_id", session.id) ?? [])
            .filter((m) => !m.commande_id)
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
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

                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                Session du {formaterDateCourte(session.date_fermeture ?? session.date_ouverture)}
                            </Text>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Ouverture : {formaterMontant(session.montant_ouverture)}</Text>
                            <Text style={{ fontSize: theme.size_two }}>Fermeture : {formaterMontant(session.montant_fermeture ?? 0)}</Text>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: (session.ecart ?? 0) === 0 ? "#0f86e7" : "#e74c3c" }}>
                                Écart : {formaterMontant(session.ecart ?? 0)}
                            </Text>
                        </View>

                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginBottom: 4 }}>Mouvements de caisse</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>Entrées : {formaterMontant(rapport.total_entrees)}</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>Sorties : {formaterMontant(rapport.total_sorties)}</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>
                                Réapprovisionnement : {formaterMontant(rapport.montant_reappro)} ({rapport.nombre_reappro})
                            </Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>
                                Commandes : {rapport.nombre_commandes} ({formaterMontant(rapport.montant_commandes)})
                            </Text>
                        </View>

                        {commandes.length > 0 && (
                            <CommandesTimelineChart commandes={commandes} debut={session.date_ouverture} fin={session.date_fermeture} />
                        )}

                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginBottom: 4 }}>Inventaire du stock</Text>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>Quantité perdue : {rapport.quantite_perdue}</Text>
                            {pertes.length > 0 && (
                                <View style={{ gap: 4 }}>
                                    {pertes.map((m) => (
                                        <Text key={m.id} style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                            {produitsQuery?.findById(m.produit_id)?.nom ?? "Produit"} — {m.quantite} ({m.categorie_perte ?? "inexpliqué"})
                                        </Text>
                                    ))}
                                </View>
                            )}
                            <Text style={{ fontSize: theme.size_two, opacity: 0.7, marginTop: 6 }}>
                                Écarts d'inventaire : {rapport.nombre_ecarts_inventaire}
                            </Text>
                            {ecarts.length > 0 && (
                                <View style={{ gap: 4 }}>
                                    {ecarts.map((m) => (
                                        <Text key={m.id} style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                            {produitsQuery?.findById(m.produit_id)?.nom ?? "Produit"} — écart : {m.ecart}
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Historique de caisse</Text>
                            {historiqueCaisse.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun mouvement manuel enregistré.</Text>
                            )}
                            {historiqueCaisse.map((m) => (
                                <View key={m.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                                    {m.type === "entree" ? <ArrowUpCircle color="#0f86e7" size={20} strokeWidth={1.5} /> : <ArrowDownCircle color="#e74c3c" size={20} strokeWidth={1.5} />}
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ fontSize: theme.size_two }}>{formaterMontant(m.montant)}</Text>
                                        {m.motif && <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{m.motif}</Text>}
                                    </View>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterHeure(m.date)}</Text>
                                </View>
                            ))}
                        </View>

                    </View>
                </ScrollView>
            )}
        </View>
    );
}
