import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { BottomSheet } from "@/components/bottom-sheet";
import { CommandesTimelineChart } from "@/components/CommandesTimelineChart";
import { Container } from "@/components/Container";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { MouvementCaisse, Produit } from "@/Database/db";
import { formaterMontant } from "@/lib/currency";
import { formaterDateRelative, formaterHeure } from "@/lib/date";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronRight, Lock, Minus, Pencil, Plus, ShoppingCart, Trash2, X } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

export default function SessionDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { sessionsCaisseQuery, sessionsStockQuery, mouvementsCaisseQuery, commandesQuery, lignesCommandeQuery, categoriesQuery, produitsQuery, ajouterMouvementCaisse, modifierMouvementCaisse, supprimerMouvementCaisse, fermerSessionCaisse, passerCommande, modifierCommande, supprimerCommande } = useDatabase();
    const { session: utilisateur } = useAuth();
    const { showError, confirm } = useAlert();

    const [montantFermeture, setMontantFermeture] = useState("");
    const [mouvement, setMouvement] = useState<{ type: MouvementCaisse["type"]; montant: string; motif: string }>({ type: "entree", montant: "", motif: "" });
    const [mouvementModalVisible, setMouvementModalVisible] = useState(false);
    const [mouvementEnEditionId, setMouvementEnEditionId] = useState<string | null>(null);
    const [mouvementActionCible, setMouvementActionCible] = useState<MouvementCaisse | null>(null);
    const [commandeModalVisible, setCommandeModalVisible] = useState(false);
    const [expandedCategorie, setExpandedCategorie] = useState<string | null>(null);
    const [expandedMouvementId, setExpandedMouvementId] = useState<string | null>(null);
    const [panier, setPanier] = useState<Record<string, number>>({});
    const [commandeActionMouvement, setCommandeActionMouvement] = useState<MouvementCaisse | null>(null);
    const [commandeEnEditionId, setCommandeEnEditionId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const session = sessionsCaisseQuery?.findById(id);
    const mouvements = (mouvementsCaisseQuery?.findBy("session_id", id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const entrees = mouvements.filter((m) => m.type === "entree").reduce((sum, m) => sum + m.montant, 0);
    const sorties = mouvements.filter((m) => m.type === "sortie").reduce((sum, m) => sum + m.montant, 0);
    const montantAttendu = session ? session.montant_ouverture + entrees - sorties : 0;

    const commandes = commandesQuery?.findBy("session_id", id) ?? [];

    // Session de stock du jour pour la même activité : fermer la caisse doit aussi
    // solder le stock, sinon les ventes continuent de courir sur un inventaire ouvert.
    const sessionStockOuverte = session
        ? (sessionsStockQuery?.findBy("type_activite", session.type_activite) ?? [])
            .filter((s) => s.statut === "ouverte")
            .sort((a, b) => b.date_ouverture.localeCompare(a.date_ouverture))[0] ?? null
        : null;

    const categoriesActivite = session ? (categoriesQuery?.findBy("type", session.type_activite) ?? []) : [];

    const closeCommandeModal = () => {
        setCommandeModalVisible(false);
        setPanier({});
        setExpandedCategorie(null);
        setCommandeEnEditionId(null);
    };

    const handlePasserCommande = async (lignes: { produit: Produit; quantite: number }[]) => {
        if (!session || !utilisateur || isSubmitting) return;
        if (lignes.length === 0) {
            showError("Ajoutez au moins un produit à la commande.");
            return;
        }
        setIsSubmitting(true);
        try {
            if (commandeEnEditionId) {
                await modifierCommande({ commande_id: commandeEnEditionId, lignes });
            } else {
                await passerCommande({ session_id: session.id, utilisateur_id: utilisateur.id, lignes });
            }
            closeCommandeModal();
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeCommandeActionModal = () => setCommandeActionMouvement(null);

    const handleModifierCommande = () => {
        if (!commandeActionMouvement?.commande_id) return;
        const lignes = lignesCommandeQuery?.findBy("commande_id", commandeActionMouvement.commande_id) ?? [];
        const panierInitial: Record<string, number> = {};
        lignes.forEach((l) => { panierInitial[l.produit_id] = l.quantite; });
        setPanier(panierInitial);
        setCommandeEnEditionId(commandeActionMouvement.commande_id);
        setCommandeActionMouvement(null);
        setCommandeModalVisible(true);
    };

    const handleSupprimerCommande = async () => {
        if (!commandeActionMouvement?.commande_id) return;
        const ok = await confirm("Supprimer cette commande ? Cette action est définitive.", { confirmLabel: "Supprimer" });
        if (!ok) return;
        await supprimerCommande(commandeActionMouvement.commande_id);
        setCommandeActionMouvement(null);
    };

    const closeMouvementModal = () => {
        setMouvementModalVisible(false);
        setMouvement({ type: "entree", montant: "", motif: "" });
        setMouvementEnEditionId(null);
    };

    const handleAjouterMouvement = async () => {
        if (isSubmitting) return;
        const montant = parseFloat(mouvement.montant);
        if (!session || !utilisateur || Number.isNaN(montant) || montant <= 0) {
            showError("Le montant doit être supérieur à 0.");
            return;
        }
        if (mouvement.type === "sortie" && !mouvement.motif.trim()) {
            showError("Le motif est requis pour une sortie.");
            return;
        }
        setIsSubmitting(true);
        try {
            if (mouvementEnEditionId) {
                await modifierMouvementCaisse({ id: mouvementEnEditionId, type: mouvement.type, montant, motif: mouvement.motif.trim() || undefined });
            } else {
                await ajouterMouvementCaisse({
                    session_id: session.id,
                    type: mouvement.type,
                    montant,
                    motif: mouvement.motif.trim() || undefined,
                    utilisateur_id: utilisateur.id,
                });
            }
            closeMouvementModal();
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeMouvementActionModal = () => setMouvementActionCible(null);

    const handleModifierMouvement = () => {
        if (!mouvementActionCible) return;
        setMouvement({ type: mouvementActionCible.type, montant: String(mouvementActionCible.montant), motif: mouvementActionCible.motif ?? "" });
        setMouvementEnEditionId(mouvementActionCible.id);
        setMouvementActionCible(null);
        setMouvementModalVisible(true);
    };

    const handleSupprimerMouvement = async () => {
        if (!mouvementActionCible) return;
        const ok = await confirm("Supprimer ce mouvement ? Cette action est définitive.", { confirmLabel: "Supprimer" });
        if (!ok) return;
        await supprimerMouvementCaisse(mouvementActionCible.id);
        setMouvementActionCible(null);
    };

    const handleFermer = async () => {
        if (isSubmitting) return;
        const montant = parseFloat(montantFermeture);
        if (!session || !utilisateur || Number.isNaN(montant) || montant < 0) {
            showError("Le montant compté doit être positif.");
            return;
        }
        const message = sessionStockOuverte
            ? "Fermer la caisse avec ce montant ? Vous enchaînerez sur l'inventaire de fermeture du stock. Cette action est définitive."
            : "Fermer la caisse avec ce montant ? Cette action est définitive.";
        const ok = await confirm(message, { confirmLabel: "Fermer" });
        if (!ok) return;
        setIsSubmitting(true);
        try {
            const ecart = montant - montantAttendu;
            await fermerSessionCaisse({ id: session.id, montant_fermeture: montant, ecart, utilisateur_fermeture_id: utilisateur.id });
            setMontantFermeture("");

            // La session de stock n'est jamais soldée automatiquement : sans recomptage
            // physique l'écart vaudrait 0 par construction, ce qui vide l'app de son
            // intérêt. On enchaîne donc sur l'inventaire, qui la fermera pour de bon.
            if (sessionStockOuverte) {
                router.push({ pathname: "/inventaire/[mode]", params: { mode: "fermeture", activite: session.type_activite } });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Stack.Screen options={{ title: "Détail de la session", headerShadowVisible: false, headerShown: true, headerTitleStyle: { fontSize: theme.size_three }, headerStyle: { backgroundColor: "#f5f5f5" } }} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                {/* <View style={{ height: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: theme.size_three }}>Détail de la session</Text>
                </View> */}

                {!session ? (
                    <View style={{ paddingHorizontal: theme.screenPadding }}>
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Session introuvable.</Text>
                    </View>
                ) : (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: theme.internal_padding }}>
                        <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                            <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: 4 }}>
                                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>
                                    {session.statut === "ouverte" ? "Session ouverte : " : "Ouverte "}{formaterDateRelative(session.date_ouverture)}
                                </Text>
                                <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>Ouverture : {formaterMontant(session.montant_ouverture)}</Text>
                                {session.statut === "ouverte" ? (
                                    <Text style={{ fontSize: theme.size_two, opacity: 0.7 }}>Montant attendu actuel : {formaterMontant(montantAttendu)}</Text>
                                ) : (
                                    <>
                                        <Text style={{ fontSize: theme.size_two }}>Fermeture : {formaterMontant(session.montant_fermeture ?? 0)}</Text>
                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold", color: (session.ecart ?? 0) === 0 ? "#0f86e7" : "#e74c3c" }}>
                                            Écart : {formaterMontant(session.ecart ?? 0)}
                                        </Text>
                                    </>
                                )}
                            </View>

                            {session.statut === "ouverte" && (
                                <TouchableOpacity
                                    onPress={() => setCommandeModalVisible(true)}
                                    style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.internal_padding_2 }}
                                >
                                    <ShoppingCart color="white" size={20} strokeWidth={1.5} />
                                    <Text style={{ fontSize: theme.size_two, color: "white", fontWeight: "bold" }}>Nouvelle commande</Text>
                                </TouchableOpacity>
                            )}

                            {session.statut === "ouverte" && (
                                <TouchableOpacity
                                    onPress={() => setMouvementModalVisible(true)}
                                    style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.internal_padding_2 }}
                                >
                                    <Plus color="#0f86e7" size={20} strokeWidth={1.5} />
                                    <Text style={{ fontSize: theme.size_two, color: "#0f86e7", fontWeight: "bold" }}>Ajouter un mouvement</Text>
                                </TouchableOpacity>
                            )}

                            {commandes.length > 0 && (
                                <CommandesTimelineChart commandes={commandes} debut={session.date_ouverture} fin={session.date_fermeture} />
                            )}

                            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Mouvements de caisse</Text>
                            <View style={{ gap: 8 }}>
                                {mouvements.length === 0 && (
                                    <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun mouvement enregistré.</Text>
                                )}
                                {mouvements.map((m) => {
                                    const estCommande = !!m.commande_id;
                                    const isExpanded = expandedMouvementId === m.id;
                                    const lignes = estCommande ? (lignesCommandeQuery?.findBy("commande_id", m.commande_id!) ?? []) : [];
                                    const interactif = estCommande || session.statut === "ouverte";
                                    const Wrapper = interactif ? TouchableOpacity : View;
                                    return (
                                        <View key={m.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, overflow: "hidden" }}>
                                            <Wrapper
                                                {...(interactif ? {
                                                    ...(estCommande ? { onPress: () => setExpandedMouvementId(isExpanded ? null : m.id) } : {}),
                                                    ...(session.statut === "ouverte" ? {
                                                        onLongPress: () => estCommande ? setCommandeActionMouvement(m) : setMouvementActionCible(m),
                                                    } : {}),
                                                } : {})}
                                                style={{ padding: theme.internal_padding, flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}
                                            >
                                                {m.type === "entree" ? <ArrowUpCircle color="#0f86e7" size={20} strokeWidth={1.5} /> : <ArrowDownCircle color="#e74c3c" size={20} strokeWidth={1.5} />}
                                                <View style={{ flex: 1, gap: 2 }}>
                                                    <Text style={{ fontSize: theme.size_two }}>{formaterMontant(m.montant)}</Text>
                                                    {m.motif && <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{m.motif}</Text>}
                                                </View>
                                                <Text style={{ fontSize: theme.size_one, opacity: 0.5 }}>{formaterHeure(m.date)}</Text>
                                                {estCommande && (
                                                    <>
                                                        {isExpanded ? (
                                                            <ChevronDown color="#0f86e7" size={20} strokeWidth={1} />
                                                        ) : (
                                                            <ChevronRight color="#0f86e7" size={20} strokeWidth={1} />
                                                        )}
                                                    </>
                                                )}
                                            </Wrapper>
                                            {estCommande && isExpanded && (
                                                <View style={{ paddingHorizontal: theme.internal_padding, paddingBottom: theme.internal_padding, gap: 6 }}>
                                                    {lignes.map((l) => (
                                                        <View key={l.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                                            <Text style={{ fontSize: theme.size_one }}>{l.quantite} × {l.produit_nom}</Text>
                                                            <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{formaterMontant(l.prix_unitaire * l.quantite)}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>

                            {session.statut === "ouverte" && (
                                <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding_2 }}>
                                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Fermer la caisse</Text>
                                    <TextInput
                                        value={montantFermeture}
                                        onChangeText={setMontantFermeture}
                                        placeholder="Montant réellement compté (XAF)"
                                        placeholderTextColor={"#aaaaaa"}
                                        keyboardType="numeric"
                                        style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                                    />
                                    <TouchableOpacity
                                        onPress={handleFermer}
                                        disabled={isSubmitting}
                                        style={{ backgroundColor: "#e74c3c", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, flexDirection: "row", gap: theme.internal_padding_2, opacity: isSubmitting ? 0.5 : 1 }}
                                    >
                                        <Lock color="white" size={18} strokeWidth={1.5} />
                                        <Text style={{ fontSize: theme.size_two, color: "white" }}>Fermer</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                )}
            </KeyboardAvoidingView>

            {/** Modal pour ajouter un mouvement */}
            <BottomSheet visible={mouvementModalVisible} onClose={closeMouvementModal}>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold", marginBottom: theme.internal_padding }}>
                    {mouvementEnEditionId ? "Modifier le mouvement" : "Ajouter un mouvement"}
                </Text>
                <View style={{ flexDirection: "row", gap: theme.internal_padding_2, marginBottom: theme.internal_padding_2 }}>
                    <TouchableOpacity
                        onPress={() => setMouvement((prev) => ({ ...prev, type: "entree" }))}
                        style={{ flex: 1, paddingVertical: theme.internal_padding_2, borderRadius: theme.internal_radius_2, alignItems: "center", backgroundColor: mouvement.type === "entree" ? "#eaf4fd" : "#f5f5f5" }}
                    >
                        <Text style={{ fontSize: theme.size_one, color: mouvement.type === "entree" ? "#0f86e7" : "black" }}>Entrée</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setMouvement((prev) => ({ ...prev, type: "sortie" }))}
                        style={{ flex: 1, paddingVertical: theme.internal_padding_2, borderRadius: theme.internal_radius_2, alignItems: "center", backgroundColor: mouvement.type === "sortie" ? "#fdeceb" : "#f5f5f5" }}
                    >
                        <Text style={{ fontSize: theme.size_one, color: mouvement.type === "sortie" ? "#e74c3c" : "black" }}>Sortie</Text>
                    </TouchableOpacity>
                </View>
                <TextInput
                    value={mouvement.montant}
                    onChangeText={(montant) => setMouvement((prev) => ({ ...prev, montant }))}
                    placeholder="Montant"
                    placeholderTextColor={"#aaaaaa"}
                    keyboardType="numeric"
                    style={{ marginBottom: theme.internal_padding_2, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                />
                <TextInput
                    value={mouvement.motif}
                    onChangeText={(motif) => setMouvement((prev) => ({ ...prev, motif }))}
                    placeholder={mouvement.type === "sortie" ? "Motif (obligatoire)" : "Motif (facultatif)"}
                    placeholderTextColor={"#aaaaaa"}
                    style={{ marginBottom: theme.internal_padding_2, backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                />
                <TouchableOpacity
                    onPress={handleAjouterMouvement}
                    disabled={isSubmitting}
                    style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: isSubmitting ? 0.5 : 1 }}
                >
                    <Text style={{ fontSize: theme.size_two, color: "white" }}>{mouvementEnEditionId ? "Enregistrer" : "Ajouter"}</Text>
                </TouchableOpacity>
            </BottomSheet>

            {/** Modal pour passer une commande */}
            <CommandeModal
                visible={commandeModalVisible}
                enEdition={!!commandeEnEditionId}
                panierInitial={panier}
                categories={categoriesActivite}
                produitsQuery={produitsQuery!}
                isSubmitting={isSubmitting}
                onClose={closeCommandeModal}
                onSubmit={handlePasserCommande}
            />
            {/** Modal d'actions sur une commande (modifier / supprimer) */}
            <BottomSheet visible={!!commandeActionMouvement} onClose={closeCommandeActionModal}>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{formaterMontant(commandeActionMouvement?.montant ?? 0)}</Text>
                {commandeActionMouvement?.motif && (
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6, paddingBottom: theme.internal_padding }}>{commandeActionMouvement.motif}</Text>
                )}
                <View>
                    <TouchableOpacity
                        onPress={handleModifierCommande}
                        style={{ alignItems: "center", justifyContent: "flex-start", flexDirection: "row", gap: theme.internal_padding, paddingVertical: theme.internal_padding }}
                    >
                        <Pencil size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleSupprimerCommande}
                        style={{ alignItems: "center", justifyContent: "flex-start", paddingVertical: theme.internal_padding, flexDirection: "row", gap: theme.internal_padding }}
                    >
                        <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, color: "#e74c3c", fontWeight: "bold" }}>Supprimer</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheet>

            {/** Modal d'actions sur un mouvement de caisse simple (modifier / supprimer) */}
            <BottomSheet visible={!!mouvementActionCible} onClose={closeMouvementActionModal}>
                <View style={{ marginBottom: theme.internal_padding }}>
                    <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{formaterMontant(mouvementActionCible?.montant ?? 0)}</Text>
                    {mouvementActionCible?.motif && (
                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{mouvementActionCible.motif}</Text>
                    )}
                </View>
                <View>
                    <TouchableOpacity
                        onPress={handleModifierMouvement}
                        style={{ borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "flex-start", flexDirection: "row", gap: theme.internal_padding, paddingVertical: theme.internal_padding }}
                    >
                        <Pencil size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleSupprimerMouvement}
                        style={{ borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "flex-start", paddingVertical: theme.internal_padding, flexDirection: "row", gap: theme.internal_padding }}
                    >
                        <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                        <Text style={{ fontSize: theme.size_two, color: "#e74c3c", fontWeight: "bold" }}>Supprimer</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheet>
        </View>
    );
}



// ---------------------------------------------------------------------------
// Modale de commande isolée : le panier vit ICI. Chaque appui sur +/− ne
// re-rend donc que la modale, plus jamais l'écran de session derrière
// (liste des mouvements, graphique de timeline, bottom sheets...).
// ---------------------------------------------------------------------------
const CommandeModal = memo(function CommandeModal({
    visible,
    enEdition,
    panierInitial,
    categories,
    produitsQuery,
    isSubmitting,
    onClose,
    onSubmit,
}: {
    visible: boolean;
    enEdition: boolean;
    panierInitial: Record<string, number> | null;
    categories: CategorieLite[];
    produitsQuery: ProduitsQuery;
    isSubmitting: boolean;
    onClose: () => void;
    onSubmit: (lignes: LigneCommande[]) => void;
}) {
    const [panier, setPanier] = useState<Record<string, number>>({});

    // Réinitialise le panier à chaque ouverture (vide pour une nouvelle
    // commande, pré-rempli en mode modification).
    useEffect(() => {
        if (visible) setPanier(panierInitial ?? {});
    }, [visible, panierInitial]);

    // Catalogue trié UNE fois par changement de données, plus à chaque appui.
    // Avant : findBy + slice + sort(localeCompare) pour chaque catégorie à
    // chaque rendu — c'était la cause principale de la lenteur.
    const catalogue = useMemo(
        () =>
            categories.map((categorie) => ({
                categorie,
                produits: (produitsQuery?.findBy("categorie_id", categorie.id) ?? [])
                    .slice()
                    .sort((a, b) => comparerNoms(a.nom, b.nom)),
            })),
        [categories, produitsQuery]
    );

    // Accès O(1) aux produits au lieu de findById répété dans les boucles.
    const produitsById = useMemo(() => {
        const map = new Map<string, Produit>();
        catalogue.forEach(({ produits }) => produits.forEach((p) => map.set(p.id, p)));
        return map;
    }, [catalogue]);

    const getProduit = useCallback(
        (produitId: string) => produitsById.get(produitId) ?? produitsQuery?.findById(produitId) ?? null,
        [produitsById, produitsQuery]
    );

    // Callback stable : indispensable pour que memo(ProduitRow) fonctionne.
    const changerQuantite = useCallback((produitId: string, delta: number) => {
        setPanier((prev) => {
            const quantite = (prev[produitId] ?? 0) + delta;
            if (quantite <= 0) {
                const { [produitId]: _omit, ...rest } = prev;
                return rest;
            }
            return { ...prev, [produitId]: quantite };
        });
    }, []);

    // Total, nombre d'articles et badges par catégorie calculés en un seul
    // passage sur le panier (au lieu de trois parcours séparés par rendu).
    const { totalPanier, nombreArticlesPanier, comptesParCategorie } = useMemo(() => {
        let total = 0;
        let nombre = 0;
        const comptes: Record<string, number> = {};
        Object.entries(panier).forEach(([produitId, quantite]) => {
            const produit = getProduit(produitId);
            if (!produit) return;
            total += produit.prix * quantite;
            nombre += quantite;
            comptes[produit.categorie_id] = (comptes[produit.categorie_id] ?? 0) + quantite;
        });
        return { totalPanier: total, nombreArticlesPanier: nombre, comptesParCategorie: comptes };
    }, [panier, getProduit]);

    const handleSubmit = useCallback(() => {
        const lignes = Object.entries(panier)
            .map(([produitId, quantite]) => {
                const produit = getProduit(produitId);
                return produit ? { produit, quantite } : null;
            })
            .filter((l): l is LigneCommande => l !== null);
        onSubmit(lignes);
    }, [panier, getProduit, onSubmit]);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={{ height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{enEdition ? "Modifier la commande" : "Nouvelle commande"}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <X size={20} color={"#0f86e7"} />
                    </TouchableOpacity>
                </View>

                <Container style={{ paddingBottom: theme.internal_padding }}>
                    <View style={{ gap: 3, borderRadius: theme.internal_radius, overflow: "hidden" }}>
                        {nombreArticlesPanier === 0 ? (
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun produit sélectionné.</Text>
                        ) : (
                            Object.entries(panier).map(([produitId, quantite]) => {
                                const produit = getProduit(produitId);
                                if (!produit || quantite <= 0) return null;
                                return (
                                    <View key={produitId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2 }}>
                                        <Text style={{ fontSize: theme.size_two }}>{quantite} × {produit.nom}</Text>
                                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{formaterMontant(produit.prix * quantite)}</Text>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </Container>

                <ScrollView style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: 8, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        {catalogue.length === 0 && (
                            <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun produit configuré pour cette activité.</Text>
                        )}
                        {catalogue.map(({ categorie, produits }) => {
                            const nbArticles = comptesParCategorie[categorie.id] ?? 0;
                            return (
                                <View key={categorie.id} style={{ backgroundColor: "white" }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{categorie.nom}</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                                            {nbArticles > 0 && (
                                                <Text style={{ fontSize: theme.size_one, color: "white", backgroundColor: "#0f86e7", borderRadius: 12, overflow: "hidden", height: 24, textAlign: "center", aspectRatio: 1, textAlignVertical: 'center', paddingHorizontal: 6, fontWeight: "bold" }}>
                                                    {nbArticles}
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    <View style={{ marginTop: theme.internal_padding_2, gap: 3 }}>
                                        {produits.map((produit) => (
                                            <ProduitRow
                                                key={produit.id}
                                                produit={produit}
                                                qte={panier[produit.id] ?? 0}
                                                onChange={changerQuantite}
                                            />
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>

                <View style={{ paddingHorizontal: theme.screenPadding, paddingVertical: theme.internal_padding, gap: theme.internal_padding_2, borderTopWidth: 1, borderTopColor: "#e0e0e0", width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: theme.size_two, opacity: 0.6 }}>{nombreArticlesPanier} article{nombreArticlesPanier > 1 ? "s" : ""}</Text>
                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{formaterMontant(totalPanier)}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={nombreArticlesPanier === 0 || isSubmitting}
                        style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: (nombreArticlesPanier === 0 || isSubmitting) ? 0.5 : 1 }}
                    >
                        <Text style={{ fontSize: theme.size_two, color: "white" }}>{enEdition ? "Enregistrer les modifications" : "Valider la commande"}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
});


// ---------------------------------------------------------------------------
// Tri des noms : un Collator réutilisé est nettement plus rapide que
// String.localeCompare appelé en boucle à chaque rendu (surtout sur Hermes).
// ---------------------------------------------------------------------------
const collator = typeof Intl !== "undefined" && typeof Intl.Collator === "function"
    ? new Intl.Collator("fr", { sensitivity: "base" })
    : null;
const comparerNoms = (a: string, b: string) => (collator ? collator.compare(a, b) : a.localeCompare(b));

type LigneCommande = { produit: Produit; quantite: number };
type CategorieLite = { id: string; nom: string };
type ProduitsQuery = ReturnType<typeof useDatabase>["produitsQuery"];

// ---------------------------------------------------------------------------
// Ligne produit mémoïsée : un appui sur +/− ne re-rend que la ligne dont la
// quantité change, plus jamais l'ensemble du catalogue.
// ---------------------------------------------------------------------------
const ProduitRow = memo(function ProduitRow({
    produit,
    qte,
    onChange,
}: {
    produit: Produit;
    qte: number;
    onChange: (produitId: string, delta: number) => void;
}) {
    // Rupture : on bloque l'ajout, mais pas la réduction — une commande
    // en cours de modification doit pouvoir retirer un article déjà pris.
    const enRupture = (produit.stock_actuel ?? 0) <= 0;
    return (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: theme.internal_padding_2, opacity: enRupture && qte === 0 ? 0.4 : 1 }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: theme.size_two }}>{produit.nom}</Text>
                <Text style={{ fontSize: theme.size_one, color: "#777" }}>
                    {enRupture ? "Rupture de stock" : formaterMontant(produit.prix)}
                </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity onPress={() => onChange(produit.id, -1)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" }}>
                    <Minus size={16} color="#000" />
                </TouchableOpacity>
                <Text style={{ fontSize: theme.size_two, minWidth: 18, textAlign: "center" }}>{qte}</Text>
                <TouchableOpacity
                    onPress={() => onChange(produit.id, 1)}
                    disabled={enRupture}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center", opacity: enRupture ? 0.4 : 1 }}
                >
                    <Plus size={16} color="#000" />
                </TouchableOpacity>
            </View>
        </View>
    );
});