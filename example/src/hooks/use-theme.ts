import { useTheme as useNativeTheme } from "expo-router"
import type { StyleSheet } from "react-native"

import type { Theme } from "@/constants/theme"

export function useTheme(): Theme {
  return useNativeTheme() as Theme
}

export function createThemedStylesheet<T extends StyleSheet.NamedStyles<any>>(
  builder: (theme: Theme) => T,
): () => T {
  return () => {
    const theme = useTheme()

    return builder(theme)
  }
}
