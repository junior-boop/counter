import Titre from "@/components/titre";
import { getDate, getDay, getMonth } from "date-fns";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from "../../constants/constant-style";



export default function HomeScreen() {
  const [dday, setDday] = useState<{ jour: string, date: number, mois: string }>({ jour: "-", date: 0, mois: "-" })
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
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView>
        <View style={{ height: theme.inner_height_screen * 0.2, width: "100%", flexDirection: "row", alignItems: "center" }}>
          <View style={{ paddingHorizontal: theme.screenPadding }}>
            <Text style={{ fontSize: 32, fontWeight: '600' }}>{dday.jour}</Text>
            <Text style={{ fontSize: 28, fontWeight: "400" }}>{dday?.date < 10 ? `0${dday?.date}` : dday?.date}, {dday?.mois}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: theme.screenPadding }}>
          <View style={{ borderRadius: theme.radius, height: theme.inner_height_screen * 0.3, padding: theme.internal_padding, backgroundColor: 'white' }}>
            <View style={{ flex: 1 }}></View>
          </View>
        </View>
        <Titre titre="Impayers" follow_btn follow_name="Voir plus" />
        <View style={{ paddingHorizontal: theme.screenPadding, gap: 2 }}>
          <View style={{ backgroundColor: 'white', borderRadius: theme.internal_radius, padding: theme.internal_padding }}>
            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Date de la journée</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: theme.size_one, fontWeight: 'bold' }}>Nom du client</Text>
                <Text style={{ fontSize: theme.size_two }}>Reste : 2500 XAF</Text>
              </View>
              <View>
                <Text style={{ fontSize: theme.size_one, textAlign: "right", fontWeight: 'bold' }}>Total Facture</Text>
                <Text style={{ fontSize: theme.size_two, textAlign: "right" }}>12500 XAF</Text>
              </View>
            </View>
          </View>
          <View style={{ backgroundColor: 'white', borderRadius: theme.internal_radius, padding: theme.internal_padding }}>
            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Date de la journée</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: theme.size_one, fontWeight: 'bold' }}>Nom du client</Text>
                <Text style={{ fontSize: theme.size_two }}>Reste : 2500 XAF</Text>
              </View>
              <View>
                <Text style={{ fontSize: theme.size_one, textAlign: "right", fontWeight: 'bold' }}>Total Facture</Text>
                <Text style={{ fontSize: theme.size_two, textAlign: "right" }}>12500 XAF</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
