import { ThemeProvider } from "expo-router"
import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useColorScheme } from "react-native"

import { DarkTheme, LightTheme } from "@/constants/theme"

export default function TabLayout() {
  const colorScheme = useColorScheme()
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : LightTheme}>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Input</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  )
}
