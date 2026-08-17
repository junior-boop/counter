import { useAlert } from "@/components/alert/alert.context";
import { Container } from "@/components/Container";
import { CurrentOrderCard } from "@/components/CurrentSession";
import { Text } from "@/components/text";
import Titre from "@/components/titre";
import { useDatabase } from "@/Database/database.context";
import { estStockBas } from "@/Database/stock";
import { formaterMontant } from "@/lib/currency";
import { formaterDateCourte } from "@/lib/date";
import { getDate, getDay, getMonth } from "date-fns";
import { router } from "expo-router";
import { BeerOff, FileText, Plus, TriangleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";



export default function HomeScreen() {
  const [dday, setDday] = useState<{ jour: string, date: number, mois: string }>({ jour: "-", date: 0, mois: "-" })
  const { produitsQuery, categoriesQuery, sessionsCaisseQuery, mouvementsStockQuery, rapportsQuery, etablissement, genererRapportDeLaJournee, genererRapportPourSessionCaisse } = useDatabase();
  const insert = useSafeAreaInsets()
  const { showError } = useAlert();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getParcelDate = () => {
    const date = new Date()
    const day = ["Dimanche", 'Lundi', "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
    const months = ["Janvier", "Févier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    return {
      jour: day[getDay(date)],
      date: getDate(date),
      mois: months[getMonth(date)]
    }
  }

  useEffect(() => {
    setDday(getParcelDate())
  }, [])

  const sessionCaisseOuverte = (sessionsCaisseQuery?.findAll() ?? []).find((s) => s.statut === "ouverte") ?? null;

  const produitsAlerte = (produitsQuery?.findAll() ?? []).filter(
    (p) => estStockBas(p, categoriesQuery?.findById(p.categorie_id) ?? null)
  );

  // "Produits perdus" affichait le compteur d'alertes. Ce qui est réellement
  // perdu, ce sont les quantités déclarées en perte, pas les stocks bas.
  const quantitePerdue = (mouvementsStockQuery?.findAll() ?? [])
    .filter((m) => m.type === "perte")
    .reduce((somme, m) => somme + m.quantite, 0);

  const dernierEcart = (mouvementsStockQuery?.findAll() ?? [])
    .filter((m) => m.type === "inventaire_fermeture" && m.ecart != null && m.ecart !== 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const produitEcart = dernierEcart ? produitsQuery?.findById(dernierEcart.produit_id) : null;

  const derniersRapports = (rapportsQuery?.findAll() ?? [])
    .slice()
    .sort((a, b) => b.date_generation.localeCompare(a.date_generation))
    .slice(0, 3);

  const sessionFermeeSansRapport = (sessionsCaisseQuery?.findAll() ?? [])
    .filter((s) => s.statut === "fermee" && !(rapportsQuery?.findAll() ?? []).some((r) => r.session_caisse_id === s.id))
    .sort((a, b) => (b.date_fermeture ?? "").localeCompare(a.date_fermeture ?? ""))[0] ?? null;

  const handleGenererRapport = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const id = await genererRapportDeLaJournee();
      router.push({ pathname: "/rapport/[id]", params: { id } });
    } catch {
      showError("Aucune session de caisse fermée. Le rapport est généré à la clôture d'une session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenererRapportPourSession = async (sessionId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const id = await genererRapportPourSessionCaisse(sessionId);
      router.push({ pathname: "/rapport/[id]", params: { id } });
    } catch {
      showError("Impossible de générer le rapport de cette session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5", paddingTop: insert.top }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ height: theme.inner_height_screen * 0.2, width: "100%", flexDirection: "row", alignItems: "center" }}>
            <View style={{ paddingHorizontal: theme.screenPadding }}>
              <Text style={{ fontSize: 32, fontWeight: '600' }}>{dday.jour}</Text>
              <Text style={{ fontSize: 28, fontWeight: "400" }}>{dday?.date < 10 ? `0${dday?.date}` : dday?.date}, {dday?.mois}</Text>
              <Text style={{ fontSize: 14, fontWeight: "600" }}>Etablissement : {etablissement?.nom ?? "—"}</Text>
            </View>
          </View>

          <View>
            <Titre titre="Caisse" />
            <Container style={{ paddingBottom: theme.internal_padding }}>
              <CurrentOrderCard />
            </Container>
            <Container style={{ flexDirection: "row", gap: theme.internal_padding, paddingBottom: theme.internal_padding }}>
              <View style={styles.bottom}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                  <BeerOff size={28} strokeWidth={2} color={"black"} />
                  <Text style={{ fontSize: theme.size_two, opacity: 0.5, flex: 1, flexWrap: "wrap" }} numberOfLines={2}>Produits  {"\n"}perdus</Text>
                </View>
                <Text style={{ fontSize: 64, opacity: 0.5 }}>{quantitePerdue}</Text>
              </View>
              <View style={styles.bottom}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                  <TriangleAlert size={28} strokeWidth={2} color={"black"} />
                  <Text style={{ fontSize: theme.size_two, opacity: 0.5, flex: 1, flexWrap: "wrap" }} numberOfLines={2}>Produits en {"\n"}alerte</Text>
                </View>
                <Text style={{ fontSize: 64, opacity: 0.5 }}>{produitsAlerte.length}</Text>
              </View>
            </Container>
            <Titre titre="Rapport" />
            <Container style={{ paddingBottom: theme.internal_padding }}>
              <View style={{ gap: 3, borderRadius: theme.internal_radius, overflow: 'hidden' }}>
                <TouchableOpacity
                  disabled={isSubmitting || !!sessionCaisseOuverte}
                  onPress={handleGenererRapport}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.internal_padding_2, backgroundColor: 'white', padding: theme.internal_padding, borderRadius: theme.internal_radius_2, opacity: isSubmitting || sessionCaisseOuverte ? 0.5 : 1 }}
                >
                  <Text style={{ fontSize: theme.size_two }}>Rapport de la journée</Text>
                  <Plus size={18} color={"black"} />
                </TouchableOpacity>
                {sessionCaisseOuverte && sessionFermeeSansRapport && (
                  <TouchableOpacity
                    disabled={isSubmitting}
                    onPress={() => handleGenererRapportPourSession(sessionFermeeSansRapport.id)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.internal_padding_2, backgroundColor: 'white', padding: theme.internal_padding, borderRadius: theme.internal_radius_2, opacity: isSubmitting ? 0.5 : 1 }}
                  >
                    <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>
                      Faire le rapport du {formaterDateCourte(sessionFermeeSansRapport.date_fermeture ?? sessionFermeeSansRapport.date_ouverture)}
                    </Text>
                    <Plus size={18} color={"black"} />
                  </TouchableOpacity>
                )}
                {derniersRapports.length === 0 && (
                  <Text style={{ fontSize: theme.size_two, opacity: 0.5, backgroundColor: 'white', padding: theme.internal_padding, borderRadius: theme.internal_radius_2 }}>
                    Aucun rapport pour l'instant.
                  </Text>
                )}
                {derniersRapports.map((r) => {
                  const session = sessionsCaisseQuery?.findById(r.session_caisse_id);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => router.push({ pathname: "/rapport/[id]", params: { id: r.id } })}
                      style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.internal_padding_2, backgroundColor: 'white', padding: theme.internal_padding, borderRadius: theme.internal_radius_2 }}
                    >
                      <View style={{ width: 40, alignItems: "center", justifyContent: "center" }}>
                        <FileText size={18} color={"black"} strokeWidth={1.5} />
                      </View>
                      <View>
                        <Text style={{ fontWeight: "bold", fontSize: theme.size_two, flexWrap: "wrap", marginBottom: 12 }} numberOfLines={2}>
                          Rapport {session ? `du ${formaterDateCourte(session.date_fermeture ?? session.date_ouverture)}` : ""}
                        </Text>
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}> Commandes : {r.nombre_commandes}</Text>
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}> Montant : {formaterMontant(r.montant_commandes)}</Text>
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}> Montant Reap. : {formaterMontant(r.montant_reappro)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Container>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  bottom: { flex: 1, aspectRatio: 1, backgroundColor: 'white', borderRadius: theme.internal_radius, padding: theme.internal_padding, justifyContent: "space-between" }
})