import { useState } from "react"
import { Platform, ScrollView, StyleSheet, Text } from "react-native"
import { MarkdownText, parser } from "react-native-marcus"
import { PREVIEW } from "@/constants/sample"
import { createThemedStylesheet } from "@/hooks/use-theme"

export default function Tab() {
  const styles = useStyles()
  const [pressed, setPressed] = useState<string | null>(null)

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MarkdownText
        parser={parser}
        style={styles.display}
        // Reported rather than opened. Nothing hands the URL to `Linking` for
        // you: a message from a stranger is the last place to open an arbitrary
        // URL without looking at it first, so what a link means is left to the
        // application. Bare URLs, emails and images written as links all arrive
        // here too.
        onLinkPress={(uri, label, title) => {
          setPressed(`${label} -> ${uri}${title === "" ? "" : ` (${title})`}`)
        }}
      >
        {PREVIEW}
      </MarkdownText>
      <Text style={styles.pressed}>{pressed ?? "press a link"}</Text>
    </ScrollView>
  )
}

const useStyles = createThemedStylesheet((theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      alignItems: "center",
      marginTop: Platform.select({
        android: 64,
        default: 0,
      }),
    },
    pressed: {
      color: theme.colors.text,
      fontSize: 14,
      opacity: 0.7,
      padding: 8,
      width: "100%",
    },
    display: {
      borderColor: theme.colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      color: theme.colors.text,
      fontSize: 16,
      padding: 8,
      width: "100%",
    },
  }),
)
