![react-native-marcus](./assets/hero-animation.gif)

# react-native-marcus

Marcus is a rich text markdown editor. It is a fork or [Expensify/react-native-live-markdown](https://github.com/Expensify/react-native-live-markdown) that's a bit more a bit more ambitious.

Marcus takes a different approach to editing markdown: formatting is rendered live on every keystroke and syntax is highlighted but not removed. This way you get instant visual feedback and a good idea what rendered markdown will look like without losing the ability to easily edit the source.

## Features

- ⚛️ Drop-in replacement for `<TextInput>` component
- ⌨️ Live synchronous formatting on every keystroke
- ⚡ Fully native experience (selection, spellcheck, autocomplete)
- 🔧 Customizable logic
- 🎨 Customizable styles
- 🌐 Universal support (Android, iOS, web)
- 🏗️ Supports only the New Architecture

## Differences from Expensify/react-native-live-markdown

- Native side written mostly in Swift and Kotlin as opposed to Objective-C++ and Java
- Uses established and maintained [micromark](https://github.com/micromark/micromark) parser
- At least twice as fast; on small inputs and slow devices up to 8X faster
- Fully CommonMark and GFM compliant

## Installation

First, install the library from npm:

```sh
npm install react-native-marcus react-native-worklets
```

Or if using expo:

```sh
npx expo install react-native-marcus react-native-worklets
```

> [!IMPORTANT]
> Please follow the `react-native-worklets` [Getting Started](https://docs.swmansion.com/react-native-worklets/docs/fundamentals/getting-started/#react-native-community-cli) guide to avoid issues.

Then, install the iOS dependencies with CocoaPods:

```sh
npx pod-install
```

The library includes native code so you will need to re-build the native app.

> [!NOTE]
> The library does not support Expo Go, you will need to setup Expo Dev Client (see [here](https://docs.expo.dev/workflow/prebuild/)).

## Usage

```tsx
import { useState } from "react"
import { MarkdownTextInput, parseMicroMark } from "react-native-marcus"

export default function App() {
  const [text, setText] = useState("Hello, **world**!")

  return <MarkdownTextInput value={text} onChangeText={setText} parser={parseMicroMark} />
}
```

## Styling

`MarkdownTextInput` can be styled using `style` prop just like regular `TextInput` component.

It is also possible to customize the styling of the formatted contents of `MarkdownTextInput` component. The style object supports all color representations from React Native including `PlatformColor` and `DynamicColorIOS` according to the [color reference](https://reactnative.dev/docs/colors). Currently, a limited set of styles is customizable but this is subject to change in the future.

```tsx
import type { MarkdownStyle } from "react-native-marcus"

const FONT_FAMILY_MONOSPACE = Platform.select({
  ios: "Courier",
  default: "monospace",
})

const FONT_FAMILY_EMOJI = Platform.select({
  ios: "System",
  android: "Noto Color Emoji",
  default: "System, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji",
})

const markdownStyle: MarkdownStyle = {
  syntax: {
    color: "gray",
  },
  link: {
    color: "blue",
  },
  h1: {
    fontSize: 25,
  },
  emoji: {
    fontSize: 20,
    fontFamily: FONT_FAMILY_EMOJI,
  },
  blockquote: {
    borderColor: "gray",
    borderWidth: 6,
    marginLeft: 6,
    paddingLeft: 6,
  },
  code: {
    fontFamily: FONT_FAMILY_MONOSPACE,
    fontSize: 20,
    color: "black",
    backgroundColor: "lightgray",
  },
  pre: {
    fontFamily: FONT_FAMILY_MONOSPACE,
    fontSize: 20,
    color: "black",
    backgroundColor: "lightgray",
  },
  mentionHere: {
    color: "green",
    backgroundColor: "lime",
  },
  mentionUser: {
    color: "blue",
    backgroundColor: "cyan",
  },
}
```

The style object can be passed to multiple `MarkdownTextInput` components using `markdownStyle` prop:

```tsx
<MarkdownTextInput
  value={text}
  onChangeText={setText}
  style={styles.input}
  markdownStyle={markdownStyle}
/>
```

> [!TIP]
> We recommend to store the style object outside of a component body or memoize the style object with `React.useMemo`.

## Parsing logic

`MarkdownTextInput` behavior can be customized via `parser` property. Parser is a function that accepts a plaintext string and returns an array of `MarkdownRange` objects:

```ts
interface MarkdownRange {
  type: MarkdownType
  start: number
  length: number
}
```

Currently, only the following types are supported:

```ts
type MarkdownType =
  | "bold"
  | "italic"
  | "strikethrough"
  | "emoji"
  | "mention"
  | "link"
  | "code"
  | "pre"
  | "blockquote"
  | "h1"
  | "syntax"
```

Parser needs to be marked as a [worklet](https://docs.swmansion.com/react-native-worklets/docs/fundamentals/glossary#worklet) because it's executed on the UI thread as the user types.

Here's a sample function that parses all substrings located between two asterisks as italic text:

```ts
function parser(input: string) {
  "worklet"

  const ranges = []
  const regexp = /\*(.*?)\*/g
  let match
  while ((match = regexp.exec(input)) !== null) {
    ranges.push({ start: match.index, length: 1, type: "syntax" })
    ranges.push({ start: match.index + 1, length: match[1]!.length, type: "emphasis" })
    ranges.push({ start: match.index + 1 + match[1]!.length, length: 1, type: "syntax" })
  }
  return ranges
}
```

> [!TIP]
> We recommend to store the parser function outside of a component body or memoize the parser function with `React.useMemo`.

## Markdown flavors support

Currently, `react-native-marcus` supports only [CommonMark](https://spec.commonmark.org/0.31.2/) flavor with [GFM (Github Flavored Markdown)](https://github.github.com/gfm/) extensions out-of-the-box. You can customize the behavior by passing a custom parser worklet function via the `parser` prop, as detailed in the [Parsing logic](#parsing-logic) section.

## API reference

`MarkdownTextInput` inherits all props of React Native's `TextInput` component as well as introduces the following properties:

| Prop            | Type                                 | Default     | Note                                                                                                                                                   |
| --------------- | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `parser`        | `(value: string) => MarkdownRange[]` | `undefined` | A function that parses the current value and returns an array of ranges.                                                                               |
| `markdownStyle` | `MarkdownStyle`                      | `undefined` | Adds custom styling to Markdown text. The provided value is merged with default style object. See [Styling](./README.md#styling) for more information. |

## Compatibility

`react-native-marcus` supports only latest React Native minor releases with the New Architecture enabled.

### React Native compatibility

|        | 0.81 | 0.82 | 0.83 | 0.84 | 0.85 | 0.86 |
| :----: | :--: | :--: | :--: | :--: | :--: | :--: |
| 0.0.1+ |  ✅  |  ✅  |  ✅  |  ✅  |  ✅  |  ✅  |

### `react-native-worklets` compatibility

|        | 0.6.x | 0.7.x | 0.8.x | 0.9.x | 0.10.2+ |
| :----: | :---: | :---: | :---: | :---: | :-----: |
| 0.0.1+ |  ❌   |  ✅   |  ✅   |  ✅   |   ✅    |

## License

Apache-2.0
