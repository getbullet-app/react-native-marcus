package com.expensify.livemarkdown;

import android.text.Spanned;

import com.facebook.react.views.text.internal.span.CustomLineHeightSpan;

/**
 * React Native's {@code CustomLineHeightSpan} is declared {@code internal} in Kotlin. It stays
 * public in the bytecode, so Java can still reach it, but the Kotlin compiler refuses to. This
 * shim keeps that one lookup in Java.
 *
 * <p>The alternatives were worse: reflection breaks silently under R8, and deriving the height by
 * probing the public {@code LineHeightSpan.chooseHeight} couples us to React Native's internal
 * metrics maths, which would mis-space h1 lines without failing. If React Native ever renames or
 * removes the class, this file stops compiling, which is the failure mode we want.
 */
public final class ReactLineHeight {
  private ReactLineHeight() {}

  /** The line height React Native applied to {@code spanned}, or -1 if it applied none. */
  public static int find(Spanned spanned) {
    CustomLineHeightSpan[] spans =
        spanned.getSpans(0, spanned.length(), CustomLineHeightSpan.class);
    return spans.length >= 1 ? spans[0].getLineHeight() : -1;
  }
}
