import { useState } from "react"
import { Button, Platform, ScrollView, StyleSheet, View } from "react-native"
import { MarkdownTextInput, parser } from "react-native-marcus"
import { LISTS } from "@/constants/sample"
import { createThemedStylesheet } from "@/hooks/use-theme"

export default function Tab() {
  const styles = useStyles()
  const [value, setValue] = useState(LISTS)
  const [multiline, setMultiline] = useState(true)

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MarkdownTextInput
        parser={parser}
        value={value}
        onChangeText={setValue}
        multiline={multiline}
        style={styles.input}
        placeholder="Type here..."
      />
      <View style={styles.toolbar}>
        <Button title="Clear" onPress={() => setValue("")} />
        <Button title="Reset" onPress={() => setValue(LISTS)} />
        <Button title="Multiline" onPress={() => setMultiline((v) => !v)} />
      </View>
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
    input: {
      color: theme.colors.text,
      fontSize: 16,
      padding: 8,
      width: "100%",
    },
    toolbar: {
      flex: 1,
      flexDirection: "row",
      borderRadius: "50%",
      padding: 8,
    },
  }),
)
