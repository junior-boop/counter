import { StyleSheet, useWindowDimensions, View, type ViewProps } from "react-native";

const TABLET_BREAKPOINT = 768;
const TABLET_WIDTH = 524;
const PHONE_HORIZONTAL_PADDING = 20;

export function Container({ style, ...props }: ViewProps) {
    const { width } = useWindowDimensions();
    const isTablet = width >= TABLET_BREAKPOINT;

    return <View {...props} style={[isTablet ? styles.tablet : styles.phone, style]} />;
}

const styles = StyleSheet.create({
    tablet: {
        width: TABLET_WIDTH,
        marginHorizontal: "auto",
    },
    phone: {
        width: "100%",
        paddingHorizontal: PHONE_HORIZONTAL_PADDING,
    },
});
