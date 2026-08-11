import { useRouter } from "expo-router";
import { ClipboardList, Plus, Wallet } from "lucide-react-native";
import { useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";

import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { PulsingDot } from "@/components/pulsing-dot";
import { Text } from "@/components/text";
import theme from "@/constants/constant-style";
import { useDatabase } from "@/Database/database.context";
import { TypeActivite } from "@/Database/db";
import { formaterMontant } from "@/lib/currency";

const ACTIVITES: { value: TypeActivite; label: string }[] = [
    { value: "bar", label: "Bar" },
    { value: "restaurant", label: "Restaurant" },
];

export function CurrentOrderCard() {
    const router = useRouter();
    const { etablissement, sessionsCaisseQuery, commandesQuery, ouvrirSessionCaisse } = useDatabase();
    const { session: utilisateur } = useAuth();
    const { showError } = useAlert();

    const [modalVisible, setModalVisible] = useState(false);
    const [activiteChoisie, setActiviteChoisie] = useState<TypeActivite | null>(null);
    const [montantOuverture, setMontantOuverture] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const sessionOuverte = (sessionsCaisseQuery?.findAll() ?? [])
        .filter((s) => s.statut === "ouverte")
        .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0] ?? null;

    const commandesSession = sessionOuverte ? (commandesQuery?.findBy("session_id", sessionOuverte.id) ?? []) : [];
    const commandeCount = commandesSession.length;
    const chiffreAffaires = commandesSession.reduce((total, c) => total + c.montant_total, 0);

    const openModal = () => {
        setActiviteChoisie(etablissement?.type !== "les_deux" ? (etablissement?.type ?? null) : null);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setActiviteChoisie(null);
        setMontantOuverture("");
    };

    const handleOuvrir = async () => {
        if (isSubmitting) return;
        const montant = parseFloat(montantOuverture);
        if (!activiteChoisie || !utilisateur || Number.isNaN(montant) || montant < 0) {
            showError("Le montant d'ouverture doit être positif.");
            return;
        }
        setIsSubmitting(true);
        try {
            const nouvelleSession = await ouvrirSessionCaisse({ type_activite: activiteChoisie, montant_ouverture: montant, utilisateur_ouverture_id: utilisateur.id });
            closeModal();
            if (nouvelleSession) {
                router.push({ pathname: "/inventaire/[mode]", params: { mode: "ouverture", activite: nouvelleSession.type_activite, sessionCaisseId: nouvelleSession.id } });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!sessionOuverte) {
        return (
            <>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={openModal}
                    style={{ backgroundColor: "rgb(129, 240, 229)", padding: theme.internal_padding, borderRadius: theme.internal_radius, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ width: '70%', gap: 8 }}>
                        <Text style={{ fontWeight: "bold", fontSize: theme.size_three, color: "#000000ce" }}>Nouvelle Session</Text>
                        <Text style={{ fontWeight: "bold", fontSize: theme.size_one, color: "#000000ce" }}>Démarrez l'inventaire du stock et ouvrez la caisse pour commencer</Text>
                    </View>
                    <Plus size={20} color="#000000ce" />
                </TouchableOpacity>

                <BottomSheet visible={modalVisible} onClose={closeModal}>
                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Nouvelle session</Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6, marginBottom: theme.internal_padding }}>Enregistrez le montant présent en caisse pour ouvrir une nouvelle session.</Text>

                    {etablissement?.type === "les_deux" && (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            {ACTIVITES.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => setActiviteChoisie(option.value)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: theme.internal_padding_2,
                                        borderRadius: theme.internal_radius_2,
                                        alignItems: "center",
                                        backgroundColor: activiteChoisie === option.value ? "#0f86e7" : "#f5f5f5",
                                    }}
                                >
                                    <Text style={{ fontSize: theme.size_one, color: activiteChoisie === option.value ? "white" : "black" }}>{option.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <TextInput
                        value={montantOuverture}
                        onChangeText={setMontantOuverture}
                        placeholder="Montant d'ouverture (XAF)"
                        placeholderTextColor={"#aaaaaa"}
                        keyboardType="numeric"
                        style={{ marginBottom: theme.internal_padding_2, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                    />
                    <TouchableOpacity
                        onPress={handleOuvrir}
                        disabled={isSubmitting}
                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Ouvrir la caisse</Text>
                    </TouchableOpacity>
                </BottomSheet>
            </>
        );
    }

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: "/session/[id]", params: { id: sessionOuverte.id } })}
            style={{ backgroundColor: "rgb(129, 240, 229)", padding: theme.internal_padding, borderRadius: theme.internal_radius, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <PulsingDot size={10} color="#000" />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "bold", fontSize: theme.size_three, color: "#000000ce", marginBottom: 8 }}>Commande de la journée</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <ClipboardList size={14} color="#00000099" />
                                <Text style={{ fontSize: theme.size_one, color: "#00000099" }}>Commandes</Text>
                            </View>
                            <Text style={{ fontSize: theme.size_four, fontWeight: "bold", color: "#000000ce" }}>{commandeCount}</Text>
                        </View>

                        <View style={{ width: 1, height: 34, backgroundColor: "#00000022" }} />

                        <View style={{ flex: 1, gap: 4, paddingLeft: theme.internal_padding }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Wallet size={14} color="#00000099" />
                                <Text style={{ fontSize: theme.size_one, color: "#00000099" }}>Chiffre d'affaires</Text>
                            </View>
                            <Text style={{ fontSize: theme.size_four, fontWeight: "bold", color: "#000000ce" }}>{formaterMontant(chiffreAffaires)}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
