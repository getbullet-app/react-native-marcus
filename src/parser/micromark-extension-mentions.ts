import type {
  Code,
  Construct,
  Effects,
  Extension,
  State,
  TokenizeContext,
} from "micromark-util-types"

const LETTER = /^\p{L}$/u
const ALPHANUMERIC = /^[\p{L}\p{M}\p{N}]$/u

const AT = 64
const DOT = 46
const HYPHEN = 45
const UNDERSCORE = 95

declare module "micromark-util-types" {
  interface TokenTypeMap {
    mention: "mention"
  }
}

const mention = {
  name: "mention",
  tokenize,
  previous,
} as const

/**
 * A `-`, `_` or `@` and the part of the name after it.
 *
 * Attempted rather than consumed outright, because micromark cannot give a
 * character back: a name that ends in front of one -- `@user@ ` -- has to leave
 * the separator outside the token, and an attempt that fails rewinds to it.
 * That is also what lets `_@someone_` be a mention in italics: the closing `_`
 * has no name after it, so it stays markup.
 */
const join: Construct = { tokenize: tokenizeJoin, partial: true }

export function mentions(): Extension {
  return {
    text: {
      64: mention, // @
    },
  }
}

/**
 * A mention starts where a name starts: not inside a word, and not straight
 * after another `@`.
 *
 * That is what keeps `user@example.com` an address rather than an address with
 * a mention buried in it, and `@@user` a stray `@` rather than a name beginning
 * with one. Everything else may sit against it -- `**@someone**`, `[@user](/u)`
 * and `(@user)` all hold one -- because the markup is gone by the time a
 * display draws it, and punctuation was never part of a name to begin with.
 */
function previous(this: TokenizeContext, code: Code): boolean {
  return code === null || (code !== AT && !test(ALPHANUMERIC, code))
}

function tokenize(effects: Effects, ok: State, nok: State): State {
  return start

  function start(code: Code): State {
    if (code === null) {
      return nok(code)!
    }

    effects.enter("mention")
    effects.consume(code)

    return first
  }

  function first(code: Code): State {
    if (code === null || !test(LETTER, code)) {
      return nok(code)!
    }

    effects.consume(code)

    return part
  }

  /** Inside a part of the name: letters, marks and digits. */
  function part(code: Code): State {
    if (code !== null && test(ALPHANUMERIC, code)) {
      effects.consume(code)
      return part
    }

    if (code === DOT) {
      effects.consume(code)
      return afterDot
    }

    if (code === HYPHEN || code === UNDERSCORE || code === AT) {
      return effects.attempt(join, part, done)
    }

    return done(code)
  }

  /**
   * Just after a dot, which belongs to the name wherever it falls -- `@bullet.`
   * is one mention rather than a mention and a full stop.
   *
   * Only the first of several does, though: a second dot in a row ends the name
   * here, in front of it, so `@bullet..` is `@bullet.` and a full stop that
   * still reads as one.
   */
  function afterDot(code: Code): State {
    if (code === DOT) {
      return done(code)
    }

    return part(code)
  }

  /**
   * The name is finished.
   *
   * Nothing is checked here: `part` consumes every character a name is made of,
   * so whatever stopped it is not one -- whitespace, punctuation, or the markup
   * the mention was written inside.
   */
  function done(code: Code): State {
    effects.exit("mention")

    return ok(code)!
  }
}

function tokenizeJoin(effects: Effects, ok: State, nok: State): State {
  return separator

  function separator(code: Code): State {
    // A `-`, `_` or `@`: `part` only attempts this construct on one of the
    // three. An `@` opens a new name and so wants a letter; the other two join
    // two parts of one and take whatever a part is made of.
    effects.consume(code)

    return code === AT ? afterAt : afterJoin
  }

  function afterJoin(code: Code): State {
    if (code === null || !test(ALPHANUMERIC, code)) {
      return nok(code)!
    }

    effects.consume(code)

    return ok
  }

  function afterAt(code: Code): State {
    if (code === null || !test(LETTER, code)) {
      return nok(code)!
    }

    effects.consume(code)

    return ok
  }
}

function test(regex: RegExp, code: number): boolean {
  if (code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    return false
  }

  return regex.test(String.fromCodePoint(code))
}
