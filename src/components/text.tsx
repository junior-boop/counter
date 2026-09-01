import { convert } from "@/lib/fontScale";
import { StyleSheet, Text as RNText, TextProps } from "react-native";

export function Text({ style, allowFontScaling = false, ...rest }: TextProps) {
  const { fontSize, ...restStyle } = StyleSheet.flatten(style) ?? {};

  return (
    <RNText
      allowFontScaling={allowFontScaling}
      style={[
        { fontFamily: "Inter 24pt" },
        restStyle,
        fontSize !== undefined ? { fontSize: convert(fontSize) } : null,
      ]}
      {...rest}
    />
  );
}
