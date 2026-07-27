import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { StockTrendChart, StockTrendPoint } from "@/components/StockTrendChart";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { CategoriePerte, MouvementStock, Produit, TypeActivite, TypeMouvementStock } from "@/Database/db";
import { formaterDateCourte, formaterDateRelative, jourLocal } from "@/lib/date";
import { Temporal } from "@js-temporal/polyfill";
import { router } from "expo-router";
import { ArrowLeft, ChevronRight, PackagePlus, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

const ACTIVITES: { value: TypeActivite; label: string }[] = [
    { value: "bar", label: "Stock Bar" },
    { value: "restaurant", label: "Stock Restaurant" },
];

const CATEGORIES_PERTE: { value: CategoriePerte; label: string }[] = [
    { value: "casse", label: "Casse" },
    { value: "peremption", label: "Péremption" },
    { value: "offert", label: "Offert / conso. interne" },
    { value: "inexplique", label: "Écart inexpliqué" },
];

const JOURS_AFFICHES = 7;

type ModalMode = "reappro" | "perte" | "seuil";
type ListMode = "reappro" | "perte" | null;

export default function StockScreen() {
    const { etablissement, categoriesQuery, produitsQuery, mouvementsStockQuery, sessionsStockQuery, ajouterMouvementStock, modifierSeuilAlerteProduit } = useDatabase();
    const { session } = useAuth();
    const { showError } = useAlert();
    const insets = useSafeAreaInsets();

    const [activiteChoisie, setActiviteChoisie] = useState<TypeActivite | null>(null);
    const [categorieModalId, setCategorieModalId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [listMode, setListMode] = useState<ListMode>(null);
    const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
    const [modalMode, setModalMode] = useState<ModalMode>("seuil");
    const [quantite, setQuantite] = useState("");
    const [categoriePerte, setCategoriePerte] = useState<CategoriePerte>("casse");
    const [motif, setMotif] = useState("");
    const [seuil, setSeuil] = useState("");
    const [lots, setLots] = useState("");
    const [unitesSupp, setUnitesSupp] = useState("");

    const activite: TypeActivite | null = etablissement?.type === "les_deux" ? activiteChoisie : (etablissement?.type ?? null);

    const categories = (activite ? categoriesQuery?.findBy("type", activite) : []) ?? [];
    const sessionsActivite = (activite ? sessionsStockQuery?.findBy("type_activite", activite) : []) ?? [];
    const sessionOuverte = sessionsActivite
        .filter((s) => s.statut === "ouverte")
        .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0] ?? null;

    const sommerQuantites = (mouvements: MouvementStock[], type: TypeMouvementStock) =>
        mouvements.filter((m) => m.type === type).reduce((somme, m) => somme + m.quantite, 0);

    const historique = sessionsActivite
        .slice()
        .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))
        .map((s) => {
            const mouvements = mouvementsStockQuery?.findBy("session_id", s.id) ?? [];
            return {
                session: s,
                nombreProduitsOuverture: mouvements.filter((m) => m.type === "inventaire_ouverture").length,
                ouverture: sommerQuantites(mouvements, "inventaire_ouverture"),
                reappro: sommerQuantites(mouvements, "reapprovisionnement"),
                pertes: sommerQuantites(mouvements, "perte"),
                restant: sommerQuantites(mouvements, "inventaire_fermeture"),
                cloture: s.statut === "fermee",
            };
        });

    const tendanceParJour: StockTrendPoint[] = (() => {
        if (historique.length === 0) return [];

        type Cumul = { ouverture: number; reappro: number; pertes: number; restant: number; cloture: boolean };
        const parJour = new Map<string, Cumul>();

        for (const entree of historique) {
            const jour = jourLocal(entree.session.date_ouverture);
            const cumul = parJour.get(jour) ?? { ouverture: 0, reappro: 0, pertes: 0, restant: 0, cloture: false };
            cumul.ouverture += entree.ouverture;
            cumul.reappro += entree.reappro;
            cumul.pertes += entree.pertes;
            cumul.restant += entree.restant;
            cumul.cloture = cumul.cloture || entree.cloture;
            parJour.set(jour, cumul);
        }

        // Fenêtre calendaire fixe : les jours sans inventaire comptent autant que les autres,
        // une journée non comptée est justement un angle mort pour la détection d'écart.
        const aujourdhui = Temporal.Now.plainDateISO();
        const debut = aujourdhui.subtract({ days: JOURS_AFFICHES - 1 });

        const points: StockTrendPoint[] = [];
        for (let curseur = debut; Temporal.PlainDate.compare(curseur, aujourdhui) <= 0; curseur = curseur.add({ days: 1 })) {
            const jour = curseur.toString();
            const label = formaterDateCourte(new Date(curseur.year, curseur.month - 1, curseur.day));
            const cumul = parJour.get(jour);

            if (!cumul) {
                points.push({ jour, label, aSession: false, cloture: false, ouverture: 0, reappro: 0, pertes: 0, restant: 0, disponible: 0, sorti: 0 });
                continue;
            }

            const disponible = cumul.ouverture + cumul.reappro;
            points.push({
                jour,
                label,
                aSession: true,
                cloture: cumul.cloture,
                ouverture: cumul.ouverture,
                reappro: cumul.reappro,
                pertes: cumul.pertes,
                restant: cumul.restant,
                disponible,
                sorti: cumul.cloture ? Math.max(0, disponible - cumul.restant) : 0,
            });
        }
        return points;
    })();

    const closeSheet = () => {
        setSelectedProduit(null);
        setQuantite("");
        setCategoriePerte("casse");
        setMotif("");
        setSeuil("");
        setLots("");
        setUnitesSupp("");
    };

    const openSeuilSheet = (produit: Produit) => {
        setSelectedProduit(produit);
        setModalMode("seuil");
        setSeuil(produit.seuil_alerte != null ? String(produit.seuil_alerte) : "");
    };

    const openOperationSheet = (produit: Produit, mode: "reappro" | "perte") => {
        if (!sessionOuverte) {
            showError("Ouvrez l'inventaire pour enregistrer des mouvements de stock.");
            return;
        }
        setSelectedProduit(produit);
        setModalMode(mode);
        setQuantite("");
        setCategoriePerte("casse");
        setMotif("");
        setLots("");
        setUnitesSupp("");
    };

    const openOperationList = (mode: "reappro" | "perte") => {
        if (!sessionOuverte) {
            showError("Ouvrez l'inventaire pour enregistrer des mouvements de stock.");
            return;
        }
        setListMode(mode);
    };

    const closeOperationList = () => {
        setListMode(null);
    };

    const quantiteParLot = selectedProduit?.quantite_par_lot ?? null;

    const calculerQuantiteReappro = (): number => {
        if (!quantiteParLot) return parseFloat(quantite);
        const lotsVal = lots.trim() ? parseFloat(lots) : 0;
        const unitesVal = unitesSupp.trim() ? parseFloat(unitesSupp) : 0;
        if (Number.isNaN(lotsVal) || Number.isNaN(unitesVal)) return NaN;
        return lotsVal * quantiteParLot + unitesVal;
    };

    const handleReapprovisionner = async () => {
        if (isSubmitting) return;
        const q = calculerQuantiteReappro();
        if (!selectedProduit || !session || !sessionOuverte || Number.isNaN(q) || q <= 0) {
            showError("La quantité doit être supérieure à 0.");
            return;
        }
        setIsSubmitting(true);
        try {
            await ajouterMouvementStock({ session_id: sessionOuverte.id, produit_id: selectedProduit.id, type: "reapprovisionnement", quantite: q, utilisateur_id: session.id });
            closeSheet();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePerte = async () => {
        if (isSubmitting) return;
        const q = parseFloat(quantite);
        if (!selectedProduit || !session || !sessionOuverte || Number.isNaN(q) || q <= 0) {
            showError("La quantité doit être supérieure à 0.");
            return;
        }
        setIsSubmitting(true);
        try {
            await ajouterMouvementStock({ session_id: sessionOuverte.id, produit_id: selectedProduit.id, type: "perte", quantite: q, categorie_perte: categoriePerte, motif: motif.trim() || undefined, utilisateur_id: session.id });
            closeSheet();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSeuil = async () => {
        if (isSubmitting) return;
        if (!selectedProduit) return;
        const s = seuil.trim() ? parseFloat(seuil) : null;
        if (s !== null && (Number.isNaN(s) || s < 0)) {
            showError("Le seuil d'alerte doit être positif.");
            return;
        }
        setIsSubmitting(true);
        try {
            await modifierSeuilAlerteProduit(selectedProduit.id, s);
            closeSheet();
        } finally {
            setIsSubmitting(false);
        }
    };

    const ouvrirComptage = (mode: "ouverture" | "fermeture") => {
        if (!activite) return;
        router.push({ pathname: "/inventaire/[mode]", params: { mode, activite } });
    };

    if (etablissement?.type === "les_deux" && !activiteChoisie) {
        return (
            <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5" }}>
                <View style={{ height: theme.headerHeight, justifyContent: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Stock</Text>
                </View>
                <View style={{ paddingHorizontal: theme.screenPadding, gap: 8, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    {ACTIVITES.map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            onPress={() => setActiviteChoisie(option.value)}
                            style={{ backgroundColor: "white", borderRadius: theme.internal_radius, paddingVertical: theme.internal_padding, paddingHorizontal: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                        >
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{option.label}</Text>
                            <ChevronRight color="black" size={20} strokeWidth={1} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5" }}>
            <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.screenPadding }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                    {etablissement?.type === "les_deux" && (
                        <TouchableOpacity onPress={() => setActiviteChoisie(null)}>
                            <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                        </TouchableOpacity>
                    )}
                    <Text style={{ fontSize: theme.size_four }}>{etablissement?.type === "les_deux" ? ACTIVITES.find((a) => a.value === activite)?.label : "Stock"}</Text>
                </View>
                {!sessionOuverte && sessionsActivite.length > 0 && (
                    <TouchableOpacity
                        onPress={() => ouvrirComptage("ouverture")}
                        style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2 }}
                    >
                        <Text style={{ fontSize: theme.size_one, color: "white", fontWeight: "bold" }}>Ouvrir l'inventaire</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={{ flex: 1 }}>
                <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>

                    {!sessionOuverte && sessionsActivite.length === 0 && (
                        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>Aucun inventaire en cours. Comptez le stock actuel de chaque produit pour ouvrir la journée.</Text>
                            <TouchableOpacity
                                onPress={() => ouvrirComptage("ouverture")}
                                style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "white" }}>Ouvrir l'inventaire</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {sessionOuverte && (
                        <View style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding_2 }}>
                            <Text style={{ fontSize: theme.size_one, color: "white", opacity: 0.8 }}>Inventaire actif</Text>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold", color: "white" }}>
                                Ouvert {formaterDateRelative(sessionOuverte.date_ouverture).toLowerCase()}
                            </Text>
                            <TouchableOpacity
                                onPress={() => ouvrirComptage("fermeture")}
                                style={{ backgroundColor: "white", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                            >
                                <Text style={{ fontSize: theme.size_two, color: "#0f86e7", fontWeight: "bold" }}>Fermer l'inventaire</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {tendanceParJour.length > 0 && <StockTrendChart data={tendanceParJour} />}

                    <View style={{ gap: theme.internal_padding_2 }}>
                        <TouchableOpacity
                            onPress={() => openOperationList("reappro")}
                            style={{ flex: 1, backgroundColor: "#eff6fc", borderWidth: 1, borderColor: "#0f86e74b", flexDirection: "row", borderRadius: theme.internal_radius, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, gap: theme.internal_padding, paddingHorizontal: theme.internal_padding_2 }}
                        >
                            <PackagePlus size={20} strokeWidth={1.5} color={"#0f86e7"} />
                            <Text style={{ fontSize: theme.size_two, color: "#0f86e7", fontWeight: "bold" }}>Réapprovisionnement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => openOperationList("perte")}
                            style={{ flex: 1, backgroundColor: "#e74c3c", borderRadius: theme.internal_radius, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                        >
                            <Text style={{ fontSize: theme.size_two, color: "white", fontWeight: "bold" }}>Enregistrer une perte</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginTop: theme.internal_padding }}>État du Stock</Text>
                    <View style={{ gap: 3, borderRadius: theme.internal_radius, overflow: "hidden" }}>
                        {categories.map((categorie) => {
                            const produits = (produitsQuery?.findBy("categorie_id", categorie.id) ?? []);
                            return (
                                <TouchableOpacity
                                    key={categorie.id}
                                    onPress={() => setCategorieModalId(categorie.id)}
                                    style={{ backgroundColor: "white", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                >
                                    <View style={{ gap: 5 }}>
                                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{categorie.nom}</Text>
                                        <Text style={{ fontSize: theme.size_one, color: "gray" }}>Qte. {produits.length} produits</Text>
                                    </View>
                                    <ChevronRight color="black" size={20} strokeWidth={1} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>



                    {historique.length > 0 && (
                        <View style={{ gap: 8 }}>
                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginTop: theme.internal_padding }}>Historique</Text>
                            <View style={{ gap: 3, borderRadius: theme.internal_radius, overflow: "hidden" }}>
                                {historique.map(({ session: s, nombreProduitsOuverture, reappro, restant }) => (
                                    <TouchableOpacity
                                        key={s.id}
                                        onPress={() => router.push({ pathname: "/session-stock/[id]", params: { id: s.id } })}
                                        style={{ backgroundColor: "white", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, gap: 6 }}
                                    >
                                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: s.statut === "ouverte" ? "#0f86e7" : "black" }}>
                                                {s.statut === "ouverte" ? "Inventaire en cours" : "Inventaire fermé"}
                                            </Text>
                                            <ChevronRight color="black" size={18} strokeWidth={1} />
                                        </View>
                                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                                            {nombreProduitsOuverture} produit{nombreProduitsOuverture > 1 ? "s" : ""} à l'ouverture · +{reappro} réappro. · {s.statut === "fermee" ? `${restant} à la fermeture` : "en cours"}
                                        </Text>
                                        <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                            Ouvert {formaterDateRelative(s.date_ouverture).toLowerCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            <Modal visible={selectedProduit !== null} transparent animationType="slide" onRequestClose={closeSheet}>
                <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior="padding">
                    <View style={{ flex: 1, position: "relative", justifyContent: "flex-end", alignItems: "center" }}>
                        <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={closeSheet} />
                        <View style={{ backgroundColor: "white", padding: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth }}>
                            {modalMode === "reappro" && (
                                <>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Réapprovisionner {selectedProduit?.nom}</Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Stock actuel : {selectedProduit?.stock_actuel ?? 0}</Text>
                                    {quantiteParLot ? (
                                        <>
                                            <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>1 lot = {quantiteParLot} unités. Entrez un nombre de lots (ex: 2 ou 0.5) et/ou un complément en unités.</Text>
                                            <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
                                                <TextInput
                                                    value={lots}
                                                    onChangeText={setLots}
                                                    placeholder="Nombre de lots"
                                                    placeholderTextColor={"#aaaaaa"}
                                                    keyboardType="decimal-pad"
                                                    style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                                />
                                                <TextInput
                                                    value={unitesSupp}
                                                    onChangeText={setUnitesSupp}
                                                    placeholder="+ unités"
                                                    placeholderTextColor={"#aaaaaa"}
                                                    keyboardType="numeric"
                                                    style={{ flex: 1, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                                />
                                            </View>
                                            {(lots.trim() !== "" || unitesSupp.trim() !== "") && !Number.isNaN(calculerQuantiteReappro()) && (
                                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Total : {calculerQuantiteReappro()} unités</Text>
                                            )}
                                        </>
                                    ) : (
                                        <TextInput
                                            value={quantite}
                                            onChangeText={setQuantite}
                                            placeholder="Quantité ajoutée"
                                            placeholderTextColor={"#aaaaaa"}
                                            keyboardType="numeric"
                                            style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                        />
                                    )}
                                    <TouchableOpacity
                                        onPress={handleReapprovisionner}
                                        disabled={isSubmitting}
                                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                                    >
                                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Valider</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {modalMode === "perte" && (
                                <>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Enregistrer une perte — {selectedProduit?.nom}</Text>
                                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Stock actuel : {selectedProduit?.stock_actuel ?? 0}</Text>
                                    <TextInput
                                        value={quantite}
                                        onChangeText={setQuantite}
                                        placeholder="Quantité perdue"
                                        placeholderTextColor={"#aaaaaa"}
                                        keyboardType="numeric"
                                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                    />
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                        {CATEGORIES_PERTE.map((c) => (
                                            <TouchableOpacity
                                                key={c.value}
                                                onPress={() => setCategoriePerte(c.value)}
                                                style={{ backgroundColor: categoriePerte === c.value ? "#0f86e7" : "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2 }}
                                            >
                                                <Text style={{ fontSize: theme.size_one, color: categoriePerte === c.value ? "white" : "black" }}>{c.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TextInput
                                        value={motif}
                                        onChangeText={setMotif}
                                        placeholder="Motif (facultatif)"
                                        placeholderTextColor={"#aaaaaa"}
                                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                    />
                                    <TouchableOpacity
                                        onPress={handlePerte}
                                        disabled={isSubmitting}
                                        style={{ backgroundColor: "#e74c3c", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                                    >
                                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Valider</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {modalMode === "seuil" && (
                                <>
                                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Seuil d'alerte — {selectedProduit?.nom}</Text>
                                    <TextInput
                                        value={seuil}
                                        onChangeText={setSeuil}
                                        placeholder="Seuil (laisser vide pour désactiver)"
                                        placeholderTextColor={"#aaaaaa"}
                                        keyboardType="numeric"
                                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two }}
                                    />
                                    <TouchableOpacity
                                        onPress={handleSeuil}
                                        disabled={isSubmitting}
                                        style={{ backgroundColor: "#0f86e7", opacity: isSubmitting ? 0.5 : 1, borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding }}
                                    >
                                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Enregistrer</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>


            <Modal visible={listMode !== null} animationType="slide" onRequestClose={closeOperationList}>
                <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f5f5f5" }}>
                    <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.screenPadding }}>
                        <TouchableOpacity onPress={closeOperationList}>
                            <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>
                            {listMode === "reappro" ? "Réapprovisionnement" : "Enregistrer une perte"}
                        </Text>
                        <View style={{ width: 22 }} />
                    </View>
                    <ScrollView style={{ flex: 1 }}>
                        <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                            {categories.map((categorie) => {
                                const produits = (produitsQuery?.findBy("categorie_id", categorie.id) ?? []).slice().sort((a, b) => a.nom.localeCompare(b.nom));
                                if (produits.length === 0) return null;
                                return (
                                    <View key={categorie.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{categorie.nom}</Text>
                                        {produits.map((produit) => (
                                            <TouchableOpacity
                                                key={produit.id}
                                                onPress={() => listMode && openOperationSheet(produit, listMode)}
                                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: theme.touchTarget }}
                                            >
                                                <Text style={{ fontSize: theme.size_two }}>{produit.nom}</Text>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                    <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{produit.stock_actuel ?? 0}</Text>
                                                    <ChevronRight color="black" size={18} strokeWidth={1} />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            <Modal visible={categorieModalId !== null} transparent animationType="slide" onRequestClose={() => setCategorieModalId(null)}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setCategorieModalId(null)} />
                    <View style={{ height: "85%", backgroundColor: "white", borderTopLeftRadius: theme.internal_radius, borderTopRightRadius: theme.internal_radius, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.screenPadding, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" }}>
                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>
                                {categories.find((c) => c.id === categorieModalId)?.nom}
                            </Text>
                            <TouchableOpacity onPress={() => setCategorieModalId(null)}>
                                <X color="black" size={22} strokeWidth={1.5} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ flex: 1 }}>
                            <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.screenPadding * 3 }}>
                                {(produitsQuery?.findBy("categorie_id", categorieModalId ?? "") ?? [])
                                    .slice()
                                    .sort((a, b) => a.nom.localeCompare(b.nom))
                                    .map((produit, index) => {
                                        const stockActuel = produit.stock_actuel ?? 0;
                                        const stockBas = produit.seuil_alerte != null && stockActuel <= produit.seuil_alerte;

                                        if (index === 0) {
                                            return (
                                                <TouchableOpacity
                                                    key={produit.id}
                                                    onPress={() => openSeuilSheet(produit)}
                                                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: theme.internal_padding }}
                                                >
                                                    <Text style={{ fontSize: theme.size_two }}>{produit.nom}</Text>
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                        {stockBas && (
                                                            <View style={{ backgroundColor: "#fdecea", borderRadius: theme.internal_radius_2, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                                <Text style={{ fontSize: theme.size_one, color: "#e74c3c" }}>Stock bas</Text>
                                                            </View>
                                                        )}
                                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: stockBas ? "#e74c3c" : undefined }}>{stockActuel}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        }

                                        return (
                                            <TouchableOpacity
                                                key={produit.id}
                                                onPress={() => openSeuilSheet(produit)}
                                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#f5f5f5", paddingVertical: theme.internal_padding }}
                                            >
                                                <Text style={{ fontSize: theme.size_two }}>{produit.nom}</Text>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                    {stockBas && (
                                                        <View style={{ backgroundColor: "#fdecea", borderRadius: theme.internal_radius_2, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                            <Text style={{ fontSize: theme.size_one, color: "#e74c3c" }}>Stock bas</Text>
                                                        </View>
                                                    )}
                                                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: stockBas ? "#e74c3c" : undefined }}>{stockActuel}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
