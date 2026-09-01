import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { ServerEtablissement } from "@/Sync/serverTypes";
import { getDate, getDay, getMonth } from "date-fns";
import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const TYPE_LABELS: Record<string, string> = {
    bar: "Snack-Bar | Bars",
    restaurant: "Café | Restaurants",
    les_deux: "Les deux",
};

export default function PatronAccueilScreen() {
    const { patronSession } = usePatronAuth();
    const { showError } = useAlert();
    const insets = useSafeAreaInsets();
    const [etablissements, setEtablissements] = useState<ServerEtablissement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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

    useFocusEffect(
        useCallback(() => {
            if (!patronSession) return;
            (async () => {
                setIsLoading(true);
                try {
                    const result = await api.get<ServerEtablissement[]>("/etablissements", patronSession.token);
                    setEtablissements(result);
                } catch (error) {
                    showError(error instanceof Error ? error.message : "Impossible de charger vos établissements.");
                } finally {
                    setIsLoading(false);
                }
            })();
        }, [patronSession, showError])
    );

    return (
        <View style={{ flex: 1, paddingTop: insets.top }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom }}>
                <View style={{ height: theme.inner_height_screen * 0.2, width: "100%", flexDirection: "row", alignItems: "center" }}>
                    <View style={{ paddingHorizontal: theme.screenPadding }}>
                        <Text style={{ fontSize: 24, fontWeight: 'regular' }}>{dday.jour}</Text>
                        <Text style={{ fontSize: 32, fontWeight: "bold" }}>{dday?.date < 10 ? `0${dday?.date}` : dday?.date}, {dday?.mois}</Text>
                    </View>
                </View>


                <View style={{ height: theme.headerHeight, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Mes établissements</Text>
                    <TouchableOpacity onPress={() => router.push("/patron-etablissement/nouveau")}>
                        <Plus color="#0f86e7" size={26} strokeWidth={1.5} />
                    </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: theme.screenPadding, gap: 8 }}>
                    {!isLoading && etablissements.length === 0 && (
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5, marginTop: theme.internal_padding }}>
                            Aucun établissement pour l'instant. Ajoutez-en un avec le bouton +.
                        </Text>
                    )}
                    {etablissements.map((etab) => (
                        <TouchableOpacity
                            key={etab.id}
                            onPress={() => router.push({ pathname: "/patron-etablissement/[id]", params: { id: etab.id } })}
                            style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                        >
                            <View style={{ gap: 2 }}>
                                <Text style={{ fontSize: theme.size_two }}>{etab.nom}</Text>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{TYPE_LABELS[etab.type] ?? etab.type}</Text>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                    {etab.nombre_appareils > 0 ? `${etab.nombre_appareils}/2 appareil${etab.nombre_appareils > 1 ? "s" : ""} lié${etab.nombre_appareils > 1 ? "s" : ""}` : "En attente de liaison"}
                                </Text>
                            </View>
                            <ChevronRight color="black" size={20} strokeWidth={1} />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
