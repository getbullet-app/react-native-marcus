import { Platform, ScrollView, StyleSheet } from "react-native"
import { MarkdownText, parser } from "react-native-marcus"
import { LISTS } from "@/constants/sample"
import { createThemedStylesheet } from "@/hooks/use-theme"

export default function Tab() {
  const styles = useStyles()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MarkdownText parser={parser} style={styles.display}>
        {LISTS}
      </MarkdownText>
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
    display: {
      color: theme.colors.text,
      fontSize: 16,
      padding: 8,
      width: "100%",
    },
  }),
)
