import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { Text } from "@/components/text";
import Titre from "@/components/titre";
import { useDatabase } from "@/Database/database.context";
import { Role, TypeActivite } from "@/Database/db";
import { router } from "expo-router";
import { ChevronRight, LogOut, Plus } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
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

const HEURES_FERMETURE_SESSION = [23, 2, 4, 8];

export default function SettingsScreen() {
    const { etablissement, categoriesQuery, produitsQuery, addCategorie, updateEtablissement } = useDatabase();
    const { session, signOut } = useAuth();
    const { confirm, showError } = useAlert();
    const border = useSafeAreaInsets();
    const estAdmin = session?.role === "patron" || session?.role === "gerant";
    const lectureSeule = !!etablissement?.server_id;

    const categories = (categoriesQuery?.findAll() ?? []).slice().sort((a, b) => a.nom.localeCompare(b.nom));

    const [isCategorieSheetOpen, setIsCategorieSheetOpen] = useState(false);
    const [nouvelleCategorie, setNouvelleCategorie] = useState<{ nom: string; type: TypeActivite }>({
        nom: "",
        type: etablissement?.type === "restaurant" ? "restaurant" : "bar",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDeconnexion = async () => {
        const ok = await confirm("Voulez-vous vous déconnecter ?", { confirmLabel: "Se déconnecter" });
        if (ok) await signOut();
    };

    const handleToggleFermetureAuto = async () => {
        if (!etablissement) return;
        const active = !etablissement.fermeture_session_active;
        await updateEtablissement({
            ...etablissement,
            fermeture_session_active: active,
            fermeture_session_heure: etablissement.fermeture_session_heure ?? HEURES_FERMETURE_SESSION[0],
        });
    };

    const handleChoisirHeureFermeture = async (heure: number) => {
        if (!etablissement) return;
        await updateEtablissement({ ...etablissement, fermeture_session_heure: heure });
    };

    const handleAddCategorie = async () => {
        if (isSubmitting) return;
        if (!nouvelleCategorie.nom.trim()) {
            showError("Le nom de la catégorie est requis.");
            return;
        }
        setIsSubmitting(true);
        try {
            await addCategorie({ nom: nouvelleCategorie.nom.trim(), type: nouvelleCategorie.type });
            setNouvelleCategorie((prev) => ({ ...prev, nom: "" }));
            setIsCategorieSheetOpen(false);
        } finally {
            setIsSubmitting(false);
        }
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
                                {session?.role === "patron" ? (
                                    <TouchableOpacity style={styles.button} onPress={() => router.push("/etablissement")}>
                                        <View style={{ gap: 2 }}>
                                            <Text style={{ fontSize: theme.size_two }}>{etablissement?.nom || "Configurer l'établissement"}</Text>
                                            {etablissement && (
                                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Type d'activité: {TYPE_LABELS[etablissement.type]}</Text>
                                            )}
                                        </View>
                                        <ChevronRight color="black" size={20} strokeWidth={1} />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.button}>
                                        <View style={{ gap: 2 }}>
                                            <Text style={{ fontSize: theme.size_two }}>{etablissement?.nom || "Établissement non configuré"}</Text>
                                            {etablissement && (
                                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Type d'activité: {TYPE_LABELS[etablissement.type]}</Text>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>



                        {/* <Titre titre="Utilisateurs & rôles" />
                        <View style={{ paddingHorizontal: theme.screenPadding }}>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.5, marginBottom: theme.internal_padding_2 }}>
                                Les employés sont créés par le patron depuis son espace, puis synchronisés automatiquement sur cet appareil.
                            </Text>
                        </View> */}
                    </>
                )}

                <Titre titre="Sécurité" />
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.5, marginBottom: theme.internal_padding_2 }}>
                        Déconnecte automatiquement les employés à une heure fixe, pour éviter qu'une session reste ouverte toute la nuit.
                    </Text>
                    <View style={{ gap: 3, overflow: 'hidden', borderRadius: theme.internal_radius, borderColor: 'transparent', borderWidth: 1 }}>
                        <TouchableOpacity style={styles.button} onPress={handleToggleFermetureAuto}>
                            <Text style={{ fontSize: theme.size_two }}>Déconnexion automatique</Text>
                            <View style={{ backgroundColor: etablissement?.fermeture_session_active ? "#0f86e7" : "#e5e5e5", borderRadius: 999, paddingHorizontal: theme.internal_padding_2, paddingVertical: 4 }}>
                                <Text style={{ fontSize: theme.size_one, color: etablissement?.fermeture_session_active ? "white" : "#838383" }}>
                                    {etablissement?.fermeture_session_active ? "Activée" : "Désactivée"}
                                </Text>

                            </View>
                        </TouchableOpacity>
                    </View>
                    {etablissement?.fermeture_session_active && (
                        <View style={{ flexDirection: "row", gap: theme.internal_padding_2, marginTop: theme.internal_padding_2 }}>
                            {HEURES_FERMETURE_SESSION.map((heure) => (
                                <TouchableOpacity
                                    key={heure}
                                    onPress={() => handleChoisirHeureFermeture(heure)}
                                    style={{ flex: 1, borderRadius: theme.internal_radius_2, paddingVertical: theme.internal_padding_2, alignItems: "center", backgroundColor: etablissement.fermeture_session_heure === heure ? "#0f86e7" : "#f5f5f5" }}
                                >
                                    <Text style={{ fontSize: theme.size_two, color: etablissement.fermeture_session_heure === heure ? "white" : "black" }}>{heure}h</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
                <View style={{ paddingHorizontal: theme.screenPadding, marginTop: theme.size_four, marginBottom: theme.size_one, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: theme.size_two, color: "#838383" }}>Catalogue</Text>
                    {!lectureSeule && (
                        <TouchableOpacity onPress={() => setIsCategorieSheetOpen(true)} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                            <Plus color="#0f86e7" size={16} strokeWidth={1.5} />
                            <Text style={{ fontSize: theme.size_two, color: "#0f86e7" }}>Catégorie</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    {categories.length === 0 && (
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucune catégorie pour l'instant.</Text>
                    )}
                    {categories.length > 0 && (
                        <View style={{ gap: 3, overflow: 'hidden', borderRadius: theme.internal_radius, borderColor: 'transparent', borderWidth: 1 }}>
                            {categories.map((categorie) => {
                                const nbProduits = produitsQuery?.findBy("categorie_id", categorie.id).length ?? 0;
                                return (
                                    <TouchableOpacity
                                        key={categorie.id}
                                        style={styles.button}
                                        onPress={() => router.push({ pathname: "/activite/[type]", params: { type: categorie.id } })}
                                    >
                                        <View style={{ gap: 2 }}>
                                            <Text style={{ fontSize: theme.size_two }}>{categorie.nom}</Text>
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{nbProduits} produit{nbProduits > 1 ? "s" : ""}</Text>
                                        </View>
                                        <ChevronRight color="black" size={20} strokeWidth={1} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>

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

            <BottomSheet visible={isCategorieSheetOpen} onClose={() => setIsCategorieSheetOpen(false)}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Ajouter une catégorie</Text>
                <View style={{ gap: 8, marginTop: theme.internal_padding }}>
                    <TextInput
                        value={nouvelleCategorie.nom}
                        onChangeText={(nom) => setNouvelleCategorie((prev) => ({ ...prev, nom }))}
                        placeholder="Nom de la catégorie"
                        placeholderTextColor={"#aaaaaa"}
                        autoFocus
                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                    />
                    {etablissement?.type === "les_deux" && (
                        <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                            {(["bar", "restaurant"] as TypeActivite[]).map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setNouvelleCategorie((prev) => ({ ...prev, type: t }))}
                                    style={{ flex: 1, backgroundColor: nouvelleCategorie.type === t ? "#0f86e7" : "#f5f5f5", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding_2 }}
                                >
                                    <Text style={{ fontSize: theme.size_two, color: nouvelleCategorie.type === t ? "white" : "black" }}>{TYPE_LABELS[t]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={handleAddCategorie}
                        disabled={isSubmitting}
                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Ajouter</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheet>
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