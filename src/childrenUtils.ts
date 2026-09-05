import type React from "react"

/**
 * Flattens children into the string they render as, or null if they are not
 * text.
 *
 * Only strings and numbers are markdown. An element child is content there are
 * no parser offsets for and no way to strip syntax out of, so a subtree
 * containing one renders unformatted rather than half formatted.
 */
function flattenText(children: React.ReactNode): string | null {
  const parts: string[] = []

  return collect(children, parts) ? parts.join("") : null
}

function collect(children: React.ReactNode, parts: string[]): boolean {
  if (children === null || children === undefined || typeof children === "boolean") {
    return true
  }

  if (typeof children === "string") {
    parts.push(children)
    return true
  }

  if (typeof children === "number") {
    parts.push(String(children))
    return true
  }

  if (Array.isArray(children)) {
    return children.every((child) => collect(child, parts))
  }

  return false
}

export { flattenText }
