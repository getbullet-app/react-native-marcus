import { Stack } from "expo-router"

/**
 * The tabs are the demo; `harness` and `checks` sit outside them so the test
 * routes render on their own, with no tab bar in the way of a screenshot.
 */
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="harness" />
      <Stack.Screen name="checks" />
    </Stack>
  )
}
