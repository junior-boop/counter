import { Fragment, useState } from "react";
import { LayoutChangeEvent, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import theme from "../constants/constant-style";
import { Commande } from "../Database/db";
import { formaterMontant } from "../lib/currency";
import { Text } from "./text";

const PAS_MINUTES = 10;
const PAS_MS = PAS_MINUTES * 60 * 1000;
/** 24 h de créneaux : borne de sécurité pour une session restée ouverte des jours. */
const MAX_CRENEAUX = (24 * 60) / PAS_MINUTES;

const GOUTTIERE = 26;
const HAUTEUR_CHART = 110;
const HAUTEUR_LABELS = 16;
const HAUTEUR_TOTAL = HAUTEUR_CHART + HAUTEUR_LABELS;
const PAS_MIN = 8;
const ECART_BARRES = 2;
const TAILLE_LABEL = 11;

const COULEUR_BARRE = "#0f86e7";
const COULEUR_AXE = "#e5e7eb";
const COULEUR_VIDE = "#e5e7eb";

const STYLE_DISCRET = { fontSize: theme.size_one, opacity: 0.6 };

type Creneau = { debutMs: number; nombre: number; montant: number };

export function CommandesTimelineChart({ commandes, debut, fin }: { commandes: Commande[]; debut: string; fin?: string | null }) {
    const [largeur, setLargeur] = useState(0);
    const [selection, setSelection] = useState<number | null>(null);

    const debutAligne = Math.floor(new Date(debut).getTime() / PAS_MS) * PAS_MS;
    const finBrute = fin ? new Date(fin).getTime() : Date.now();
    const finAlignee = Math.max(debutAligne + PAS_MS, Math.ceil(finBrute / PAS_MS) * PAS_MS);

    const creneauxTotal = Math.round((finAlignee - debutAligne) / PAS_MS);
    const tronque = creneauxTotal > MAX_CRENEAUX;
    const nbCreneaux = tronque ? MAX_CRENEAUX : creneauxTotal;
    const premierCreneau = tronque ? finAlignee - MAX_CRENEAUX * PAS_MS : debutAligne;

    const creneaux: Creneau[] = Array.from({ length: nbCreneaux }, (_, index) => ({
        debutMs: premierCreneau + index * PAS_MS,
        nombre: 0,
        montant: 0,
    }));

    for (const commande of commandes) {
        const index = Math.floor((new Date(commande.date).getTime() - premierCreneau) / PAS_MS);
        if (index < 0 || index >= nbCreneaux) continue;
        creneaux[index].nombre += 1;
        creneaux[index].montant += commande.montant_total;
    }

    const total = creneaux.reduce((somme, c) => somme + c.nombre, 0);
    const pic = creneaux.reduce((meilleur, c) => (c.nombre > meilleur.nombre ? c : meilleur), creneaux[0]);

    const max = Math.max(1, ...creneaux.map((c) => c.nombre));
    const echelle = (valeur: number) => (valeur / max) * (HAUTEUR_CHART - 8);
    const graduations = max >= 2 ? [0, Math.round(max / 2), max] : [0, max];

    const largeurTrace = Math.max(Math.max(0, largeur - GOUTTIERE), nbCreneaux * PAS_MIN);
    const pas = largeurTrace / nbCreneaux;
    const largeurBarre = Math.max(3, pas - ECART_BARRES);

    const creneauSelectionne = selection !== null ? creneaux[selection] ?? null : null;

    function onLayout(e: LayoutChangeEvent) {
        setLargeur(e.nativeEvent.layout.width);
    }

    return (
        <Animated.View
            layout={LinearTransition.duration(220)}
            style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}
        >
            <View style={{ gap: 2 }}>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Rythme des commandes</Text>
                {total > 0 ? (
                    <Text style={STYLE_DISCRET}>
                        {total} commande{total > 1 ? "s" : ""} · pic de {pic.nombre} à {formaterCreneau(pic.debutMs)}
                    </Text>
                ) : (
                    <Text style={STYLE_DISCRET}>Aucune commande enregistrée sur cette session.</Text>
                )}
                <Text style={STYLE_DISCRET}>
                    Par tranche de {PAS_MINUTES} minutes{tronque ? " · limité aux 24 dernières heures" : ""}
                </Text>
            </View>

            <View onLayout={onLayout} style={{ width: "100%", flexDirection: "row" }}>
                {largeur > 0 && (
                    <Fragment>
                        <Svg width={GOUTTIERE} height={HAUTEUR_TOTAL}>
                            {graduations.map((valeur) => (
                                <SvgText
                                    key={valeur}
                                    x={GOUTTIERE - 4}
                                    y={HAUTEUR_CHART - echelle(valeur) + 3}
                                    fontSize={TAILLE_LABEL}
                                    fill="#000"
                                    opacity={0.45}
                                    textAnchor="end"
                                >
                                    {valeur}
                                </SvgText>
                            ))}
                        </Svg>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Svg width={largeurTrace} height={HAUTEUR_TOTAL}>
                                {graduations.map((valeur) => {
                                    const y = HAUTEUR_CHART - echelle(valeur);
                                    return <Line key={valeur} x1={0} y1={y} x2={largeurTrace} y2={y} stroke={COULEUR_AXE} strokeWidth={1} />;
                                })}

                                {creneaux.map((creneau, index) => {
                                    const x = index * pas;
                                    const hauteur = echelle(creneau.nombre);
                                    const heure = new Date(creneau.debutMs);
                                    const estDebutHeure = heure.getMinutes() === 0;

                                    return (
                                        <Fragment key={creneau.debutMs}>
                                            {selection === index && (
                                                <Rect x={x} y={0} width={pas} height={HAUTEUR_CHART} fill={COULEUR_BARRE} opacity={0.1} rx={2} />
                                            )}

                                            {creneau.nombre > 0 ? (
                                                <Rect
                                                    x={x + ECART_BARRES / 2}
                                                    y={HAUTEUR_CHART - hauteur}
                                                    width={largeurBarre}
                                                    height={hauteur}
                                                    rx={1.5}
                                                    fill={COULEUR_BARRE}
                                                />
                                            ) : (
                                                <Rect x={x + ECART_BARRES / 2} y={HAUTEUR_CHART - 2} width={largeurBarre} height={2} fill={COULEUR_VIDE} />
                                            )}

                                            {estDebutHeure && (
                                                <SvgText x={x} y={HAUTEUR_TOTAL - 3} fontSize={TAILLE_LABEL} fill="#000" opacity={0.5} textAnchor="start">
                                                    {heure.getHours()}h
                                                </SvgText>
                                            )}

                                            <Rect
                                                x={x}
                                                y={0}
                                                width={pas}
                                                height={HAUTEUR_TOTAL}
                                                fill="transparent"
                                                onPress={() => setSelection((precedent) => (precedent === index ? null : index))}
                                            />
                                        </Fragment>
                                    );
                                })}
                            </Svg>
                        </ScrollView>
                    </Fragment>
                )}
            </View>

            {creneauSelectionne && (
                <Animated.View
                    entering={FadeIn.duration(180)}
                    exiting={FadeOut.duration(120)}
                    layout={LinearTransition.duration(220)}
                    style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, gap: 2 }}
                >
                    <Text style={{ fontSize: theme.size_one, fontWeight: "bold" }}>
                        {formaterCreneau(creneauSelectionne.debutMs)} – {formaterCreneau(creneauSelectionne.debutMs + PAS_MS)}
                    </Text>
                    {creneauSelectionne.nombre > 0 ? (
                        <Text style={STYLE_DISCRET}>
                            {creneauSelectionne.nombre} commande{creneauSelectionne.nombre > 1 ? "s" : ""} · {formaterMontant(creneauSelectionne.montant)}
                        </Text>
                    ) : (
                        <Text style={STYLE_DISCRET}>Aucune commande sur ce créneau.</Text>
                    )}
                </Animated.View>
            )}
        </Animated.View>
    );
}

function formaterCreneau(ms: number): string {
    const date = new Date(ms);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

