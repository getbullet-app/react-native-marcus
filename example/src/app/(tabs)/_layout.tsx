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
          <NativeTabs.Trigger.Label>Marcus</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="lists">
          <NativeTabs.Trigger.Label>Lists</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="expensify">
          <NativeTabs.Trigger.Label>Expensify</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  )
}
