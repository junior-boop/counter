import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { Produit, TypeActivite } from "@/Database/db";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronRight, Search, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const COULEUR_PRIMAIRE = "#0f86e7";
const COULEUR_MANQUANT = "#e74c3c";
const COULEUR_SURPLUS = "#16a34a";

type Mode = "ouverture" | "fermeture";

export default function InventaireScreen() {
    const params = useLocalSearchParams<{ mode: string; activite: string }>();
    const mode: Mode = params.mode === "fermeture" ? "fermeture" : "ouverture";
    const activite: TypeActivite | null = params.activite === "bar" || params.activite === "restaurant" ? params.activite : null;

    const { categoriesQuery, produitsQuery, sessionsStockQuery, ouvrirSessionStock, fermerSessionStock } = useDatabase();
    const { session } = useAuth();
    const { showError } = useAlert();
    const insets = useSafeAreaInsets();

    const [valeurs, setValeurs] = useState<Record<string, string>>({});
    const [lots, setLots] = useState<Record<string, string>>({});
    const [unites, setUnites] = useState<Record<string, string>>({});
    const [recherche, setRecherche] = useState("");
    const [categoriesRepliees, setCategoriesRepliees] = useState<Record<string, boolean>>({});
    const [recapVisible, setRecapVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const champs = useRef<Record<string, TextInput | null>>({});

    const categories = (activite ? categoriesQuery?.findBy("type", activite) : []) ?? [];
    const tousProduits = categories.flatMap((c) => produitsQuery?.findBy("categorie_id", c.id) ?? []);

    const sessionOuverte = ((activite ? sessionsStockQuery?.findBy("type_activite", activite) : []) ?? [])
        .filter((s) => s.statut === "ouverte")
        .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0] ?? null;

    const filtre = recherche.trim().toLowerCase();
    const groupes = categories
        .map((categorie) => ({
            categorie,
            produits: (produitsQuery?.findBy("categorie_id", categorie.id) ?? [])
                .filter((p) => p.nom.toLowerCase().includes(filtre))
                .sort((a, b) => a.nom.localeCompare(b.nom)),
        }))
        .filter((groupe) => groupe.produits.length > 0);

    // Un produit est "compté" dès qu'un champ est renseigné : un champ vide n'est pas
    // un zéro, c'est une ligne que personne n'a regardée.
    const estCompte = (produit: Produit) =>
        produit.quantite_par_lot
            ? (lots[produit.id] ?? "").trim() !== "" || (unites[produit.id] ?? "").trim() !== ""
            : (valeurs[produit.id] ?? "").trim() !== "";

    const quantiteDe = (produit: Produit): number => {
        if (produit.quantite_par_lot) {
            const nbLots = enNombre(lots[produit.id]);
            const nbUnites = enNombre(unites[produit.id]);
            if (Number.isNaN(nbLots) || Number.isNaN(nbUnites)) return NaN;
            return nbLots * produit.quantite_par_lot + nbUnites;
        }
        return enNombre(valeurs[produit.id]);
    };

    const produitsComptes = tousProduits.filter(estCompte);
    const produitsNonComptes = tousProduits.filter((p) => !estCompte(p));
    const totalUnites = produitsComptes.reduce((somme, p) => {
        const q = quantiteDe(p);
        return somme + (Number.isNaN(q) ? 0 : q);
    }, 0);
    const progression = tousProduits.length > 0 ? produitsComptes.length / tousProduits.length : 0;

    // Ordre de tabulation reconstruit à chaque rendu : il suit ce qui est réellement
    // visible (recherche, catégories repliées) et non la liste complète.
    const ordreChamps: string[] = [];
    for (const groupe of groupes) {
        if (categoriesRepliees[groupe.categorie.id]) continue;
        for (const produit of groupe.produits) {
            if (produit.quantite_par_lot) ordreChamps.push(`${produit.id}:lots`, `${produit.id}:unites`);
            else ordreChamps.push(`${produit.id}:valeur`);
        }
    }

    const focusSuivant = (cle: string) => {
        const suivant = ordreChamps[ordreChamps.indexOf(cle) + 1];
        if (suivant) champs.current[suivant]?.focus();
    };

    const ouvrirRecap = () => {
        const invalide = tousProduits.find((p) => {
            const q = quantiteDe(p);
            return Number.isNaN(q) || q < 0;
        });
        if (invalide) {
            showError(`Quantité invalide pour ${invalide.nom}.`);
            return;
        }
        setRecapVisible(true);
    };

    const valider = async () => {
        if (isSubmitting || !activite || !session) return;

        const comptages = tousProduits.map((p) => ({ produit_id: p.id, quantite: quantiteDe(p) }));

        setIsSubmitting(true);
        try {
            if (mode === "ouverture") {
                await ouvrirSessionStock({ type_activite: activite, utilisateur_ouverture_id: session.id, comptages });
            } else if (sessionOuverte) {
                await fermerSessionStock({ id: sessionOuverte.id, utilisateur_fermeture_id: session.id, comptages });
            }
            setRecapVisible(false);
            router.back();
        } finally {
            setIsSubmitting(false);
        }
    };

    const titre = mode === "ouverture" ? "Inventaire d'ouverture" : "Inventaire de fermeture";

    if (!activite || (mode === "fermeture" && !sessionOuverte)) {
        return (
            <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5" }}>
                <EnTete titre={titre} />
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Inventaire indisponible.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5" }}>
            <EnTete titre={titre} />

            <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: theme.internal_padding_2, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                        {produitsComptes.length} / {tousProduits.length} produit{tousProduits.length > 1 ? "s" : ""} compté{produitsComptes.length > 1 ? "s" : ""}
                    </Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{totalUnites} unité{totalUnites > 1 ? "s" : ""}</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: "#e5e7eb", overflow: "hidden" }}>
                    <Animated.View
                        layout={LinearTransition.duration(220)}
                        style={{ height: 4, borderRadius: 2, backgroundColor: COULEUR_PRIMAIRE, width: `${Math.round(progression * 100)}%` }}
                    />
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2, backgroundColor: "white", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding_2 }}>
                    <Search color="#aaaaaa" size={16} strokeWidth={1.5} />
                    <TextInput
                        value={recherche}
                        onChangeText={setRecherche}
                        placeholder="Rechercher un produit"
                        placeholderTextColor="#aaaaaa"
                        style={{ flex: 1, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                    />
                    {recherche.length > 0 && (
                        <TouchableOpacity onPress={() => setRecherche("")} hitSlop={8}>
                            <X color="#aaaaaa" size={16} strokeWidth={1.5} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: theme.internal_padding }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        {groupes.length === 0 && (
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun produit ne correspond.</Text>
                        )}

                        {groupes.map(({ categorie, produits }) => {
                            const replie = categoriesRepliees[categorie.id] ?? false;
                            const comptesCategorie = produits.filter(estCompte).length;

                            return (
                                <Animated.View
                                    key={categorie.id}
                                    layout={LinearTransition.duration(220)}
                                    style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}
                                >
                                    <TouchableOpacity
                                        onPress={() => setCategoriesRepliees((prev) => ({ ...prev, [categorie.id]: !replie }))}
                                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                    >
                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{categorie.nom}</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                                            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                                {comptesCategorie}/{produits.length}
                                            </Text>
                                            {replie ? (
                                                <ChevronRight color="black" size={18} strokeWidth={1.5} />
                                            ) : (
                                                <ChevronDown color="black" size={18} strokeWidth={1.5} />
                                            )}
                                        </View>
                                    </TouchableOpacity>

                                    {!replie && (
                                        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={{ gap: theme.internal_padding }}>
                                            {produits.map((produit) => (
                                                <LigneProduit
                                                    key={produit.id}
                                                    produit={produit}
                                                    compte={estCompte(produit)}
                                                    quantite={quantiteDe(produit)}
                                                    valeur={valeurs[produit.id] ?? ""}
                                                    lots={lots[produit.id] ?? ""}
                                                    unites={unites[produit.id] ?? ""}
                                                    onValeur={(v) => setValeurs((prev) => ({ ...prev, [produit.id]: v }))}
                                                    onLots={(v) => setLots((prev) => ({ ...prev, [produit.id]: v }))}
                                                    onUnites={(v) => setUnites((prev) => ({ ...prev, [produit.id]: v }))}
                                                    ordreChamps={ordreChamps}
                                                    enregistrerChamp={(cle, ref) => {
                                                        champs.current[cle] = ref;
                                                    }}
                                                    onSuivant={focusSuivant}
                                                />
                                            ))}
                                        </Animated.View>
                                    )}
                                </Animated.View>
                            );
                        })}
                    </View>
                </ScrollView>

                <View style={{ padding: theme.screenPadding, paddingBottom: Math.max(insets.bottom, theme.screenPadding), backgroundColor: "#f5f5f5" }}>
                    <TouchableOpacity
                        onPress={ouvrirRecap}
                        style={{ backgroundColor: COULEUR_PRIMAIRE, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                    >
                        <Text style={{ fontSize: theme.size_two, color: "white", fontWeight: "bold" }}>Valider l'inventaire</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={recapVisible} transparent animationType="slide" onRequestClose={() => setRecapVisible(false)}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <TouchableOpacity
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
                        activeOpacity={1}
                        onPress={() => setRecapVisible(false)}
                    />
                    <View style={{ backgroundColor: "white", borderTopLeftRadius: theme.radius, borderTopRightRadius: theme.radius, padding: theme.screenPadding, paddingBottom: Math.max(insets.bottom, theme.screenPadding), gap: theme.internal_padding }}>
                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{titre}</Text>

                        <View style={{ gap: 4 }}>
                            <Text style={{ fontSize: theme.size_two }}>
                                {produitsComptes.length} produit{produitsComptes.length > 1 ? "s" : ""} compté{produitsComptes.length > 1 ? "s" : ""} · {totalUnites} unité{totalUnites > 1 ? "s" : ""}
                            </Text>
                            {produitsNonComptes.length > 0 && (
                                <Text style={{ fontSize: theme.size_one, color: COULEUR_MANQUANT }}>
                                    {produitsNonComptes.length} produit{produitsNonComptes.length > 1 ? "s" : ""} non compté{produitsNonComptes.length > 1 ? "s" : ""}, {produitsNonComptes.length > 1 ? "ils seront enregistrés" : "il sera enregistré"} à 0.
                                </Text>
                            )}
                        </View>

                        {produitsNonComptes.length > 0 && (
                            <ScrollView style={{ maxHeight: 140 }} contentContainerStyle={{ gap: 2 }}>
                                {produitsNonComptes.map((p) => (
                                    <Text key={p.id} style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                        {p.nom}
                                    </Text>
                                ))}
                            </ScrollView>
                        )}

                        <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                            <TouchableOpacity
                                onPress={() => setRecapVisible(false)}
                                style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, alignItems: "center", paddingVertical: theme.internal_padding }}
                            >
                                <Text style={{ fontSize: theme.size_two }}>Continuer à compter</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={valider}
                                disabled={isSubmitting}
                                style={{ flex: 1, backgroundColor: COULEUR_PRIMAIRE, opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", paddingVertical: theme.internal_padding }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white", fontWeight: "bold" }}>Valider</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function EnTete({ titre }: { titre: string }) {
    return (
        <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2, paddingHorizontal: theme.screenPadding }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                <ArrowLeft color="black" size={22} strokeWidth={1.5} />
            </TouchableOpacity>
            <Text style={{ fontSize: theme.size_three }}>{titre}</Text>
        </View>
    );
}

type LigneProduitProps = {
    produit: Produit;
    compte: boolean;
    quantite: number;
    valeur: string;
    lots: string;
    unites: string;
    onValeur: (v: string) => void;
    onLots: (v: string) => void;
    onUnites: (v: string) => void;
    ordreChamps: string[];
    enregistrerChamp: (cle: string, ref: TextInput | null) => void;
    onSuivant: (cle: string) => void;
};

function LigneProduit({
    produit,
    compte,
    quantite,
    valeur,
    lots,
    unites,
    onValeur,
    onLots,
    onUnites,
    ordreChamps,
    enregistrerChamp,
    onSuivant,
}: LigneProduitProps) {
    const theorique = produit.stock_actuel ?? 0;
    const ecart = compte && !Number.isNaN(quantite) ? quantite - theorique : null;

    const proprietesChamp = (cle: string) => {
        const dernier = ordreChamps.indexOf(cle) === ordreChamps.length - 1;
        return {
            ref: (ref: TextInput | null) => enregistrerChamp(cle, ref),
            keyboardType: "numeric" as const,
            placeholderTextColor: "#aaaaaa",
            returnKeyType: (dernier ? "done" : "next") as "done" | "next",
            blurOnSubmit: dernier,
            onSubmitEditing: () => onSuivant(cle),
        };
    };

    return (
        <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.internal_padding_2 }}>
                <Text style={{ fontSize: theme.size_two, flex: 1 }}>
                    {produit.nom}
                    {produit.quantite_par_lot ? <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}> (lot de {produit.quantite_par_lot})</Text> : null}
                </Text>

                {!produit.quantite_par_lot && (
                    <TextInput
                        {...proprietesChamp(`${produit.id}:valeur`)}
                        value={valeur}
                        onChangeText={onValeur}
                        placeholder="—"
                        style={champStyle(compte, 90)}
                    />
                )}
            </View>

            {produit.quantite_par_lot ? (
                <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                    <TextInput
                        {...proprietesChamp(`${produit.id}:lots`)}
                        value={lots}
                        onChangeText={onLots}
                        placeholder="Lots"
                        style={[champStyle(compte), { flex: 1 }]}
                    />
                    <TextInput
                        {...proprietesChamp(`${produit.id}:unites`)}
                        value={unites}
                        onChangeText={onUnites}
                        placeholder="Unités"
                        style={[champStyle(compte), { flex: 1 }]}
                    />
                </View>
            ) : null}

            {ecart !== null && (
                <Animated.View entering={FadeIn.duration(140)}>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                        {produit.quantite_par_lot ? `${quantite} unités · ` : ""}théorique {theorique}
                        {ecart !== 0 && (
                            <Text style={{ fontSize: theme.size_one, color: ecart < 0 ? COULEUR_MANQUANT : COULEUR_SURPLUS, fontWeight: "bold" }}>
                                {" "}
                                · écart {ecart > 0 ? "+" : ""}
                                {ecart}
                            </Text>
                        )}
                    </Text>
                </Animated.View>
            )}
        </View>
    );
}

function champStyle(compte: boolean, largeur?: number) {
    return {
        width: largeur,
        backgroundColor: "#f5f5f5",
        borderRadius: theme.internal_radius_2,
        borderWidth: 1,
        borderColor: compte ? COULEUR_PRIMAIRE : "transparent",
        paddingHorizontal: theme.internal_padding_2,
        paddingVertical: theme.internal_padding_2,
        fontSize: theme.size_two,
        textAlign: "right" as const,
        color: "black",
    };
}

function enNombre(valeur: string | undefined): number {
    if (!valeur || valeur.trim() === "") return 0;
    return parseFloat(valeur.replace(",", "."));
}
