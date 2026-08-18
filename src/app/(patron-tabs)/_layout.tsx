import { Text } from '@/components/text';
import { Tabs } from 'expo-router';
import { FileText, House, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from "../../constants/constant-style";

const fontSizeLabel = theme.size_one

export default function PatronTabsBar() {
    const frame = useSafeAreaInsets()
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: true,
                tabBarStyle: {
                    height: (frame.bottom >= 20 ? 55 : 78) + (theme.isTablet ? 12 : 0),
                    borderTopColor: "#eee",
                    borderTopWidth: 1,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarItemStyle: {
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 8,
                },
            }}
        >
            <Tabs.Screen
                name="accueil"
                options={{
                    tabBarIcon: ({ color, size }) => (<House width={size} height={size} color={color} strokeWidth={1} />),
                    tabBarLabel: ({ color }) => <Text style={{ color: color, fontSize: fontSizeLabel }}>Accueil</Text>
                }}
            />
            <Tabs.Screen
                name="rapports"
                options={{
                    tabBarIcon: ({ color, size }) => (<FileText width={size} height={size} color={color} strokeWidth={1} />),
                    tabBarLabel: ({ color }) => <Text style={{ color: color, fontSize: fontSizeLabel }}>Rapports</Text>
                }}
            />
            <Tabs.Screen
                name="preferences"
                options={{
                    tabBarIcon: ({ color, size }) => (<Settings width={size} height={size} color={color} strokeWidth={1} />),
                    tabBarLabel: ({ color }) => <Text style={{ color: color, fontSize: fontSizeLabel }}>Préférences</Text>
                }}
            />
        </Tabs>
    )
}
