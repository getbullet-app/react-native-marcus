import type {Code, Effects, Extension, State} from 'micromark-util-types';

const LETTER = /^\p{L}$/u;
const WORD = /^[\p{L}\p{M}\p{N}_]$/u;
const ALPHANUMERIC = /^[\p{L}\p{M}\p{N}]$/u;

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mention: 'mention';
  }
}

const mention = {
  name: 'mention',
  tokenize,
} as const;

export function mentions(): Extension {
  return {
    text: {
      64: mention, // @
    },
  };
}

function tokenize(effects: Effects, ok: State, nok: State): State {
  return start;

  function start(code: Code): State {
    if (code === null) {
      return nok(code)!;
    }

    effects.enter('mention');
    effects.consume(code);

    return first;
  }

  function first(code: Code): State {
    if (code === null || !test(LETTER, code)) {
      return nok(code)!;
    }

    effects.consume(code);

    return body;
  }

  function body(code: Code): State {
    if (code !== null && test(WORD, code)) {
      effects.consume(code);
      return body;
    }

    if (code === 45) {
      // `-` is allowed only when followed by an alphanumeric character.
      return hyphen;
    }

    effects.exit('mention');
    return ok(code)!;
  }

  function hyphen(code: Code): State {
    if (code === null || !test(ALPHANUMERIC, code)) {
      return nok(code)!;
    }

    effects.consume(code);

    return body;
  }
}

function test(regex: RegExp, code: number): boolean {
  if (code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    return false;
  }

  return regex.test(String.fromCodePoint(code));
}
