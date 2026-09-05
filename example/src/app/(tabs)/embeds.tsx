import { Image, Platform, ScrollView, StyleSheet } from "react-native"
import { MarkdownText, parser } from "react-native-marcus"
import { EMBEDS } from "@/constants/sample"
import { createThemedStylesheet } from "@/hooks/use-theme"

/**
 * A size has to be decided here rather than by the image: the text layout needs
 * to know how much room to leave before it can lay the line out, and markdown
 * carries no dimensions. Which of the two to use is what `inline` is for -- an
 * image alone on its line is a figure, one in a sentence is a badge.
 */
const BLOCK = { width: 160, height: 90 }
const INLINE = { width: 20, height: 20 }

export default function Tab() {
  const styles = useStyles()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MarkdownText
        parser={parser}
        style={styles.display}
        renderEmbed={(uri, alt, title, inline) => {
          // Returning nothing is allowed: the embed keeps its place in the text
          // and draws nothing, which is what the last line of the sample shows.
          if (!uri.startsWith("data:")) {
            return null
          }

          const size = inline ? INLINE : BLOCK

          return (
            <Image
              source={{ uri }}
              style={[styles.embed, size]}
              // Nothing does this for you -- the alt text is handed over, and
              // what to do with it is the caller's to decide.
              accessibilityLabel={alt}
              accessible
              alt={alt}
              title={title || undefined}
            />
          )
        }}
      >
        {EMBEDS}
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
      borderColor: theme.colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      color: theme.colors.text,
      fontSize: 16,
      padding: 8,
      width: "100%",
    },
    embed: {
      borderColor: theme.colors.border,
      borderRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
    },
  }),
)
