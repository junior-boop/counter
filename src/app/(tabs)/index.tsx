import { Container } from "@/components/Container";
import { CurrentOrderCard } from "@/components/CurrentSession";
import { Text } from "@/components/text";
import Titre from "@/components/titre";
import { useDatabase } from "@/Database/database.context";
import { estStockBas } from "@/Database/stock";
import { getDate, getDay, getMonth } from "date-fns";
import { BeerOff, TriangleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";



export default function HomeScreen() {
  const [dday, setDday] = useState<{ jour: string, date: number, mois: string }>({ jour: "-", date: 0, mois: "-" })
  const { produitsQuery, categoriesQuery, sessionsCaisseQuery, mouvementsStockQuery } = useDatabase();
  const insert = useSafeAreaInsets()

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

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5", paddingTop: insert.top }}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ height: theme.inner_height_screen * 0.2, width: "100%", flexDirection: "row", alignItems: "center" }}>
          <View style={{ paddingHorizontal: theme.screenPadding }}>
            <Text style={{ fontSize: 32, fontWeight: '600' }}>{dday.jour}</Text>
            <Text style={{ fontSize: 28, fontWeight: "400" }}>{dday?.date < 10 ? `0${dday?.date}` : dday?.date}, {dday?.mois}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600" }}>Etablissement : Le Nom de l'Etablissement</Text>
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
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  bottom: { flex: 1, aspectRatio: 1, backgroundColor: 'white', borderRadius: theme.internal_radius, padding: theme.internal_padding, justifyContent: "space-between" }
})