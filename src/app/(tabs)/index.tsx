import { Text } from "@/components/text";
import Titre from "@/components/titre";
import { useDatabase } from "@/Database/database.context";
import { formaterMontant } from "@/lib/currency";
import { formaterDateRelative } from "@/lib/date";
import { getDate, getDay, getMonth } from "date-fns";
import { useEffect, useState } from "react";
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from "../../constants/constant-style";



export default function HomeScreen() {
  const [dday, setDday] = useState<{ jour: string, date: number, mois: string }>({ jour: "-", date: 0, mois: "-" })
  const { produitsQuery, sessionsCaisseQuery, mouvementsStockQuery } = useDatabase();

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
    (p) => p.stock_actuel != null && p.seuil_alerte != null && p.stock_actuel <= p.seuil_alerte
  );

  const dernierEcart = (mouvementsStockQuery?.findAll() ?? [])
    .filter((m) => m.type === "inventaire_fermeture" && m.ecart != null && m.ecart !== 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const produitEcart = dernierEcart ? produitsQuery?.findById(dernierEcart.produit_id) : null;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView>
        <View style={{ height: theme.inner_height_screen * 0.2, width: "100%", flexDirection: "row", alignItems: "center" }}>
          <View style={{ paddingHorizontal: theme.screenPadding }}>
            <Text style={{ fontSize: 32, fontWeight: '600' }}>{dday.jour}</Text>
            <Text style={{ fontSize: 28, fontWeight: "400" }}>{dday?.date < 10 ? `0${dday?.date}` : dday?.date}, {dday?.mois}</Text>
          </View>
        </View>

        <Titre titre="Caisse" />
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <View style={{ backgroundColor: 'white', borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
            {sessionCaisseOuverte ? (
              <>
                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Session ouverte {formaterDateRelative(sessionCaisseOuverte.date_ouverture)}</Text>
                <Text style={{ fontSize: theme.size_three, fontWeight: 'bold' }}>{formaterMontant(sessionCaisseOuverte.montant_ouverture)}</Text>
              </>
            ) : (
              <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucune session caisse en cours</Text>
            )}
          </View>
        </View>

        <Titre titre="Alertes stock" follow_btn={produitsAlerte.length > 0} follow_link="/stock" follow_name="Voir le stock" />
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <View style={{ backgroundColor: 'white', borderRadius: theme.internal_radius, padding: theme.internal_padding }}>
            {produitsAlerte.length > 0 ? (
              <Text style={{ fontSize: theme.size_two, color: "#e74c3c", fontWeight: 'bold' }}>
                {produitsAlerte.length} produit{produitsAlerte.length > 1 ? "s" : ""} sous le seuil d'alerte
              </Text>
            ) : (
              <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucune alerte de stock</Text>
            )}
          </View>
        </View>

        <Titre titre="Dernier écart détecté" />
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <View style={{ backgroundColor: 'white', borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
            {dernierEcart ? (
              <>
                <Text style={{ fontSize: theme.size_two, fontWeight: 'bold' }}>{produitEcart?.nom ?? "Produit supprimé"}</Text>
                <Text style={{ fontSize: theme.size_two, color: "#e74c3c" }}>
                  Écart : {(dernierEcart.ecart ?? 0) > 0 ? "+" : ""}{dernierEcart.ecart}
                </Text>
                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterDateRelative(dernierEcart.date)}</Text>
              </>
            ) : (
              <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun écart détecté récemment</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
