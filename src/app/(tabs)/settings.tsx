import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import Titre from "@/components/titre";
import { useDatabase } from "@/Database/database.context";
import { Role } from "@/Database/db";
import { router } from "expo-router";
import { ChevronRight, LogOut } from "lucide-react-native";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const TYPE_LABELS: Record<string, string> = {
    bar: "Snack-Bar | Bars",
    restaurant: "Café | Restaurants",
    les_deux: "Les deux",
};

const ROLE_LABELS: Record<Role, string> = {
    patron: "Patron",
    gerant: "Gérant",
    serveur: "Serveur",
    caissier: "Caissier",
};

export default function SettingsScreen() {
    const { etablissement } = useDatabase();
    const { session, signOut } = useAuth();
    const { confirm } = useAlert();
    const border = useSafeAreaInsets();
    const estAdmin = session?.role === "patron" || session?.role === "gerant";

    const handleDeconnexion = async () => {
        const ok = await confirm("Voulez-vous vous déconnecter ?", { confirmLabel: "Se déconnecter" });
        if (ok) await signOut();
    };

    return (
        <View style={{ flex: 1, paddingTop: border.top }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: border.bottom }}>
                <View style={{ height: theme.headerHeight, width: "100%", flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Préférences</Text>
                </View>

                {estAdmin && (
                    <>
                        <Titre titre="Établissement" />
                        <View style={{ paddingHorizontal: theme.screenPadding }}>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.5, marginBottom: theme.internal_padding_2 }}>
                                Nom et type (bar, restaurant ou les deux) de votre établissement. Ce choix détermine les activités et fonctionnalités disponibles dans l'application.
                            </Text>
                            <View style={{ gap: 3, overflow: 'hidden', borderRadius: theme.internal_radius, borderColor: 'transparent', borderWidth: 1 }}>
                                <TouchableOpacity style={styles.button} onPress={() => router.push("/etablissement")}>
                                    <View style={{ gap: 2 }}>
                                        <Text style={{ fontSize: theme.size_two }}>{etablissement?.nom || "Configurer l'établissement"}</Text>
                                        {etablissement && (
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Type d'activité: {TYPE_LABELS[etablissement.type]}</Text>
                                        )}
                                    </View>
                                    <ChevronRight color="black" size={20} strokeWidth={1} />
                                </TouchableOpacity>
                                {
                                    etablissement?.commande_temps_reel_active && (
                                        <View style={[styles.button, { gap: 2 }]}>
                                            <Text style={{ fontSize: theme.size_two, color: "#0f86e7" }}>Commande en temps réel activée</Text>
                                        </View>
                                    )

                                }
                            </View>
                        </View>

                        <Titre titre="Activités" />
                        <View style={{ paddingHorizontal: theme.screenPadding }}>
                            <View style={{ gap: 3, overflow: 'hidden', borderRadius: theme.internal_radius, borderColor: 'transparent', borderWidth: 1 }}>
                                {etablissement?.type !== "restaurant" && (
                                    <TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: "/activite/[type]", params: { type: "bar" } })}>
                                        <Text style={{ fontSize: theme.size_two }}>Snack-Bar | Bars</Text>
                                        <ChevronRight color="black" size={20} strokeWidth={1} />
                                    </TouchableOpacity>
                                )}
                                {etablissement?.type !== "bar" && (
                                    <TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: "/activite/[type]", params: { type: "restaurant" } })}>
                                        <Text style={{ fontSize: theme.size_two }}>Café | Restaurants</Text>
                                        <ChevronRight color="black" size={20} strokeWidth={1} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <Titre titre="Utilisateurs & rôles" />
                        <View style={{ paddingHorizontal: theme.screenPadding }}>
                            <View style={{ gap: 3, overflow: 'hidden', borderRadius: theme.internal_radius, borderColor: 'transparent', borderWidth: 1 }}>
                                <TouchableOpacity style={styles.button} onPress={() => router.push("/utilisateurs")}>
                                    <Text style={{ fontSize: theme.size_two }}>Gérer les utilisateurs</Text>
                                    <ChevronRight color="black" size={20} strokeWidth={1} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                )}

                <Titre titre="Compte" />
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    <View style={{ gap: 3, overflow: 'hidden', borderRadius: theme.internal_radius, borderColor: 'transparent', borderWidth: 1 }}>
                        <View style={styles.button}>
                            <View style={{ gap: 2 }}>
                                <Text style={{ fontSize: theme.size_two }}>{session?.nom}</Text>
                                {session && <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{ROLE_LABELS[session.role]}</Text>}
                            </View>
                        </View>
                        <TouchableOpacity style={styles.button} onPress={handleDeconnexion}>
                            <Text style={{ fontSize: theme.size_two, color: "#e74c3c" }}>Se déconnecter</Text>
                            <LogOut color="#e74c3c" size={18} strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

        </View>
    );
}


const styles = StyleSheet.create({
    button: {
        backgroundColor: 'white',
        padding: theme.internal_padding,
        borderRadius: theme.internal_radius_2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    }
})