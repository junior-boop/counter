import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { TypeEtablissement } from "@/Database/db";
import * as EtablissementDb from "@/Database/etablissement";
import { router } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, Switch, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../constants/constant-style";

const TYPES_ETABLISSEMENT: { value: TypeEtablissement; label: string }[] = [
    { value: "bar", label: "Snack-Bar | Bars" },
    { value: "restaurant", label: "Café | Restaurants" },
    { value: "les_deux", label: "Les deux" },
];

export default function EtablissementScreen() {
    const { etablissement, updateEtablissement } = useDatabase();
    const { showError, showSuccess } = useAlert();
    const [nom, setNom] = useState("");
    const [type, setType] = useState<TypeEtablissement>("les_deux");
    const [commandeTempsReelActive, setCommandeTempsReelActive] = useState<boolean>(Boolean(etablissement?.commande_temps_reel_active));

    useEffect(() => {
        if (etablissement) {
            setNom(etablissement.nom);
            setType(etablissement.type);
            setCommandeTempsReelActive(etablissement.commande_temps_reel_active);
        }
    }, [etablissement]);

    useEffect(() => {
        setCommandeTempsReelActive(Boolean(etablissement?.commande_temps_reel_active));
    }, [])

    const handleSave = async () => {
        if (!nom.trim()) {
            showError("Le nom de l'établissement est requis.");
            return;
        }
        await updateEtablissement({ nom: nom.trim(), type, commande_temps_reel_active: commandeTempsReelActive });
        const fresh = await EtablissementDb.get();
        if (!fresh || Boolean(fresh.commande_temps_reel_active) !== commandeTempsReelActive) {
            showError("L'enregistrement a échoué en base de données (vérifiez la console Metro pour le détail).");
            return;
        }
        showSuccess("Établissement enregistré.");
        router.back();
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: theme.size_three }}>Établissement</Text>
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.internal_padding }}>
                        <View style={{ gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>

                            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding, }}>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>Nom de l'établissement</Text>
                                <TextInput
                                    value={nom}
                                    onChangeText={setNom}
                                    placeholder="Nom de l'établissement"
                                    placeholderTextColor={"#aaaaaa"}
                                    style={{ fontSize: theme.size_three, padding: 0, height: 30 }}
                                />
                            </View>

                            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Type d'activité</Text>

                            <View style={{ gap: 3, overflow: "hidden", borderRadius: theme.internal_radius }}>
                                {TYPES_ETABLISSEMENT.map((option) => {
                                    const isSelected = type === option.value;
                                    return (
                                        <TouchableOpacity
                                            key={option.value}
                                            onPress={() => setType(option.value)}
                                            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: isSelected ? "#eaf4fd" : "white", paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding }}
                                        >
                                            <Text style={{ fontSize: theme.size_two, color: isSelected ? "#0f86e7" : "black" }}>{option.label}</Text>
                                            {isSelected && <Check color="#0f86e7" size={18} strokeWidth={2} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", borderRadius: theme.internal_radius, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding }}>
                                <View style={{ flex: 1, paddingRight: theme.internal_padding_2 }}>
                                    <Text style={{ fontSize: theme.size_two }}>Prise de commande en temps réel</Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>Fonctionnalité en test, réservée aux forfaits supérieurs.</Text>
                                </View>
                                <Switch value={commandeTempsReelActive} onValueChange={setCommandeTempsReelActive} />
                            </View>

                            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding }}>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.6, lineHeight: theme.size_one * 1.5 }}>
                                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>À quoi sert cette page ? </Text> {"\n"}
                                    Ces informations décrivent votre établissement et sont utilisées dans toute l'application. Le nom apparaît sur les écrans consultés par votre équipe. Le type d'activité détermine les catégories de produits proposées dans la gestion des activités : un Snack-Bar n'a pas les mêmes catégories qu'un Café/Restaurant, et "Les deux" active l'ensemble des catégories. L'option "Prise de commande en temps réel" est une fonctionnalité expérimentale en test, activable ici uniquement à des fins de test avant d'être réservée aux forfaits supérieurs. Vous pouvez modifier ces réglages à tout moment depuis les Préférences.
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleSave}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>Enregistrer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
