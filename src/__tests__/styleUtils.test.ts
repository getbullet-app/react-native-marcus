import { mergeMarkdownStyleWithDefault } from "../styleUtils"

describe("mergeMarkdownStyleWithDefault", () => {
  it("returns a complete style when given nothing", () => {
    const style = mergeMarkdownStyleWithDefault(undefined)

    expect(style.syntax.color).toBe("gray")
    expect(style.link.color).toBe("blue")
    expect(style.blockquote.borderWidth).toBe(6)
    expect(style.code.fontSize).toBe(16)
  })

  it("overrides only the properties given", () => {
    const style = mergeMarkdownStyleWithDefault({ code: { color: "red" } })

    expect(style.code.color).toBe("red")
    // Siblings inside the same group survive the merge.
    expect(style.code.backgroundColor).toBe("lightgray")
    expect(style.code.fontSize).toBe(16)
  })

  it("leaves untouched groups at their defaults", () => {
    const style = mergeMarkdownStyleWithDefault({ link: { color: "purple" } })

    expect(style.link.color).toBe("purple")
    expect(style.syntax.color).toBe("gray")
  })

  it("ignores keys that are not part of the style", () => {
    const style = mergeMarkdownStyleWithDefault({
      notAGroup: { color: "red" },
    } as never)

    expect(style.syntax.color).toBe("gray")
    expect(style).not.toHaveProperty("notAGroup")
  })

  it("does not mutate the input", () => {
    const input = { code: { color: "red" } }

    mergeMarkdownStyleWithDefault(input)

    expect(input).toEqual({ code: { color: "red" } })
  })

  it("builds fresh defaults on every call", () => {
    // The merge writes into the default object with Object.assign, so a shared
    // default would let one component's markdownStyle leak into every other
    // input mounted afterwards.
    mergeMarkdownStyleWithDefault({ code: { color: "red" } })

    expect(mergeMarkdownStyleWithDefault(undefined).code.color).toBe("black")
  })

  it("returns independent objects across calls", () => {
    const first = mergeMarkdownStyleWithDefault(undefined)
    const second = mergeMarkdownStyleWithDefault(undefined)

    expect(first).not.toBe(second)
    expect(first.code).not.toBe(second.code)
  })
})
