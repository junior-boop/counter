import { Fragment, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import theme from "../constants/constant-style";
import { Text } from "./text";

export type StockTrendPoint = {
    jour: string;
    ouverture: number;
    reappro: number;
    fermeture: number;
};

const HAUTEUR_CHART = 120;
const HAUTEUR_LABELS = 20;
const HAUTEUR_TOTAL = HAUTEUR_CHART + HAUTEUR_LABELS;
const COULEUR_OUVERTURE = "#9aa5b1";
const COULEUR_REAPPRO = "#0f86e7";
const COULEUR_FERMETURE = "#16a34a";
const COULEUR_AXE = "#e5e7eb";

export function StockTrendChart({ data }: { data: StockTrendPoint[] }) {
    const [largeur, setLargeur] = useState(0);

    if (data.length === 0) return null;

    const max = Math.max(1, ...data.flatMap((d) => [d.ouverture, d.reappro, d.fermeture]));

    function onLayout(e: LayoutChangeEvent) {
        setLargeur(e.nativeEvent.layout.width);
    }

    const largeurGroupe = largeur > 0 ? largeur / data.length : 0;
    const largeurBarre = Math.max(2, largeurGroupe / 3 - 4);

    return (
        <View style={{ backgroundColor: "white", borderRadius: theme.internal_radius, padding: theme.internal_padding, gap: theme.internal_padding }}>
            <Text style={{ fontSize: theme.size_two, fontWeight: "bold" }}>Tendances</Text>
            <View style={{ flexDirection: "row", gap: theme.internal_padding }}>
                {[
                    { label: "Ouverture", couleur: COULEUR_OUVERTURE },
                    { label: "Réappro.", couleur: COULEUR_REAPPRO },
                    { label: "Fermeture", couleur: COULEUR_FERMETURE },
                ].map((legende) => (
                    <View key={legende.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: legende.couleur }} />
                        <Text style={{ fontSize: theme.size_one, opacity: 0.6 }}>{legende.label}</Text>
                    </View>
                ))}
            </View>
            <View onLayout={onLayout} style={{ width: "100%", height: HAUTEUR_TOTAL }}>
                {largeur > 0 && (
                    <Svg width={largeur} height={HAUTEUR_TOTAL}>
                        <Line x1={0} y1={HAUTEUR_CHART} x2={largeur} y2={HAUTEUR_CHART} stroke={COULEUR_AXE} strokeWidth={1} />
                        {data.map((point, index) => {
                            const xGroupe = index * largeurGroupe;
                            const barres = [
                                { valeur: point.ouverture, couleur: COULEUR_OUVERTURE, decalage: 0 },
                                { valeur: point.reappro, couleur: COULEUR_REAPPRO, decalage: 1 },
                                { valeur: point.fermeture, couleur: COULEUR_FERMETURE, decalage: 2 },
                            ];
                            return (
                                <Fragment key={`${point.jour}-${index}`}>
                                    {barres.map((barre) => {
                                        const hauteur = max > 0 ? Math.max(2, (barre.valeur / max) * (HAUTEUR_CHART - 4)) : 2;
                                        const x = xGroupe + barre.decalage * (largeurBarre + 4) + (largeurGroupe - 3 * largeurBarre - 8) / 2;
                                        return (
                                            <Rect
                                                key={barre.decalage}
                                                x={x}
                                                y={HAUTEUR_CHART - hauteur}
                                                width={largeurBarre}
                                                height={hauteur}
                                                rx={2}
                                                fill={barre.couleur}
                                            />
                                        );
                                    })}
                                    <SvgText
                                        x={xGroupe + largeurGroupe / 2}
                                        y={HAUTEUR_TOTAL - 4}
                                        fontSize={theme.size_one}
                                        fill="#000"
                                        opacity={0.5}
                                        textAnchor="middle"
                                    >
                                        {point.jour}
                                    </SvgText>
                                </Fragment>
                            );
                        })}
                    </Svg>
                )}
            </View>
        </View>
    );
}
