import { usePatronAuth } from "@/PatronAuth/patronAuth.context";
import { useAlert } from "@/components/alert/alert.context";
import { Text } from "@/components/text";
import Titre from "@/components/titre";
import { LogOut } from "lucide-react-native";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

export default function PatronSettingsScreen() {
    const { patronSession, signOut } = usePatronAuth();
    const { confirm } = useAlert();
    const insets = useSafeAreaInsets();

    const handleDeconnexion = async () => {
        const ok = await confirm("Voulez-vous vous déconnecter ?", { confirmLabel: "Se déconnecter" });
        if (ok) await signOut();
    };

    return (
        <View style={{ flex: 1, paddingTop: insets.top }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom }}>
                <View style={{ height: theme.headerHeight, width: "100%", flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Préférences</Text>
                </View>

                <Titre titre="Compte patron" />
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    <View style={{ gap: 3, overflow: "hidden", borderRadius: theme.internal_radius, borderColor: "transparent", borderWidth: 1 }}>
                        <View style={styles.button}>
                            <Text style={{ fontSize: theme.size_two }}>{patronSession?.email}</Text>
                        </View>
                        <TouchableOpacity style={styles.button} onPress={handleDeconnexion}>
                            <Text style={{ fontSize: theme.size_two, color: "#e74c3c" }}>Se déconnecter</Text>
                            <LogOut color="#e74c3c" size={18} strokeWidth={1.5} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: "white",
        padding: theme.internal_padding,
        borderRadius: theme.internal_radius_2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
});
