import theme from "@/constants/constant-style";
import { useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

const SHEET_TRAVEL_DISTANCE = 300;

type BottomSheetProps = {
    visible: boolean;
    onClose: () => void;
    children: ReactNode;
    keyboardAvoiding?: boolean;
    /** Tap sur le fond assombri pour fermer la feuille. Désactive-le pour forcer un choix explicite. */
    dismissOnBackdropPress?: boolean;
    /** Petite poignée décorative en haut de la feuille, signalant qu'elle vient du bas. */
    showHandle?: boolean;
    sheetStyle?: ViewStyle;
    /**
     * `"modal"` (défaut) présente la feuille dans sa propre fenêtre native.
     * Utilisez `"inline"` quand la feuille est ouverte depuis l'intérieur d'une
     * autre `Modal` : deux Modals présentées en même temps ne s'empilent pas de
     * façon fiable (écran noir ou gel côté natif). En inline, la feuille se
     * superpose au contenu de la Modal parente — il faut donc la rendre en
     * dernier enfant d'un conteneur qui remplit l'écran.
     */
    presentation?: "modal" | "inline";
};

export function BottomSheet({
    visible,
    onClose,
    children,
    keyboardAvoiding = true,
    dismissOnBackdropPress = true,
    showHandle = true,
    sheetStyle,
    presentation = "modal",
}: BottomSheetProps) {
    const [mounted, setMounted] = useState(visible);
    const backdropOpacity = useSharedValue(0);
    const sheetTranslateY = useSharedValue(SHEET_TRAVEL_DISTANCE);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) {
            setMounted(true);
            backdropOpacity.value = withTiming(1, { duration: 200 });
            sheetTranslateY.value = withTiming(0, { duration: 250 });
        } else {
            backdropOpacity.value = withTiming(0, { duration: 150 });
            sheetTranslateY.value = withTiming(SHEET_TRAVEL_DISTANCE, { duration: 200 }, (finished) => {
                if (finished) scheduleOnRN(setMounted, false);
            });
        }
    }, [visible]);

    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: sheetTranslateY.value }],
    }));

    if (!mounted) return null;

    const content = (
        <>
            <Pressable style={{ flex: 1 }} onPress={dismissOnBackdropPress ? onClose : undefined}>
                <Animated.View style={[{ flex: 1, backgroundColor: "#00000066" }, backdropStyle]} />
            </Pressable>
            <Animated.View
                style={[
                    {
                        backgroundColor: "white",
                        borderTopLeftRadius: theme.radius,
                        borderTopRightRadius: theme.radius,
                        padding: theme.screenPadding,
                        width: "100%",
                        maxWidth: theme.contentMaxWidth,
                        alignSelf: "center",
                    },
                    animatedSheetStyle,
                    sheetStyle,
                ]}
            >
                {children}
            </Animated.View>
        </>
    );

    const corps = keyboardAvoiding ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            {content}
            <View style={{ height: insets.bottom, backgroundColor: "white" }} />
        </KeyboardAvoidingView>
    ) : (
        <View style={{ flex: 1 }}>{content}</View>
    );

    if (presentation === "inline") {
        return <View style={StyleSheet.absoluteFill}>{corps}</View>;
    }

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            {corps}
        </Modal>
    );
}
