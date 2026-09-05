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
        <NativeTabs.Trigger name="text">
          <NativeTabs.Trigger.Label>Text</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="lists">
          <NativeTabs.Trigger.Label>Input Lists</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="text-lists">
          <NativeTabs.Trigger.Label>Text Lists</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="embeds">
          <NativeTabs.Trigger.Label>Embeds</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="expensify">
          <NativeTabs.Trigger.Label>Expensify</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  )
}
