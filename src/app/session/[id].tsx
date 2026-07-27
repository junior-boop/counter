import { useAuth } from "@/Auth/auth.context";
import { useAlert } from "@/components/alert/alert.context";
import { CommandesTimelineChart } from "@/components/CommandesTimelineChart";
import { Text } from "@/components/text";
import { useDatabase } from "@/Database/database.context";
import { MouvementCaisse, Produit } from "@/Database/db";
import { formaterMontant } from "@/lib/currency";
import { formaterDateRelative, formaterHeure } from "@/lib/date";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, ChevronDown, ChevronRight, Lock, Minus, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

export default function SessionDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { etablissement, sessionsCaisseQuery, sessionsStockQuery, mouvementsCaisseQuery, commandesQuery, lignesCommandeQuery, categoriesQuery, produitsQuery, ajouterMouvementCaisse, fermerSessionCaisse, passerCommande, modifierCommande, supprimerCommande } = useDatabase();
    const { session: utilisateur } = useAuth();
    const { showError, confirm } = useAlert();

    const [montantFermeture, setMontantFermeture] = useState("");
    const [mouvement, setMouvement] = useState<{ type: MouvementCaisse["type"]; montant: string; motif: string }>({ type: "entree", montant: "", motif: "" });
    const [mouvementModalVisible, setMouvementModalVisible] = useState(false);
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

    const totalPanier = Object.entries(panier).reduce((sum, [produitId, quantite]) => {
        const produit = produitsQuery?.findById(produitId);
        return sum + (produit ? produit.prix * quantite : 0);
    }, 0);

    const nombreArticlesPanier = Object.values(panier).reduce((sum, q) => sum + q, 0);

    const changerQuantite = (produitId: string, delta: number) => {
        setPanier((prev) => {
            const quantite = (prev[produitId] ?? 0) + delta;
            if (quantite <= 0) {
                const { [produitId]: _omit, ...rest } = prev;
                return rest;
            }
            return { ...prev, [produitId]: quantite };
        });
    };

    const closeCommandeModal = () => {
        setCommandeModalVisible(false);
        setPanier({});
        setExpandedCategorie(null);
        setCommandeEnEditionId(null);
    };

    const handlePasserCommande = async () => {
        if (!session || !utilisateur || isSubmitting) return;
        const lignes = Object.entries(panier)
            .map(([produitId, quantite]) => {
                const produit = produitsQuery?.findById(produitId);
                return produit ? { produit, quantite } : null;
            })
            .filter((l): l is { produit: Produit; quantite: number } => l !== null);
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
            await ajouterMouvementCaisse({
                session_id: session.id,
                type: mouvement.type,
                montant,
                motif: mouvement.motif.trim() || undefined,
                utilisateur_id: utilisateur.id,
            });
            setMouvement({ type: "entree", montant: "", motif: "" });
            setMouvementModalVisible(false);
        } finally {
            setIsSubmitting(false);
        }
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
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={{ height: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding, gap: theme.internal_padding_2 }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft color="black" size={22} strokeWidth={1.5} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: theme.size_three }}>Détail de la session</Text>
                </View>

                {!session ? (
                    <View style={{ paddingHorizontal: theme.screenPadding }}>
                        <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Session introuvable.</Text>
                    </View>
                ) : (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: theme.internal_padding }}>
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

                            {session.statut === "ouverte" && etablissement?.commande_temps_reel_active && (
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
                                    const Wrapper = estCommande ? TouchableOpacity : View;
                                    return (
                                        <View key={m.id} style={{ backgroundColor: "white", borderRadius: theme.internal_radius, overflow: "hidden" }}>
                                            <Wrapper
                                                {...(estCommande ? {
                                                    onPress: () => setExpandedMouvementId(isExpanded ? null : m.id),
                                                    ...(session.statut === "ouverte" ? { onLongPress: () => setCommandeActionMouvement(m) } : {}),
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
            <Modal visible={mouvementModalVisible} transparent animationType="slide" onRequestClose={closeMouvementModal}>
                <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior="padding">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={closeMouvementModal}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
                    />
                    <View style={{ backgroundColor: "white", padding: theme.screenPadding, gap: theme.internal_padding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Ajouter un mouvement</Text>
                        <View style={{ flexDirection: "row", gap: theme.internal_padding_2 }}>
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
                            style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                        />
                        <TextInput
                            value={mouvement.motif}
                            onChangeText={(motif) => setMouvement((prev) => ({ ...prev, motif }))}
                            placeholder={mouvement.type === "sortie" ? "Motif (obligatoire)" : "Motif (facultatif)"}
                            placeholderTextColor={"#aaaaaa"}
                            style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, paddingHorizontal: theme.internal_padding, paddingVertical: theme.internal_padding_2, fontSize: theme.size_two, color: "black" }}
                        />
                        <TouchableOpacity
                            onPress={handleAjouterMouvement}
                            disabled={isSubmitting}
                            style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: isSubmitting ? 0.5 : 1 }}
                        >
                            <Text style={{ fontSize: theme.size_two, color: "white" }}>Ajouter</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/** Modal pour passer une commande */}
            <Modal visible={commandeModalVisible} animationType="slide" onRequestClose={closeCommandeModal}>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={{ height: theme.headerHeight, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.screenPadding }}>
                        <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{commandeEnEditionId ? "Modifier la commande" : "Nouvelle commande"}</Text>
                        <TouchableOpacity onPress={closeCommandeModal}>
                            <Text style={{ fontSize: theme.size_two, color: "#0f86e7" }}>Fermer</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        <View style={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.internal_padding, gap: 8, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                            {categoriesActivite.length === 0 && (
                                <Text style={{ fontSize: theme.size_two, opacity: 0.5 }}>Aucun produit configuré pour cette activité.</Text>
                            )}
                            {categoriesActivite.map((categorie) => {
                                const isExpanded = expandedCategorie === categorie.id;
                                const produits = (produitsQuery?.findBy("categorie_id", categorie.id) ?? [])
                                    .slice()
                                    .sort((a, b) => a.nom.localeCompare(b.nom));
                                return (
                                    <View key={categorie.id} style={{ backgroundColor: "white" }}>
                                        <TouchableOpacity
                                            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                                            onPress={() => setExpandedCategorie(isExpanded ? null : categorie.id)}
                                        >
                                            <Text style={{ fontSize: theme.size_three, fontWeight: "bold" }}>{categorie.nom}</Text>
                                            <ChevronRight color="black" size={20} strokeWidth={1} style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }} />
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={{ marginTop: theme.internal_padding, gap: 8 }}>
                                                {produits.map((produit) => {
                                                    const quantite = panier[produit.id] ?? 0;
                                                    return (
                                                        <View key={produit.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: theme.touchTarget }}>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontSize: theme.size_two }}>{produit.nom}</Text>
                                                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{formaterMontant(produit.prix)}</Text>
                                                            </View>
                                                            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.internal_padding_2 }}>
                                                                <TouchableOpacity
                                                                    onPress={() => changerQuantite(produit.id, -1)}
                                                                    disabled={quantite === 0}
                                                                    style={{ width: 28, height: 28, borderRadius: theme.internal_radius_2, backgroundColor: "#f1f1f1", alignItems: "center", justifyContent: "center", opacity: quantite === 0 ? 0.4 : 1 }}
                                                                >
                                                                    <Minus color="black" size={16} strokeWidth={2} />
                                                                </TouchableOpacity>
                                                                <Text style={{ fontSize: theme.size_two, minWidth: 20, textAlign: "center" }}>{quantite}</Text>
                                                                <TouchableOpacity
                                                                    onPress={() => changerQuantite(produit.id, 1)}
                                                                    style={{ width: 28, height: 28, borderRadius: theme.internal_radius_2, backgroundColor: "#eaf4fd", alignItems: "center", justifyContent: "center" }}
                                                                >
                                                                    <Plus color="#0f86e7" size={16} strokeWidth={2} />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        )}
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
                            onPress={handlePasserCommande}
                            disabled={nombreArticlesPanier === 0 || isSubmitting}
                            style={{ backgroundColor: "#0f86e7", borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "center", paddingVertical: theme.internal_padding, opacity: (nombreArticlesPanier === 0 || isSubmitting) ? 0.5 : 1 }}
                        >
                            <Text style={{ fontSize: theme.size_two, color: "white" }}>{commandeEnEditionId ? "Enregistrer les modifications" : "Valider la commande"}</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/** Modal d'actions sur une commande (modifier / supprimer) */}
            <Modal visible={!!commandeActionMouvement} transparent animationType="slide" onRequestClose={closeCommandeActionModal}>
                <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior="padding">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={closeCommandeActionModal}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
                    />
                    <View style={{ backgroundColor: "white", padding: theme.screenPadding, width: "100%", maxWidth: theme.contentMaxWidth, alignSelf: "center" }}>
                        <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>{formaterMontant(commandeActionMouvement?.montant ?? 0)}</Text>
                        {commandeActionMouvement?.motif && (
                            <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{commandeActionMouvement.motif}</Text>
                        )}
                        <View style={{ marginTop: theme.internal_padding }}>
                            <TouchableOpacity
                                onPress={handleModifierCommande}
                                style={{ borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "flex-start", flexDirection: "row", gap: theme.internal_padding, paddingVertical: theme.internal_padding }}
                            >
                                <Pencil size={18} strokeWidth={1.5} />
                                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Modifier</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSupprimerCommande}
                                style={{ borderRadius: theme.internal_radius_2, alignItems: "center", justifyContent: "flex-start", paddingVertical: theme.internal_padding, flexDirection: "row", gap: theme.internal_padding }}
                            >
                                <Trash2 color="#e74c3c" size={18} strokeWidth={1.5} />
                                <Text style={{ fontSize: theme.size_two, color: "#e74c3c", fontWeight: "bold" }}>Supprimer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
