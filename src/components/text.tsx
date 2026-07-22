import { Text as RNText, TextProps } from "react-native";

export function Text({ style, ...rest }: TextProps) {
  return <RNText style={[{ fontFamily: "Inter 24pt" }, style]} {...rest} />;
}
