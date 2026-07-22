import { Text } from "@/components/text";
import Titre from "@/components/titre";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../../constants/constant-style";

export default function SettingsScreen() {
    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }}>
                <View style={{ height: 72, width: "100%", flexDirection: "row", alignItems: "center", paddingHorizontal: theme.screenPadding }}>
                    <Text style={{ fontSize: theme.size_four }}>Préférences</Text>
                </View>
                <Titre titre="Activités" />
                <View style={{ paddingHorizontal: theme.screenPadding }}>
                    <View style={{ gap: 3, overflow: 'hidden', borderRadius: theme.internal_radius, borderColor: 'transparent', borderWidth: 1 }}>
                        <TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: "/activite/[type]", params: { type: "bar" } })}>
                            <Text style={{ fontSize: theme.size_two }}>Snack-Bar | Bars</Text>
                            <ChevronRight color="black" size={20} strokeWidth={1} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: "/activite/[type]", params: { type: "restaurant" } })}>
                            <Text style={{ fontSize: theme.size_two }}>Café | Restaurants</Text>

                            <ChevronRight color="black" size={20} strokeWidth={1} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    button: {
        backgroundColor: 'white',
        padding: theme.internal_padding,
        borderRadius: theme.internal_radius_2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    }
})