import { Text } from '@/components/text';
import { Tabs } from 'expo-router';
import { House, Layers, Settings, Wallet } from "lucide-react-native";
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from "../../constants/constant-style";
import { useDatabase } from '../../Database/database.context';

const fontSizeLabel = theme.size_one

export default function TabsBar() {
    const frame = useSafeAreaInsets()
    const { produitsAlerteIds, alertesVues } = useDatabase()
    const alertesNonVues = Array.from(produitsAlerteIds).some((id) => !alertesVues.has(id))
    return (
        <Tabs
            screenOptions={{
                // tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                // Disable the static render of the header on web
                // to prevent a hydration error in React Navigation v6.
                headerShown: false,
                tabBarShowLabel: true,
                tabBarStyle: {
                    height: 55 + frame.bottom + 8 + (theme.isTablet ? 12 : 0),
                    paddingBottom: frame.bottom + 8,
                    borderTopColor: "#eee",
                    borderTopWidth: 1,
                    elevation: 0, // Pour Android
                    shadowOpacity: 0, // Pour iOS
                },
                tabBarItemStyle: {
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 8,
                },

            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ color, focused, size }) => {
                        return (<House width={size} height={size} color={color} strokeWidth={1} />)
                    },
                    tabBarLabel: ({ color, focused }) => <Text style={{ color: color, fontSize: fontSizeLabel }}>Accueil</Text>
                }}
            />

            <Tabs.Screen
                name="stock"
                options={{
                    tabBarIcon: ({ color, focused, size }) => {
                        return (
                            <View>
                                <Layers width={size} height={size} color={color} strokeWidth={1} />
                                {alertesNonVues && (
                                    <View style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: "#e74c3c" }} />
                                )}
                            </View>
                        )
                    },
                    tabBarLabel: ({ color, focused }) => <Text style={{ color: color, fontSize: fontSizeLabel }}>Stock</Text>
                }}
            />
            <Tabs.Screen
                name="caisse"
                options={{
                    tabBarIcon: ({ color, focused, size }) => {
                        return (<Wallet width={size} height={size} color={color} strokeWidth={1} />)
                    },
                    tabBarLabel: ({ color, focused }) => <Text style={{ color: color, fontSize: fontSizeLabel }}>Caisse</Text>
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    tabBarIcon: ({ color, focused, size }) => {
                        return (<Settings width={size} height={size} color={color} strokeWidth={1} />)
                    },
                    tabBarLabel: ({ color, focused }) => <Text style={{ color: color, fontSize: fontSizeLabel }}>Préférences</Text>
                }}
            />
        </Tabs>
    )
}