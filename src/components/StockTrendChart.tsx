import { Fragment, useEffect, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedProps,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import theme from "../constants/constant-style";
import { Text } from "./text";

export type StockTrendPoint = {
    /** Jour ISO (yyyy-mm-dd), sert de clé stable. */
    jour: string;
    /** Libellé court affiché sous la barre ("12/07"). */
    label: string;
    aSession: boolean;
    cloture: boolean;
    /** Unités comptées à l'ouverture de l'inventaire. */
    ouverture: number;
    /** Unités entrées en réapprovisionnement. */
    reappro: number;
    /** Unités déclarées perdues (casse, péremption, offert). */
    pertes: number;
    /** Unités comptées à la fermeture. */
    restant: number;
    /** ouverture + réappro */
    disponible: number;
    /** disponible - restant, seulement une fois l'inventaire fermé. */
    sorti: number;
};

const GOUTTIERE = 34;
const HAUTEUR_CHART = 130;
const HAUTEUR_LABELS = 18;
const HAUTEUR_TOTAL = HAUTEUR_CHART + HAUTEUR_LABELS;
const LARGEUR_BARRE_MAX = 16;
const ECART_SEGMENTS = 2;
const ECART_BARRES = 3;
const TAILLE_LABEL_DATE = 11;

const DUREE_CROISSANCE = 420;
const DUREE_SELECTION = 160;
const DECALAGE_PAR_BARRE = 45;

const COULEUR_OUVERTURE = "#0f86e7";
const COULEUR_REAPPRO = "#7cc4f5";
const COULEUR_RESTANT = "#16a34a";
const COULEUR_AXE = "#e5e7eb";
const COULEUR_ATTENTE = "#cbd5e1";

const FORMATEUR_UNITES = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function formaterUnites(valeur: number): string {
    return FORMATEUR_UNITES.format(valeur);
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function StockTrendChart({ data }: { data: StockTrendPoint[] }) {
    const [largeur, setLargeur] = useState(0);
    const [jourSelectionne, setJourSelectionne] = useState<string | null>(null);

    if (data.length === 0) return null;

    const joursClotures = data.filter((d) => d.cloture);
    const joursSansInventaire = data.filter((d) => !d.aSession).length;
    const sortiPeriode = joursClotures.reduce((somme, d) => somme + d.sorti, 0);

    const max = Math.max(1, ...data.map((d) => Math.max(d.disponible, d.restant)));
    const echelle = (valeur: number) => (Math.max(0, valeur) / max) * (HAUTEUR_CHART - 8);

    const largeurTrace = Math.max(0, largeur - GOUTTIERE);
    const largeurGroupe = largeurTrace / data.length;
    const largeurBarre = Math.max(3, Math.min(LARGEUR_BARRE_MAX, (largeurGroupe - 8 - ECART_BARRES) / 2));

    const selection = data.find((d) => d.jour === jourSelectionne) ?? null;
    const graduations = [0, 0.5, 1];

    function onLayout(e: LayoutChangeEvent) {
        setLargeur(e.nativeEvent.layout.width);
    }

    return (
        <Animated.View
            layout={LinearTransition.duration(220)}
            style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}
        >
            <View style={{ gap: 2 }}>
                <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Mouvements de stock</Text>
                {joursClotures.length > 0 ? (
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                        {formaterUnites(sortiPeriode)} unité{sortiPeriode > 1 ? "s" : ""} sorties sur {joursClotures.length} journée
                        {joursClotures.length > 1 ? "s" : ""} comptée{joursClotures.length > 1 ? "s" : ""}
                    </Text>
                ) : (
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Fermez un inventaire pour voir le stock restant.</Text>
                )}
                {joursSansInventaire > 0 && (
                    <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>
                        {joursSansInventaire} jour{joursSansInventaire > 1 ? "s" : ""} sans inventaire sur {data.length}
                    </Text>
                )}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.internal_padding }}>
                {[
                    { label: "Ouverture", couleur: COULEUR_OUVERTURE },
                    { label: "Réapprovisionné", couleur: COULEUR_REAPPRO },
                    { label: "Restant", couleur: COULEUR_RESTANT },
                    { label: "Non compté", couleur: COULEUR_ATTENTE },
                ].map((legende) => (
                    <View key={legende.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: legende.couleur }} />
                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{legende.label}</Text>
                    </View>
                ))}
            </View>

            <View onLayout={onLayout} style={{ width: "100%", height: HAUTEUR_TOTAL }}>
                {largeur > 0 && (
                    <Svg width={largeur} height={HAUTEUR_TOTAL}>
                        {graduations.map((ratio) => {
                            const y = HAUTEUR_CHART - ratio * (HAUTEUR_CHART - 8);
                            return (
                                <Fragment key={ratio}>
                                    <Line x1={GOUTTIERE} y1={y} x2={largeur} y2={y} stroke={COULEUR_AXE} strokeWidth={1} />
                                    <SvgText x={GOUTTIERE - 6} y={y + 3} fontSize={theme.size_one - 2} fill="#000" opacity={0.45} textAnchor="end">
                                        {formaterUnites(max * ratio)}
                                    </SvgText>
                                </Fragment>
                            );
                        })}

                        {data.map((point, index) => (
                            <BarreJour
                                key={point.jour}
                                point={point}
                                delai={index * DECALAGE_PAR_BARRE}
                                gaucheGroupe={GOUTTIERE + index * largeurGroupe}
                                largeurGroupe={largeurGroupe}
                                largeurBarre={largeurBarre}
                                hauteurOuverture={point.aSession ? Math.max(2, echelle(point.ouverture)) : 0}
                                hauteurReappro={echelle(point.reappro)}
                                hauteurRestant={point.cloture ? Math.max(2, echelle(point.restant)) : 0}
                                hauteurAttente={point.aSession && !point.cloture ? Math.max(2, echelle(point.disponible)) : 0}
                                estSelectionne={point.jour === jourSelectionne}
                                onPress={() => setJourSelectionne((precedent) => (precedent === point.jour ? null : point.jour))}
                            />
                        ))}
                    </Svg>
                )}
            </View>

            {selection && (
                <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition.duration(220)}>
                    <DetailJour point={selection} />
                </Animated.View>
            )}
        </Animated.View>
    );
}

type BarreJourProps = {
    point: StockTrendPoint;
    delai: number;
    gaucheGroupe: number;
    largeurGroupe: number;
    largeurBarre: number;
    hauteurOuverture: number;
    hauteurReappro: number;
    hauteurRestant: number;
    hauteurAttente: number;
    estSelectionne: boolean;
    onPress: () => void;
};

function BarreJour({
    point,
    delai,
    gaucheGroupe,
    largeurGroupe,
    largeurBarre,
    hauteurOuverture,
    hauteurReappro,
    hauteurRestant,
    hauteurAttente,
    estSelectionne,
    onPress,
}: BarreJourProps) {
    const ouverture = useSharedValue(0);
    const reappro = useSharedValue(0);
    const restant = useSharedValue(0);
    const attente = useSharedValue(0);
    const surbrillance = useSharedValue(0);

    // Les barres poussent depuis la ligne de base au montage, et se retendent
    // vers leur nouvelle valeur quand l'inventaire change.
    useEffect(() => {
        const config = { duration: DUREE_CROISSANCE, easing: Easing.out(Easing.cubic) };
        ouverture.value = withDelay(delai, withTiming(hauteurOuverture, config));
        reappro.value = withDelay(delai, withTiming(hauteurReappro, config));
        restant.value = withDelay(delai, withTiming(hauteurRestant, config));
        attente.value = withDelay(delai, withTiming(hauteurAttente, config));
    }, [hauteurOuverture, hauteurReappro, hauteurRestant, hauteurAttente, delai, ouverture, reappro, restant, attente]);

    useEffect(() => {
        surbrillance.value = withTiming(estSelectionne ? 1 : 0, { duration: DUREE_SELECTION });
    }, [estSelectionne, surbrillance]);

    const propsSurbrillance = useAnimatedProps(() => ({ opacity: surbrillance.value * 0.08 }));

    const propsOuverture = useAnimatedProps(() => {
        const hauteur = Math.max(0.01, ouverture.value);
        return { y: HAUTEUR_CHART - hauteur, height: hauteur };
    });

    // Le réappro reste ancré au sommet de la pile ; le gap est prélevé sur son bas.
    const propsReappro = useAnimatedProps(() => {
        const hauteur = reappro.value <= 0.5 ? 0.01 : Math.max(1, reappro.value - ECART_SEGMENTS);
        return { y: HAUTEUR_CHART - ouverture.value - reappro.value, height: hauteur };
    });

    const propsRestant = useAnimatedProps(() => {
        const hauteur = Math.max(0.01, restant.value);
        return { y: HAUTEUR_CHART - hauteur, height: hauteur };
    });

    const propsAttente = useAnimatedProps(() => {
        const hauteur = Math.max(0.01, attente.value);
        return { y: HAUTEUR_CHART - hauteur, height: hauteur };
    });

    const centre = gaucheGroupe + largeurGroupe / 2;
    const xDisponible = centre - largeurBarre - ECART_BARRES / 2;
    const xRestant = centre + ECART_BARRES / 2;

    return (
        <Fragment>
            {!point.aSession && (
                <Fragment>
                    <Rect x={xDisponible} y={HAUTEUR_CHART - 3} width={largeurBarre} height={3} rx={1.5} fill={COULEUR_ATTENTE} />
                    <Rect x={xRestant} y={HAUTEUR_CHART - 3} width={largeurBarre} height={3} rx={1.5} fill={COULEUR_ATTENTE} />
                </Fragment>
            )}

            <AnimatedRect
                x={gaucheGroupe}
                y={0}
                width={largeurGroupe}
                height={HAUTEUR_CHART}
                fill={COULEUR_OUVERTURE}
                rx={4}
                animatedProps={propsSurbrillance}
            />

            {point.aSession && (
                <Fragment>
                    <AnimatedRect x={xDisponible} width={largeurBarre} rx={2} fill={COULEUR_OUVERTURE} animatedProps={propsOuverture} />
                    {hauteurReappro > 0.5 && (
                        <AnimatedRect x={xDisponible} width={largeurBarre} rx={2} fill={COULEUR_REAPPRO} animatedProps={propsReappro} />
                    )}
                </Fragment>
            )}

            {point.cloture && <AnimatedRect x={xRestant} width={largeurBarre} rx={2} fill={COULEUR_RESTANT} animatedProps={propsRestant} />}

            {point.aSession && !point.cloture && (
                <AnimatedRect
                    x={xRestant}
                    width={largeurBarre}
                    rx={2}
                    fill="none"
                    stroke={COULEUR_ATTENTE}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    animatedProps={propsAttente}
                />
            )}

            <SvgText
                x={centre}
                y={HAUTEUR_TOTAL - 4}
                fontSize={TAILLE_LABEL_DATE}
                fill="#000"
                opacity={point.aSession ? 0.55 : 0.4}
                textAnchor="middle"
            >
                {point.label}
            </SvgText>

            <Rect x={gaucheGroupe} y={0} width={largeurGroupe} height={HAUTEUR_TOTAL} fill="transparent" onPress={onPress} />
        </Fragment>
    );
}

function DetailJour({ point }: { point: StockTrendPoint }) {
    return (
        <View style={{ backgroundColor: "#f5f5f5", borderRadius: theme.internal_radius_2, padding: theme.internal_padding, gap: 6 }}>
            <Text style={{ fontSize: theme.size_one, fontWeight: "bold" }}>{point.label}</Text>

            {!point.aSession && <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Aucun inventaire ce jour-là.</Text>}

            {point.aSession && (
                <Fragment>
                    <LigneDetail label="Stock d'ouverture" valeur={point.ouverture} />
                    <LigneDetail label="Réapprovisionné" valeur={point.reappro} signe="+" />

                    <View style={{ height: 1, backgroundColor: "#e5e7eb", marginVertical: 2 }} />

                    <LigneDetail label="Stock disponible" valeur={point.disponible} />

                    {point.cloture ? (
                        <Fragment>
                            <LigneDetail label="Stock restant compté" valeur={point.restant} />
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                <Text style={{ fontSize: theme.size_one, fontWeight: "bold" }}>Sorti du stock</Text>
                                <Text style={{ fontSize: theme.size_one, fontWeight: "bold" }}>{formaterUnites(point.sorti)}</Text>
                            </View>
                            {point.pertes > 0 && (
                                <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>dont {formaterUnites(point.pertes)} déclarées en perte</Text>
                            )}
                        </Fragment>
                    ) : (
                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>Inventaire encore ouvert : le stock restant sera compté à la fermeture.</Text>
                    )}
                </Fragment>
            )}
        </View>
    );
}

function LigneDetail({ label, valeur, signe }: { label: string; valeur: number; signe?: string }) {
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: theme.size_one, opacity: 0.7 }}>{label}</Text>
            <Text style={{ fontSize: theme.size_one }}>
                {signe ?? ""}
                {formaterUnites(valeur)}
            </Text>
        </View>
    );
}
