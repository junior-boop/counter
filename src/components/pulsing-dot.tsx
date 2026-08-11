import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

type PulsingDotProps = {
    size?: number;
    color?: string;
    duration?: number;
};

export function PulsingDot({ size = 10, color = "#000000", duration = 1500 }: PulsingDotProps) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1);
    }, [progress, duration]);

    const waveStyle = useAnimatedStyle(() => ({
        opacity: 1 - progress.value,
        transform: [{ scale: 1 + progress.value * 2 }],
    }));

    const dotStyle = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };

    return (
        <View style={[styles.container, { width: size * 3, height: size * 3 }]}>
            <Animated.View style={[styles.circle, dotStyle, waveStyle]} />
            <View style={[styles.circle, dotStyle]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "center",
    },
    circle: {
        position: "absolute",
    },
});
