package com.expensify.livemarkdown

data class MarkdownRange(
  val type: String,
  val start: Int,
  val length: Int,
  val depth: Int
) {
  val end: Int
    get() = start + length
}
