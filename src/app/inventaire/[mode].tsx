import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { Produit, TypeActivite } from "@/Database/db";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Search, X } from "lucide-react-native";
import { memo, useCallback, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const COULEUR_PRIMAIRE = "#0f86e7";
const COULEUR_MANQUANT = "#e74c3c";
const COULEUR_SURPLUS = "#16a34a";

type Mode = "ouverture" | "fermeture";

export default function InventaireScreen() {
    const params = useLocalSearchParams<{ mode: string; activite: string; sessionCaisseId?: string }>();
    const mode: Mode = params.mode === "fermeture" ? "fermeture" : "ouverture";
    const activite: TypeActivite | null = params.activite === "bar" || params.activite === "restaurant" ? params.activite : null;
    const sessionCaisseId = params.sessionCaisseId;

    const { categoriesQuery, produitsQuery, sessionsStockQuery, mouvementsStockQuery, produitsActifsQuery, ouvrirSessionStock, fermerSessionStock } = useDatabase();
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

    const sessionsActivite = (activite ? sessionsStockQuery?.findBy("type_activite", activite) : []) ?? [];
    const sessionOuverte = sessionsActivite
        .filter((s) => s.statut === "ouverte")
        .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0] ?? null;

    // Ouverture comme fermeture : seuls les produits réapprovisionnés il y a
    // moins de 2 semaines sont comptables (voir `produits_actifs` /
    // stock.purgerProduitsInactifs). Un produit jamais réapprovisionné
    // n'apparaît qu'après son premier réapprovisionnement.
    const produitsActifs = new Set((produitsActifsQuery?.findAll() ?? []).map((p) => p.id));
    const estEligible = (produit: Produit) => produitsActifs.has(produit.id);

    const tousProduits = categories
        .flatMap((c) => produitsQuery?.findBy("categorie_id", c.id) ?? [])
        .filter(estEligible);

    // Comptage de la dernière fermeture : c'est l'état de référence du stock à l'ouverture.
    // Rien ne bouge rideau baissé, donc valider sans rien saisir doit reconduire ces
    // quantités à l'identique — surtout pas les remettre à zéro.
    const derniereFermeture = new Map<string, number>();
    const derniereSessionFermee = sessionsActivite
        .filter((s) => s.statut === "fermee" && s.date_fermeture)
        .sort((a, b) => (b.date_fermeture ?? "").localeCompare(a.date_fermeture ?? ""))[0] ?? null;

    if (derniereSessionFermee) {
        for (const mouvement of mouvementsStockQuery?.findBy("session_id", derniereSessionFermee.id) ?? []) {
            if (mouvement.type === "inventaire_fermeture") derniereFermeture.set(mouvement.produit_id, mouvement.quantite);
        }
    }

    /** Quantité enregistrée si l'utilisateur ne touche pas à la ligne. */
    const referenceDe = (produit: Produit) =>
        mode === "ouverture" ? derniereFermeture.get(produit.id) ?? produit.stock_actuel ?? 0 : produit.stock_actuel ?? 0;

    const filtre = recherche.trim().toLowerCase();
    const groupes = categories
        .map((categorie) => ({
            categorie,
            produits: (produitsQuery?.findBy("categorie_id", categorie.id) ?? [])
                .filter(estEligible)
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
        if (!estCompte(produit)) return referenceDe(produit);
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
    const totalUnites = tousProduits.reduce((somme, p) => {
        const q = quantiteDe(p);
        return somme + (Number.isNaN(q) ? 0 : q);
    }, 0);
    const progression = tousProduits.length > 0 ? produitsComptes.length / tousProduits.length : 0;

    // Liste à plat : un élément par en-tête de catégorie puis un par produit.
    // La FlatList ne monte que ce qui est visible — avant, chaque produit montait
    // ses 1 à 2 TextInput d'un coup (des centaines d'EditText natifs à l'ouverture
    // de l'écran, d'où le gel puis le crash sur les gros catalogues).
    type Element =
        | { kind: "categorie"; cle: string; nom: string; comptes: number; total: number }
        | { kind: "produit"; cle: string; produit: Produit };

    const elements: Element[] = [];
    // Ordre de tabulation : il suit ce qui est réellement visible (recherche,
    // catégories repliées) et non la liste complète.
    const ordreChamps: string[] = [];
    // Pour chaque champ, l'index de sa ligne dans la liste : si le champ suivant
    // n'est pas monté (hors fenêtre), on y défile avant de lui donner le focus.
    const indexDeChamp: Record<string, number> = {};

    for (const groupe of groupes) {
        elements.push({
            kind: "categorie",
            cle: `cat:${groupe.categorie.id}`,
            nom: groupe.categorie.nom,
            comptes: groupe.produits.filter(estCompte).length,
            total: groupe.produits.length,
        });
        if (categoriesRepliees[groupe.categorie.id]) continue;
        for (const produit of groupe.produits) {
            const index = elements.length;
            elements.push({ kind: "produit", cle: produit.id, produit });
            const cles = produit.quantite_par_lot
                ? [`${produit.id}:lots`, `${produit.id}:unites`]
                : [`${produit.id}:valeur`];
            for (const cle of cles) {
                ordreChamps.push(cle);
                indexDeChamp[cle] = index;
            }
        }
    }

    // Les refs évitent de repasser ces tableaux en props : leur identité change à
    // chaque frappe, ce qui re-rendrait toutes les lignes mémoïsées.
    const ordreChampsRef = useRef<string[]>(ordreChamps);
    const indexDeChampRef = useRef<Record<string, number>>(indexDeChamp);
    const listeRef = useRef<FlatList<Element>>(null);
    ordreChampsRef.current = ordreChamps;
    indexDeChampRef.current = indexDeChamp;

    const focusSuivant = useCallback((cle: string) => {
        const ordre = ordreChampsRef.current;
        const suivant = ordre[ordre.indexOf(cle) + 1];
        if (!suivant) return;
        const champ = champs.current[suivant];
        if (champ) {
            champ.focus();
            return;
        }
        // Ligne hors fenêtre : la faire venir puis focaliser une fois montée.
        const index = indexDeChampRef.current[suivant];
        if (index === undefined) return;
        listeRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
        setTimeout(() => champs.current[suivant]?.focus(), 50);
    }, []);

    const estDernierChamp = useCallback((cle: string) => {
        const ordre = ordreChampsRef.current;
        return ordre.indexOf(cle) === ordre.length - 1;
    }, []);

    const enregistrerChamp = useCallback((cle: string, ref: TextInput | null) => {
        champs.current[cle] = ref;
    }, []);

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
        } catch {
            // L'erreur est déjà journalisée côté contexte : on évite juste de refermer
            // l'écran comme si l'enregistrement avait réussi.
            showError("L'inventaire n'a pas pu être enregistré. Réessayez.");
            return;
        } finally {
            setIsSubmitting(false);
        }

        setRecapVisible(false);
        if (mode === "ouverture" && sessionCaisseId) {
            router.replace({ pathname: "/session/[id]", params: { id: sessionCaisseId } });
        } else {
            router.back();
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
        // Un seul KeyboardAvoidingView, à la racine, sinon les deux compensent la même
        // hauteur de clavier chacun de leur côté. `behavior` est explicite sur les deux
        // plateformes : en edge-to-edge (défaut Android depuis SDK 54) la fenêtre n'est
        // plus redimensionnée par le clavier, donc `undefined` ne faisait plus rien.
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5", position: 'relative' }}>
            <EnTete titre={titre} />

            <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: theme.internal_padding_2, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                        {produitsComptes.length} / {tousProduits.length} produit{tousProduits.length > 1 ? "s" : ""} compté{produitsComptes.length > 1 ? "s" : ""}
                    </Text>
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{totalUnites} unité{totalUnites > 1 ? "s" : ""} en stock</Text>
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

            <FlatList
                ref={listeRef}
                style={{ flex: 1 }}
                data={elements}
                keyExtractor={(element) => element.cle}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: theme.screenPadding, paddingBottom: 100, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}
                initialNumToRender={12}
                windowSize={7}
                removeClippedSubviews={false}
                // Les lignes ont des hauteurs variables : sans ça, scrollToIndex
                // vers une ligne jamais mesurée lève une exception.
                onScrollToIndexFailed={({ index }) => {
                    listeRef.current?.scrollToOffset({ offset: index * 72, animated: false });
                }}
                ListEmptyComponent={
                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>
                        {filtre === ""
                            ? "Aucun produit n'a été réapprovisionné récemment."
                            : "Aucun produit ne correspond."}
                    </Text>
                }
                renderItem={({ item }) =>
                    item.kind === "categorie" ? (
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: theme.internal_padding, paddingBottom: theme.internal_padding_2 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: "#00000055" }}>{item.nom}</Text>
                            <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                {item.comptes}/{item.total}
                            </Text>
                        </View>
                    ) : (
                        <View style={{ paddingBottom: 3 }}>
                            <LigneProduit
                                produit={item.produit}
                                compte={estCompte(item.produit)}
                                quantite={quantiteDe(item.produit)}
                                reference={referenceDe(item.produit)}
                                labelReference={mode === "ouverture" ? "dernière fermeture" : "théorique"}
                                valeur={valeurs[item.produit.id] ?? ""}
                                lots={lots[item.produit.id] ?? ""}
                                unites={unites[item.produit.id] ?? ""}
                                onValeur={(v) => setValeurs((prev) => ({ ...prev, [item.produit.id]: v }))}
                                onLots={(v) => setLots((prev) => ({ ...prev, [item.produit.id]: v }))}
                                onUnites={(v) => setUnites((prev) => ({ ...prev, [item.produit.id]: v }))}
                                estDernierChamp={estDernierChamp}
                                enregistrerChamp={enregistrerChamp}
                                onSuivant={focusSuivant}
                            />
                        </View>
                    )
                }
            />

            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: theme.screenPadding, paddingBottom: Math.max(insets.bottom, theme.screenPadding), backgroundColor: "#f5f5f546", backdropFilter: "blur(10px)" }}>
                <TouchableOpacity
                    onPress={ouvrirRecap}
                    style={{ backgroundColor: COULEUR_PRIMAIRE, borderRadius: theme.internal_radius, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                >
                    <Text style={{ fontSize: theme.size_two, color: "white", fontWeight: "bold" }}>Valider l'inventaire</Text>
                </TouchableOpacity>
            </View>

            <BottomSheet visible={recapVisible} onClose={() => setRecapVisible(false)}>
                <Text style={{ fontSize: theme.size_three, fontWeight: "bold", marginBottom: theme.internal_padding }}>{titre}</Text>

                <View style={{ gap: 4, marginBottom: theme.internal_padding_2 }}>
                    <Text style={{ fontSize: theme.size_two }}>
                        {produitsComptes.length} produit{produitsComptes.length > 1 ? "s" : ""} compté{produitsComptes.length > 1 ? "s" : ""} · {totalUnites} unité{totalUnites > 1 ? "s" : ""} au total
                    </Text>
                    {produitsNonComptes.length > 0 && (
                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                            {produitsNonComptes.length} produit{produitsNonComptes.length > 1 ? "s" : ""} non recompté{produitsNonComptes.length > 1 ? "s" : ""} :{" "}
                            {mode === "ouverture" ? "la quantité de la dernière fermeture est reconduite." : "le stock théorique est reconduit."}
                        </Text>
                    )}
                </View>

                {produitsNonComptes.length > 0 && (
                    <ScrollView style={{ maxHeight: 140 }} contentContainerStyle={{ gap: 2 }}>
                        {produitsNonComptes.map((p) => (
                            <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{p.nom}</Text>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{referenceDe(p)}</Text>
                            </View>
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
            </BottomSheet>
        </KeyboardAvoidingView>
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
    reference: number;
    labelReference: string;
    valeur: string;
    lots: string;
    unites: string;
    onValeur: (v: string) => void;
    onLots: (v: string) => void;
    onUnites: (v: string) => void;
    estDernierChamp: (cle: string) => boolean;
    enregistrerChamp: (cle: string, ref: TextInput | null) => void;
    onSuivant: (cle: string) => void;
};

const LigneProduit = memo(function LigneProduit({
    produit,
    compte,
    quantite,
    reference,
    labelReference,
    valeur,
    lots,
    unites,
    onValeur,
    onLots,
    onUnites,
    estDernierChamp,
    enregistrerChamp,
    onSuivant,
}: LigneProduitProps) {
    const ecart = compte && !Number.isNaN(quantite) ? quantite - reference : null;

    const proprietesChamp = (cle: string) => {
        const dernier = estDernierChamp(cle);
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
        <View style={{ gap: 4, padding: theme.internal_padding, backgroundColor: "white", borderRadius: theme.internal_radius_2, borderWidth: 1, borderColor: compte ? COULEUR_PRIMAIRE : "transparent" }}>
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
                        {produit.quantite_par_lot ? `${quantite} unités · ` : ""}
                        {labelReference} {reference}
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
});

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
