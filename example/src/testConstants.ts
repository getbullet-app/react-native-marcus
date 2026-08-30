const LOCAL_URL = 'http://localhost:8081/';

// Valid CommonMark that exercises every range type the native formatter styles:
// h1, bold, italic, strikethrough, code, pre, blockquote, link, emoji, the three mention
// kinds, and the syntax delimiters around all of them.
//
// ExpensiMark reads some of this differently (it treats *single asterisks* as bold and
// ~single tildes~ as strikethrough), which is exactly what the parser toggle is for.
const EXAMPLE_CONTENT = [
  '# Marcus',
  '',
  'A paragraph with **bold**, *italic*, **bold around *nested italic* inside**,',
  '~~strikethrough~~ and `inline code`, a bare link https://expensify.com,',
  'a [labelled link](https://expensify.com), emoji 😀🍕🍔, and mentions for',
  '@here, @someone@swmansion.com and #mention-report.',
  '',
  '> Blockquotes keep their **formatting**, including *italic* and `code`.',
  '',
  '```',
  'const ranges = parseMarkdown(text);',
  '```',
].join('\n');

const INPUT_ID = 'MarkdownInput_Example';
const INPUT_HISTORY_DEBOUNCE_TIME_MS = 150;
const TOGGLE_LINK_COLOR = 'toggle-link-color';
const CHANGE_SELECTION = 'change-selection';
const SELECTION_END = 20;

export {
  LOCAL_URL,
  EXAMPLE_CONTENT,
  INPUT_ID,
  INPUT_HISTORY_DEBOUNCE_TIME_MS,
  TOGGLE_LINK_COLOR,
  CHANGE_SELECTION,
  SELECTION_END,
};
