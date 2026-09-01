import { Dimensions } from "react-native";

const DEFAULT_FONT_SIZE = 16;
const BASE_FONT_SCALE = 0.8;

export const convert = (value?: number): number => {
  const fontScale = Dimensions.get("screen").fontScale;

  if (value === undefined) {
    return DEFAULT_FONT_SIZE * BASE_FONT_SCALE;
  }

  if (fontScale > BASE_FONT_SCALE) {
    return value * fontScale;
  }

  return value;
};
