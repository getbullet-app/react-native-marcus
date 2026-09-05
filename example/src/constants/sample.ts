export const PREVIEW = `# Heading

## Subheading

Marcus support **strong**, *emphasis*, and ~~strikethrough~~ formatting.
They *can **also ~~be nested~~ or** not*.
Other things include [links](https://example.com/) and [emails](support@example.com).
A label can say anything, [http://google.com](http://example.com) included, and is what gets pressed.
These can also be bare: https://example.com/ and support@example.com
Embeds are ![also highlighted](https://example.com/favicon.png)

> You can quote text

> Have ~~multiline
quotes *with* **formatting**~~
>> Or have
>>> nested quotes

Code works as well: either \`inline\` or
\`\`\`json
{
  codeblock: true
}
\`\`\`

Non-standard features include @bullet. and @user@example.com mentions (**@marked-up** ones too) highlighting and emoji 🥳 **🚀** ~~🇱🇹~~ detection
`
export const LISTS = `
- Unordered item
- Another one
  - Nested deeper
    1. Ordered inside
    2. Second
  - > Quote in list
How's this

1. Ordered top
2. Next one

> - List in quote
- isn't carried over

> - Quoted item one
> - Quoted item two
> - Quoted item three
`

// Data URIs rather than a host, so the demo shows the same thing on a device with no
// network as it does in CI. Two colours, so it is obvious which embed is which.
export const EMBEDS = `An image on its own line:

![blue square](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR42mOwqbgDRAwQCgApTgZBX/HJPwAAAABJRU5ErkJggg== "A blue square")

One ![amber square](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR42mN4tkADiBggFAAyDga5JsB0DgAAAABJRU5ErkJggg==) sitting in a sentence, where the line has to make room for it.

> ![blue square](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR42mOwqbgDRAwQCgApTgZBX/HJPwAAAABJRU5ErkJggg==)
> Quoted, so the embed is laid out inside the quote's indent.

- ![amber square](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR42mN4tkADiBggFAAyDga5JsB0DgAAAABJRU5ErkJggg==) in a list item
- and a second item after it

Nothing renders one of these: ![no renderer](https://example.com/missing.png)
`
