import { Text } from "@/components/text";
import theme from "@/constants/constant-style";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react-native";
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Modal, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AlertType = "success" | "error" | "info";

type AlertState =
    | { kind: "alert"; message: string; type: AlertType }
    | { kind: "confirm"; message: string; confirmLabel: string; cancelLabel: string; resolve: (value: boolean) => void }
    | null;

type AlertContextValue = {
    showSuccess: (message: string, duration?: number) => void;
    showError: (message: string, duration?: number) => void;
    showAlert: (message: string, duration?: number) => void;
    confirm: (message: string, options?: { confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
};

const AlertContext = createContext<AlertContextValue | null>(null);

const TYPE_STYLES: Record<AlertType, { background: string; icon: typeof CheckCircle2 }> = {
    success: { background: "#1f9d55", icon: CheckCircle2 },
    error: { background: "#e74c3c", icon: XCircle },
    info: { background: "#2d2d2d", icon: AlertTriangle },
};

export function AlertProvider({ children }: { children: ReactNode }) {
    const insets = useSafeAreaInsets();
    const [state, setState] = useState<AlertState>(null);
    const translateY = useRef(new Animated.Value(120)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismiss = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        Animated.timing(translateY, { toValue: 120, duration: 200, useNativeDriver: true }).start(() => setState(null));
    }, [translateY]);

    const present = useCallback((next: AlertState, duration?: number) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setState(next);
        translateY.setValue(120);
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        if (duration) {
            timerRef.current = setTimeout(dismiss, duration);
        }
    }, [dismiss, translateY]);

    const showAlertOfType = useCallback(
        (type: AlertType, message: string, duration = 3000) => {
            present({ kind: "alert", message, type }, duration);
        },
        [present]
    );

    const confirm = useCallback(
        (message: string, options?: { confirmLabel?: string; cancelLabel?: string }) => {
            return new Promise<boolean>((resolve) => {
                present({
                    kind: "confirm",
                    message,
                    confirmLabel: options?.confirmLabel ?? "Confirmer",
                    cancelLabel: options?.cancelLabel ?? "Annuler",
                    resolve,
                });
            });
        },
        [present]
    );

    const resolveConfirm = useCallback(
        (value: boolean) => {
            setState((current) => {
                if (current?.kind === "confirm") current.resolve(value);
                return current;
            });
            dismiss();
        },
        [dismiss]
    );

    const value = useMemo<AlertContextValue>(
        () => ({
            showSuccess: (message, duration) => showAlertOfType("success", message, duration),
            showError: (message, duration) => showAlertOfType("error", message, duration),
            showAlert: (message, duration) => showAlertOfType("info", message, duration),
            confirm,
        }),
        [showAlertOfType, confirm]
    );

    return (
        <AlertContext.Provider value={value}>
            {children}
            <Modal visible={state !== null} transparent animationType="none" onRequestClose={() => resolveConfirm(false)}>
                <View style={{ flex: 1 }} pointerEvents="box-none">
                    {state && (
                        <Animated.View
                            pointerEvents="box-none"
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: insets.bottom + theme.internal_padding,
                                alignItems: "center",
                                paddingHorizontal: theme.screenPadding,
                                transform: [{ translateY }],
                            }}
                        >
                            {state.kind === "alert" ? (
                                <View
                                    style={{
                                        width: "100%",
                                        maxWidth: theme.contentMaxWidth,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: theme.internal_padding_2,
                                        backgroundColor: TYPE_STYLES[state.type].background,
                                        borderRadius: theme.internal_radius,
                                        padding: theme.internal_padding,
                                    }}
                                >
                                    <AlertIcon type={state.type} />
                                    <Text style={{ color: "white", fontSize: theme.size_two, flex: 1 }}>{state.message}</Text>
                                </View>
                            ) : (
                                <View
                                    style={{
                                        width: "100%",
                                        maxWidth: theme.contentMaxWidth,
                                        backgroundColor: "#1c1c1c",
                                        borderRadius: theme.internal_radius,
                                        padding: theme.internal_padding,
                                        gap: theme.internal_padding,
                                    }}
                                >
                                    <Text style={{ color: "white", fontSize: theme.size_two }}>{state.message}</Text>
                                    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: theme.internal_padding }}>
                                        <TouchableOpacity
                                            onPress={() => resolveConfirm(false)}
                                            style={{ paddingVertical: theme.internal_padding_2, paddingHorizontal: theme.internal_padding, minHeight: theme.touchTarget, justifyContent: "center" }}
                                        >
                                            <Text style={{ color: "#cccccc", fontSize: theme.size_two }}>{state.cancelLabel}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => resolveConfirm(true)}
                                            style={{
                                                paddingVertical: theme.internal_padding_2,
                                                paddingHorizontal: theme.internal_padding,
                                                minHeight: theme.touchTarget,
                                                justifyContent: "center",
                                                backgroundColor: "#e74c3c",
                                                borderRadius: theme.internal_radius_2,
                                            }}
                                        >
                                            <Text style={{ color: "white", fontSize: theme.size_two }}>{state.confirmLabel}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </Animated.View>
                    )}
                </View>
            </Modal>
        </AlertContext.Provider>
    );
}

function AlertIcon({ type }: { type: AlertType }) {
    const Icon = TYPE_STYLES[type].icon;
    return <Icon color="white" size={20} strokeWidth={1.5} />;
}

export function useAlert() {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error("useAlert must be used within AlertProvider");
    return ctx;
}
