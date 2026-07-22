import { Href, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import theme from "../constants/constant-style";

export default function Titre({ titre, follow_btn = false, follow_link = "/index", follow_name }: { titre?: string, follow_btn?: boolean, follow_link?: Href, follow_name?: string }) {
    return (
        <View style={{ paddingHorizontal: theme.screenPadding, marginTop: theme.size_four, marginBottom: theme.size_one, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: theme.size_two, color: "#838383" }}>{titre}</Text>

            {
                follow_btn && <Pressable onPress={() => router.navigate(follow_link)}><Text style={{ fontSize: theme.size_two, color: "#0f86e7" }}>{follow_name}</Text></Pressable>
            }
        </View>
    )
}