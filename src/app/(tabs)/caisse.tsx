import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { TypeActivite } from "@/Database/db";
import { formaterMontant } from "@/lib/currency";
import { formaterDateRelative } from "@/lib/date";
import { router } from "expo-router";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const ACTIVITES: { value: TypeActivite; label: string }[] = [
    { value: "bar", label: "Caisse Bar" },
    { value: "restaurant", label: "Caisse Restaurant" },
];

export default function CaisseScreen() {
    const { etablissement, sessionsCaisseQuery, ouvrirSessionCaisse } = useDatabase();
    const { session } = useAuth();
    const { showError } = useAlert();
    const insets = useSafeAreaInsets();

    const [activiteChoisie, setActiviteChoisie] = useState<TypeActivite | null>(null);
    const [montantOuverture, setMontantOuverture] = useState("");
    const [nouvelleSessionModalVisible, setNouvelleSessionModalVisible] = useState(false);

    const activite: TypeActivite | null = etablissement?.type === "les_deux" ? activiteChoisie : (etablissement?.type ?? null);

    const sessionsActivite = (activite ? sessionsCaisseQuery?.findBy("type_activite", activite) : []) ?? [];
    const sessionOuverte = sessionsActivite
        .filter((s) => s.statut === "ouverte")
        .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0] ?? null;
    const sessionsFermees = sessionsActivite
        .filter((s) => s.statut === "fermee")
        .sort((a, b) => (b.date_fermeture ?? "").localeCompare(a.date_fermeture ?? ""));

    const handleOuvrir = async () => {
        const montant = parseFloat(montantOuverture);
        if (!activite || !session || Number.isNaN(montant) || montant < 0) {
            showError("Le montant d'ouverture doit être positif.");
            return;
        }
        await ouvrirSessionCaisse({ type_activite: activite, montant_ouverture: montant, utilisateur_ouverture_id: session.id });
        setMontantOuverture("");
        setNouvelleSessionModalVisible(false);
    };

    const closeNouvelleSessionModal = () => {
        setNouvelleSessionModalVisible(false);
        setMontantOuverture("");
    };

    if (etablissement?.type === "les_deux" && !activiteChoisie) {
        return (
            <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5" }}>
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Caisse</Text>
                </View>
                <View style={{ paddingHorizontal: theme.screenPadding, gap: 8, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    {ACTIVITES.map((option) => {
                        const derniereSession = sessionsCaisseQuery?.findBy("type_activite", option.value)
                            .slice()
                            .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0];
                        const etat = derniereSession?.statut === "ouverte" ? "Ouverte" : "Fermée";
                        return (
                            <TouchableOpacity
                                key={option.value}
                                onPress={() => setActiviteChoisie(option.value)}
                                style={{ backgroundColor: "white", borderRadius: theme.internal_radius, paddingVertical: theme.internal_padding, paddingHorizontal: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                            >
                                <View style={{ gap: 4 }}>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{option.label}</Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.6, color: derniereSession?.statut === "ouverte" ? "#0f86e7" : undefined }}>{derniereSession ? etat : "Aucune session"}</Text>
                                </View>
                                <ChevronRight color="black" size={20} strokeWidth={1} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5" }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.screenPadding }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {etablissement?.type === "les_deux" && (
                            <TouchableOpacity onPress={() => setActiviteChoisie(null)}>
                                <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                            </TouchableOpacity>
                        )}
                        <Text style={{ fontSize: theme.size_four }}>{etablissement?.type === "les_deux" ? ACTIVITES.find((a) => a.value === activite)?.label : "Caisse"}</Text>

                    </View>
                    {!sessionOuverte && sessionsFermees.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setNouvelleSessionModalVisible(true)}
                            style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2 }}
                        >
                            <Text style={{ fontSize: theme.size_one, color: "white", fontWeight: "bold" }}>Nouvelle session</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>

                        {!sessionOuverte && sessionsActivite.length === 0 && (
                            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
                                <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>Aucune session en cours. Enregistrez le montant présent en caisse pour ouvrir la journée.</Text>
                                <TextInput
                                    value={montantOuverture}
                                    onChangeText={setMontantOuverture}
                                    placeholder="Montant d'ouverture (XAF)"
                                    placeholderTextColor={"#aaaaaa"}
                                    keyboardType="numeric"
                                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                                />
                                <TouchableOpacity
                                    onPress={handleOuvrir}
                                    style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                                >
                                    <Text style={{ fontSize: theme.size_two, color: "white" }}>Ouvrir la caisse</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {sessionOuverte && (
                            <TouchableOpacity
                                onPress={() => router.push({ pathname: "/session/[id]", params: { id: sessionOuverte.id } })}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}
                            >
                                <Text style={{ fontSize: theme.size_one, color: "white", opacity: 0.8 }}>Session active</Text>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <View>
                                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold", color: "white" }}>
                                            Ouverte {formaterDateRelative(sessionOuverte.date_ouverture).toLowerCase()}
                                        </Text>
                                        <Text style={{ fontSize: theme.size_one, color: "white", opacity: 0.8 }}>Ouverture : {formaterMontant(sessionOuverte.montant_ouverture)}</Text>
                                    </View>
                                    <ChevronRight color="white" size={20} strokeWidth={1.5} />
                                </View>
                            </TouchableOpacity>
                        )}

                        {sessionsFermees.length > 0 && (
                            <View style={{ gap: 8 }}>
                                {sessionsFermees.map((s) => (
                                    <TouchableOpacity
                                        key={s.id}
                                        onPress={() => router.push({ pathname: "/session/[id]", params: { id: s.id } })}
                                        style={{ paddingVertical: theme.internal_padding_2, paddingHorizontal: theme.internal_padding, backgroundColor: "white", borderRadius: theme.internal_radius }}
                                    >
                                        <Text style={{ fontSize: theme.size_two }}>session du {s.date_fermeture ? formaterDateRelative(s.date_fermeture) : ""}</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.internal_padding_2 }}>
                                            <View>
                                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Ouverture : {formaterMontant(s.montant_ouverture)}</Text>
                                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Fermeture : {formaterMontant(s.montant_fermeture ?? 0)}</Text>
                                            </View>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                                <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: (s.ecart ?? 0) === 0 ? "#0f86e7" : "#e74c3c" }}>
                                                    {formaterMontant(s.ecart ?? 0)}
                                                </Text>
                                                <ChevronRight color="black" size={18} strokeWidth={1} />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/** Modal pour ouvrir une nouvelle session */}
            <Modal visible={nouvelleSessionModalVisible} transparent animationType="slide" onRequestClose={closeNouvelleSessionModal}>
                <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior="padding">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={closeNouvelleSessionModal}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
                    />
                    <View style={{ backgroundColor: "white", padding: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Nouvelle session</Text>
                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Enregistrez le montant présent en caisse pour ouvrir une nouvelle session.</Text>
                        <TextInput
                            value={montantOuverture}
                            onChangeText={setMontantOuverture}
                            placeholder="Montant d'ouverture (XAF)"
                            placeholderTextColor={"#aaaaaa"}
                            keyboardType="numeric"
                            style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                        />
                        <TouchableOpacity
                            onPress={handleOuvrir}
                            style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                        >
                            <Text style={{ fontSize: theme.size_two, color: "white" }}>Ouvrir la caisse</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
