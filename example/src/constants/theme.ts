import "@/global.css"

import type { Theme as NativeTheme } from "expo-router"
import { Platform } from "react-native"

export interface Theme extends NativeTheme {
  dark: boolean
  fonts: NativeTheme["fonts"] & { monospace: NativeTheme["fonts"]["regular"] }
  colors: NativeTheme["colors"]
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    mono: "var(--font-mono)",
  },
})

export const LightTheme: Theme = {
  dark: false,
  fonts: {
    regular: {
      fontFamily: Fonts.sans,
      fontWeight: "400",
    },
    medium: {
      fontFamily: Fonts.sans,
      fontWeight: "600",
    },
    bold: {
      fontFamily: Fonts.sans,
      fontWeight: "700",
    },
    heavy: {
      fontFamily: Fonts.sans,
      fontWeight: "900",
    },
    monospace: {
      fontFamily: Fonts.mono,
      fontWeight: "400",
    },
  },
  colors: {
    background: "#fafafa",
    border: "#f5f5f5",
    card: "#bdbdbd",
    notification: "#ff4081",
    primary: "#ffc107",
    text: "#212121",
  },
}

export const DarkTheme: Theme = {
  dark: true,
  fonts: {
    regular: {
      fontFamily: Fonts.sans,
      fontWeight: "400",
    },
    medium: {
      fontFamily: Fonts.sans,
      fontWeight: "600",
    },
    bold: {
      fontFamily: Fonts.sans,
      fontWeight: "700",
    },
    heavy: {
      fontFamily: Fonts.sans,
      fontWeight: "900",
    },
    monospace: {
      fontFamily: Fonts.mono,
      fontWeight: "400",
    },
  },
  colors: {
    background: "#212121",
    border: "#121212",
    card: "#424242",
    notification: "#ff4081",
    primary: "#ffc107",
    text: "#fafafa",
  },
}
