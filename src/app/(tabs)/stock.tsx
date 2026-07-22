import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StockScreen() {
    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View>
                <Text>Stock</Text>
            </View>

        </SafeAreaView>
    );
}