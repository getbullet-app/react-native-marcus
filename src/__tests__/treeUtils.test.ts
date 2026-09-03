/**
 * @jest-environment jsdom
 */
import type { HTMLMarkdownElement } from "../MarkdownTextInput.web"
import {
  addNodeToTree,
  createRootTreeNode,
  findHTMLElementInTree,
  getTreeNodeByIndex,
} from "../web/utils/treeUtils"

function element(value?: string, tag = "span"): HTMLMarkdownElement {
  const node = document.createElement(tag) as HTMLMarkdownElement
  if (value !== undefined) {
    node.value = value
  }
  return node
}

function root(length = 0) {
  return createRootTreeNode(element(undefined, "div"), length)
}

describe("createRootTreeNode", () => {
  it("starts empty at the origin", () => {
    const node = root()

    expect(node.type).toBe("root")
    expect(node.parentNode).toBeNull()
    expect(node.childNodes).toEqual([])
    expect(node.start).toBe(0)
    expect(node.length).toBe(0)
  })
})

describe("addNodeToTree", () => {
  it("takes the offset it is given", () => {
    // Ranges carry their own offsets, and taking them is the only way to be
    // right when ranges do not tile the line -- emphasis split across lines
    // leaves gaps a running total would swallow.
    const tree = root()
    const node = addNodeToTree(element("bold"), tree, "bold", 4, 12)

    expect(node.start).toBe(12)
    expect(node.length).toBe(4)
  })

  it("follows on from the previous sibling when given no offset", () => {
    const tree = root()
    addNodeToTree(element("abc"), tree, "text", 3, 0)
    const second = addNodeToTree(element("de"), tree, "text")

    expect(second.start).toBe(3)
  })

  it("starts at the parent when it is the first child", () => {
    const tree = root()
    const line = addNodeToTree(element(""), tree, "line", 5, 10)
    const first = addNodeToTree(element("ab"), line, "text")

    expect(first.start).toBe(10)
  })

  it("counts a line break as one character", () => {
    const tree = root()
    const node = addNodeToTree(element(undefined, "br"), tree, "br")

    expect(node.length).toBe(1)
  })

  it("falls back to the element's own value length", () => {
    const tree = root()
    const node = addNodeToTree(element("hello"), tree, "text")

    expect(node.length).toBe(5)
  })

  it("records its path as an order index on the element", () => {
    const tree = root()
    const first = addNodeToTree(element("a"), tree, "line", 1, 0)
    const second = addNodeToTree(element("b"), tree, "line", 1, 2)
    const nested = addNodeToTree(element("c"), second, "text", 1, 2)

    expect(first.orderIndex).toBe("0")
    expect(second.orderIndex).toBe("1")
    expect(nested.orderIndex).toBe("1,0")
    expect(nested.element.getAttribute("data-id")).toBe("1,0")
  })

  it("attaches the node to its parent", () => {
    const tree = root()
    const node = addNodeToTree(element("a"), tree, "text", 1, 0)

    expect(tree.childNodes).toEqual([node])
    expect(node.parentNode).toBe(tree)
  })
})

describe("findHTMLElementInTree", () => {
  it("returns the root for the contenteditable host", () => {
    const tree = root()
    const host = document.createElement("div")
    host.setAttribute("contenteditable", "true")

    expect(findHTMLElementInTree(tree, host)).toBe(tree)
  })

  it("walks the order index back to its node", () => {
    const tree = root()
    const line = addNodeToTree(element("ab"), tree, "line", 2, 0)
    const text = addNodeToTree(element("ab"), line, "text", 2, 0)

    expect(findHTMLElementInTree(tree, text.element)).toBe(text)
  })

  it("returns null for an element outside the tree", () => {
    expect(findHTMLElementInTree(root(), document.createElement("span"))).toBeNull()
  })
})

describe("getTreeNodeByIndex", () => {
  it("returns the root while the tree is empty", () => {
    const tree = root(0)

    expect(getTreeNodeByIndex(tree, 0)).toBe(tree)
  })

  it("finds the leaf covering an offset", () => {
    const tree = root(5)
    const line = addNodeToTree(element("abcde"), tree, "line", 5, 0)
    const first = addNodeToTree(element("ab"), line, "text", 2, 0)
    const second = addNodeToTree(element("cde"), line, "text", 3, 2)

    expect(getTreeNodeByIndex(tree, 0)).toBe(first)
    expect(getTreeNodeByIndex(tree, 1)).toBe(first)
    expect(getTreeNodeByIndex(tree, 2)).toBe(second)
    expect(getTreeNodeByIndex(tree, 4)).toBe(second)
  })

  it("returns the last leaf for the offset just past the end", () => {
    const tree = root(2)
    const line = addNodeToTree(element("ab"), tree, "line", 2, 0)
    const text = addNodeToTree(element("ab"), line, "text", 2, 0)

    expect(getTreeNodeByIndex(tree, 2)).toBe(text)
  })
})
