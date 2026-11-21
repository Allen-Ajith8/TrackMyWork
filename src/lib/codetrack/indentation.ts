import type { CodeLanguage } from '@/types/codetrack';

/**
 * Returns the standard indentation string for a given programming language.
 * Python, C++, Java use 4 spaces; JavaScript, TypeScript use 2 spaces.
 */
export function getIndentUnit(language: CodeLanguage): string {
  if (language === 'javascript' || language === 'typescript') {
    return '  ';
  }
  return '    ';
}

export interface IndentResult {
  newCode: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Handles Tab key in code editor:
 * - If text is selected (single or multi-line): indents each selected line.
 * - If no text is selected: inserts indent unit at the cursor position.
 */
export function handleTabKey(
  code: string,
  selectionStart: number,
  selectionEnd: number,
  language: CodeLanguage
): IndentResult {
  const indentUnit = getIndentUnit(language);

  // If there's a multi-line selection or multi-character selection
  if (selectionStart !== selectionEnd) {
    const startLineIndex = code.lastIndexOf('\n', selectionStart - 1) + 1;
    let endLineIndex = code.indexOf('\n', selectionEnd);
    if (endLineIndex === -1) endLineIndex = code.length;

    const beforeSelectedLines = code.slice(0, startLineIndex);
    const selectedLinesText = code.slice(startLineIndex, endLineIndex);
    const afterSelectedLines = code.slice(endLineIndex);

    const lines = selectedLinesText.split('\n');
    const indentedLines = lines.map((line) => indentUnit + line);
    const newSelectedLinesText = indentedLines.join('\n');

    const addedCharsPerLine = indentUnit.length;
    const totalAddedChars = addedCharsPerLine * lines.length;

    return {
      newCode: beforeSelectedLines + newSelectedLinesText + afterSelectedLines,
      selectionStart: selectionStart + addedCharsPerLine,
      selectionEnd: selectionEnd + totalAddedChars,
    };
  }

  // Single cursor position: insert indentUnit
  return {
    newCode: code.slice(0, selectionStart) + indentUnit + code.slice(selectionEnd),
    selectionStart: selectionStart + indentUnit.length,
    selectionEnd: selectionStart + indentUnit.length,
  };
}

/**
 * Handles Shift+Tab key in code editor:
 * - Unindents current line or selected lines by removing up to indentUnit.length leading spaces.
 */
export function handleShiftTabKey(
  code: string,
  selectionStart: number,
  selectionEnd: number,
  language: CodeLanguage
): IndentResult {
  const indentUnit = getIndentUnit(language);
  const indentSize = indentUnit.length;

  const startLineIndex = code.lastIndexOf('\n', selectionStart - 1) + 1;
  let endLineIndex = code.indexOf('\n', selectionEnd);
  if (endLineIndex === -1) endLineIndex = code.length;

  const beforeSelectedLines = code.slice(0, startLineIndex);
  const selectedLinesText = code.slice(startLineIndex, endLineIndex);
  const afterSelectedLines = code.slice(endLineIndex);

  const lines = selectedLinesText.split('\n');
  let firstLineRemoved = 0;
  let totalRemovedChars = 0;

  const unindentedLines = lines.map((line, idx) => {
    let spacesToRemove = 0;
    for (let i = 0; i < Math.min(indentSize, line.length); i++) {
      if (line[i] === ' ') {
        spacesToRemove++;
      } else if (line[i] === '\t') {
        spacesToRemove = 1;
        break;
      } else {
        break;
      }
    }

    if (idx === 0) {
      firstLineRemoved = spacesToRemove;
    }
    totalRemovedChars += spacesToRemove;

    return line.slice(spacesToRemove);
  });

  const newSelectedLinesText = unindentedLines.join('\n');

  return {
    newCode: beforeSelectedLines + newSelectedLinesText + afterSelectedLines,
    selectionStart: Math.max(startLineIndex, selectionStart - firstLineRemoved),
    selectionEnd: Math.max(startLineIndex, selectionEnd - totalRemovedChars),
  };
}

/**
 * Handles Enter key with auto-indentation:
 * - Preserves leading indentation of current line.
 * - Increases indentation if current line opens a block (ends with `:` in Python or `{`, `(`, `[` in JS/TS/C++/Java).
 * - Expands braces if Enter is pressed between `{}` or `()`.
 */
export function handleEnterKey(
  code: string,
  selectionStart: number,
  selectionEnd: number,
  language: CodeLanguage
): IndentResult {
  const indentUnit = getIndentUnit(language);

  // Line up to cursor
  const beforeCursor = code.slice(0, selectionStart);
  const afterCursor = code.slice(selectionEnd);

  const lastNewlineIndex = beforeCursor.lastIndexOf('\n');
  const currentLine = beforeCursor.slice(lastNewlineIndex + 1);

  // Extract current line leading whitespace
  const indentMatch = currentLine.match(/^(\s*)/);
  let baseIndent = indentMatch ? indentMatch[1] : '';

  // Clean comment from currentLine for block detection
  const cleanLine = currentLine.replace(/\/\/.*$/, '').replace(/#.*$/, '').trimEnd();

  // Detect whether to increase indentation
  let shouldIncreaseIndent = false;

  if (language === 'python') {
    if (cleanLine.endsWith(':')) {
      shouldIncreaseIndent = true;
    }
  } else {
    // C++, Java, JS, TS
    if (cleanLine.endsWith('{') || cleanLine.endsWith('(') || cleanLine.endsWith('[')) {
      shouldIncreaseIndent = true;
    }
  }

  // Check if cursor is right between matching brackets: {|} or (|) or [|]
  const charBefore = cleanLine.slice(-1);
  const charAfter = afterCursor.trimStart()[0];
  const isBetweenBrackets =
    (charBefore === '{' && charAfter === '}') ||
    (charBefore === '(' && charAfter === ')') ||
    (charBefore === '[' && charAfter === ']');

  if (isBetweenBrackets) {
    const extraIndent = baseIndent + indentUnit;
    const insertion = '\n' + extraIndent + '\n' + baseIndent;
    return {
      newCode: beforeCursor + insertion + afterCursor,
      selectionStart: beforeCursor.length + 1 + extraIndent.length,
      selectionEnd: beforeCursor.length + 1 + extraIndent.length,
    };
  }

  const nextIndent = shouldIncreaseIndent ? baseIndent + indentUnit : baseIndent;
  const insertion = '\n' + nextIndent;

  return {
    newCode: beforeCursor + insertion + afterCursor,
    selectionStart: beforeCursor.length + insertion.length,
    selectionEnd: beforeCursor.length + insertion.length,
  };
}

/**
 * Handles Backspace with smart unindent:
 * - If cursor is preceded only by spaces on current line, deletes a full indent unit of spaces.
 */
export function handleBackspaceKey(
  code: string,
  selectionStart: number,
  selectionEnd: number,
  language: CodeLanguage
): IndentResult | null {
  // Only handle when no text is highlighted
  if (selectionStart !== selectionEnd) return null;

  const beforeCursor = code.slice(0, selectionStart);
  const lineStart = beforeCursor.lastIndexOf('\n') + 1;
  const lineBeforeCursor = beforeCursor.slice(lineStart);

  // If the characters before cursor on the current line are exclusively spaces
  if (lineBeforeCursor.length > 0 && /^[ ]+$/.test(lineBeforeCursor)) {
    const indentSize = getIndentUnit(language).length;
    const deleteCount = lineBeforeCursor.length % indentSize === 0 ? indentSize : lineBeforeCursor.length % indentSize;

    return {
      newCode: code.slice(0, selectionStart - deleteCount) + code.slice(selectionStart),
      selectionStart: selectionStart - deleteCount,
      selectionEnd: selectionStart - deleteCount,
    };
  }

  return null;
}

/**
 * Handles bracket and quote auto-closing:
 * - Wraps selection if text is highlighted.
 * - Auto-inserts matching closing bracket/quote.
 * - Skips over closing bracket if typed when cursor is already before it.
 */
export function handleBracketAutoClose(
  code: string,
  selectionStart: number,
  selectionEnd: number,
  key: string
): IndentResult | null {
  const PAIRS: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
    '`': '`',
  };

  const CLOSING_CHARS = new Set([')', ']', '}', '"', "'", '`']);

  // Case 1: Step over existing closing char if user types it
  if (selectionStart === selectionEnd && CLOSING_CHARS.has(key)) {
    if (code[selectionStart] === key) {
      return {
        newCode: code,
        selectionStart: selectionStart + 1,
        selectionEnd: selectionStart + 1,
      };
    }
  }

  // Case 2: Auto-close opening pair
  if (PAIRS[key]) {
    const openChar = key;
    const closeChar = PAIRS[key];

    if (selectionStart !== selectionEnd) {
      // Wrap selection
      const selected = code.slice(selectionStart, selectionEnd);
      return {
        newCode: code.slice(0, selectionStart) + openChar + selected + closeChar + code.slice(selectionEnd),
        selectionStart: selectionStart + 1,
        selectionEnd: selectionEnd + 1,
      };
    }

    // Insert pair and place cursor in between
    return {
      newCode: code.slice(0, selectionStart) + openChar + closeChar + code.slice(selectionEnd),
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1,
    };
  }

  return null;
}

/**
 * Formats and normalizes code indentation across languages.
 * Fixes mixed tabs/spaces, corrects Python colon indentation nesting,
 * and handles C++/Java/JS/TS curly brace nesting.
 */
export function formatCode(source: string, language: CodeLanguage): string {
  if (!source || !source.trim()) return source;

  // 1. Normalize tabs to 4 spaces and trim trailing carriage returns
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    ');
  const lines = normalized.split('\n');
  const indentUnit = getIndentUnit(language);

  if (language === 'python') {
    return formatPythonCode(lines);
  }

  // C++, Java, JS, TS formatting based on braces
  return formatBraceCode(lines, indentUnit);
}

/**
 * Python-specific code indenter:
 * - Detects class, def, if, for, while, try, except, with blocks ending in ':'.
 * - Preserves docstrings and comments.
 * - Normalizes indentation multiples of 4.
 */
function formatPythonCode(lines: string[]): string {
  const result: string[] = [];
  let currentIndent = 0;
  let inDocstring = false;
  let docstringDelimiter = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Preserve empty lines
    if (!trimmed) {
      result.push('');
      continue;
    }

    // Check for multi-line docstring toggle (''' or """)
    const tripleQuoteMatch = trimmed.match(/^("""|''')/);
    if (tripleQuoteMatch && !inDocstring) {
      inDocstring = true;
      docstringDelimiter = tripleQuoteMatch[1];
      result.push('    '.repeat(currentIndent) + trimmed);
      // Check if docstring closes on same line
      if (trimmed.length > 3 && trimmed.slice(3).includes(docstringDelimiter)) {
        inDocstring = false;
      }
      continue;
    } else if (inDocstring) {
      result.push('    '.repeat(currentIndent) + trimmed);
      if (trimmed.includes(docstringDelimiter)) {
        inDocstring = false;
      }
      continue;
    }

    // Dedent triggers for Python: elif, else, except, finally
    if (/^(elif\b|else:|except\b|finally:)/.test(trimmed)) {
      currentIndent = Math.max(0, currentIndent - 1);
    }

    // Top-level declarations
    if (/^(class\s|import\s|from\s)/.test(trimmed)) {
      currentIndent = 0;
    } else if (/^def\s/.test(trimmed) && result.some((l) => l.trim().startsWith('class '))) {
      // Method inside class
      currentIndent = 1;
    }

    const formattedLine = '    '.repeat(currentIndent) + trimmed;
    result.push(formattedLine);

    // Increase indent for next line if ends with ':'
    const cleanForColon = trimmed.replace(/#.*$/, '').trimEnd();
    if (cleanForColon.endsWith(':')) {
      currentIndent++;
    }
  }

  return result.join('\n');
}

/**
 * Curly-brace language indenter (JS, TS, C++, Java)
 */
function formatBraceCode(lines: string[], indentUnit: string): string {
  const result: string[] = [];
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      result.push('');
      continue;
    }

    // Count opening and closing braces on this line
    let opens = 0;
    let closes = 0;
    for (const char of trimmed) {
      if (char === '{') opens++;
      if (char === '}') closes++;
    }

    // If line starts with closing brace, reduce depth before formatting this line
    if (trimmed.startsWith('}')) {
      depth = Math.max(0, depth - 1);
    }

    result.push(indentUnit.repeat(depth) + trimmed);

    // Adjust depth for subsequent lines
    if (trimmed.startsWith('}')) {
      // already accounted for initial '}'
      depth += opens - (closes - 1);
    } else {
      depth += opens - closes;
    }
    if (depth < 0) depth = 0;
  }

  return result.join('\n');
}

/**
 * Locates the line index of the method closing brace in curly-brace languages (C++, Java, JS, TS).
 * For class-based solutions (C++, Java), finds the closing brace right before the class closing brace `};` or `}`.
 * For standalone functions (JS, TS), finds the function's closing brace `}`.
 */
/**
 * Locates the line index of the method closing brace in curly-brace languages (C++, Java, JS, TS).
 * For class-based solutions (C++, Java), finds the closing brace right before the class closing brace `};` or `}`.
 * For standalone functions (JS, TS), finds the function's closing brace `}`.
 */
function findMethodClosingBraceIndex(lines: string[]): number {
  const classCloseIdx = lines.findLastIndex((l) => /^\s*\}(?:;)?\s*$/.test(l));
  if (classCloseIdx === -1) {
    return lines.findLastIndex((l) => /^\s*\}\s*$/.test(l));
  }

  // The method closing brace is the last `}` before classCloseIdx
  for (let i = classCloseIdx - 1; i >= 0; i--) {
    if (/^\s*\}\s*$/.test(lines[i])) {
      return i;
    }
  }

  return classCloseIdx;
}

/**
 * Repairs code where statements or comments were accidentally placed outside function or class braces.
 * - For C++ and Java: Nothing valid can exist after the class closing brace `};` or `}`.
 *   Extracts any valid statements that were stranded after the class closing brace and moves them
 *   inside the method body, discarding stray Python lines and leftover comments.
 * - For JS/TS: Moves any stranded statements inside the function body.
 */
export function repairStrandedCode(code: string, language: CodeLanguage): string {
  if (language === 'python') return code;

  // Normalize line endings
  const normalized = code.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  // Locate the outermost class or function closing brace `};` or `}`
  const classCloseIdx = lines.findLastIndex((l) => /^\s*\}(?:;)?\s*$/.test(l));
  if (classCloseIdx === -1) return code;

  // Check if there are any non-empty lines after the class closing brace
  const trailingLines = lines.slice(classCloseIdx + 1);
  const hasTrailingContent = trailingLines.some((l) => l.trim().length > 0);
  if (!hasTrailingContent) return code;

  // Filter trailing lines: discard python remnants and comments, keep real code statements
  const validTrailing: string[] = [];
  for (const l of trailingLines) {
    const trimmed = l.trim();
    if (!trimmed) continue;
    // Discard python leftovers, stray keywords, or comments
    if (
      /^(?:n\s*=\s*len|m\s*,\s*n\s*=|for\s+.*in\s+range|for\s+.*in\s+matrix|return\s+res$|pass$|#|\/\/)/i.test(
        trimmed
      )
    ) {
      continue;
    }
    validTrailing.push(trimmed);
  }

  // Truncate lines up to the class closing brace (completely strip trailing junk)
  const cleanLines = lines.slice(0, classCloseIdx + 1);

  // Find method closing brace in cleanLines (the last `}` before class closing brace)
  let methodCloseIdx = -1;
  for (let i = cleanLines.length - 2; i >= 0; i--) {
    if (/^\s*\}\s*$/.test(cleanLines[i])) {
      methodCloseIdx = i;
      break;
    }
  }

  if (methodCloseIdx === -1) {
    methodCloseIdx = cleanLines.length - 1;
  }

  // If there are valid statements that were stranded outside, move them inside the method!
  if (validTrailing.length > 0) {
    const hasClass = cleanLines.some((l) => /^\s*(class|interface)\b/.test(l));
    const baseIndent = hasClass ? '        ' : '    ';

    const existingMethodBody = cleanLines.slice(0, methodCloseIdx).join('\n');
    const statementsToInsert = validTrailing
      .filter((s) => !existingMethodBody.includes(s))
      .map((s) => baseIndent + s);

    if (statementsToInsert.length > 0) {
      if (methodCloseIdx > 0 && cleanLines[methodCloseIdx - 1].trim() === '') {
        cleanLines.splice(methodCloseIdx - 1, 1, ...statementsToInsert);
      } else {
        cleanLines.splice(methodCloseIdx, 0, ...statementsToInsert);
      }
    }
  }

  return cleanLines.join('\n');
}

/**
 * Intelligently inserts a code snippet (e.g. from Next Line Agent Help):
 * - Replaces empty starter placeholder lines like 'pass' or '# TODO...' / '// TODO...'
 * - For C++, Java, JS, TS: inserts INSIDE the method braces { ... }, never outside the class!
 * - Filters out comments, ensuring only real executable code is inserted.
 * - Cleans up any existing repeated boilerplate comment lines.
 * - Indents multi-line snippets with the method's base indentation level.
 * - Prevents inserting identical duplicate lines consecutively.
 */
export function smartInsertSnippet(
  existingCode: string,
  snippet: string,
  language: CodeLanguage
): string {
  if (!snippet.trim()) return existingCode;

  // 1. First, repair any existing stranded code outside braces
  const repairedCode = repairStrandedCode(existingCode, language);

  // 2. Filter out comments: snippet must be pure executable code
  const cleanSnippet = snippet
    .split('\n')
    .filter((l) => !l.trim().startsWith('#') && !l.trim().startsWith('//'))
    .join('\n')
    .trimEnd();

  if (!cleanSnippet) return repairedCode;

  // 3. For Curly-Brace Languages (C++, Java, JS, TS): INSERT INSIDE METHOD BRACES
  if (language !== 'python') {
    const lines = repairedCode.split('\n');
    const hasClass = lines.some((l) => /^\s*(class|interface)\b/.test(l));
    const baseIndent = hasClass ? '        ' : '    '; // 8 spaces for class method, 4 for standalone

    // Prepare snippet lines with baseIndent
    const snippetLines = cleanSnippet.split('\n').map((line) => {
      const t = line.trim();
      if (!t) return '';
      const relMatch = line.match(/^(\s*)/);
      const relIndent = relMatch ? relMatch[1] : '';
      return baseIndent + relIndent + t;
    });
    const formattedSnippet = snippetLines.join('\n');

    // Prevent inserting duplicate snippet if already present inside
    if (repairedCode.includes(cleanSnippet.trim())) {
      return repairedCode;
    }

    // Check if there is a placeholder comment inside the method
    const todoIdx = lines.findIndex(
      (l) =>
        l.trim().startsWith('// TODO') ||
        l.trim().startsWith('/* TODO') ||
        l.trim().startsWith('// Optimal')
    );
    if (todoIdx !== -1) {
      lines.splice(todoIdx, 1, formattedSnippet);
      return lines.join('\n');
    }

    // Find the method's closing brace and insert right before it
    const closingBraceIdx = findMethodClosingBraceIndex(lines);
    if (closingBraceIdx !== -1) {
      // If the line immediately preceding the closing brace is empty, replace it
      if (closingBraceIdx > 0 && lines[closingBraceIdx - 1].trim() === '') {
        lines.splice(closingBraceIdx - 1, 1, formattedSnippet);
      } else {
        lines.splice(closingBraceIdx, 0, formattedSnippet);
      }
      return lines.join('\n');
    }

    return lines.join('\n');
  }

  // 4. For Python: Indent inside method body (8 spaces)
  const lines = repairedCode.split('\n');
  const baseIndent = '        ';
  const snippetLines = cleanSnippet.split('\n').map((line) => {
    const t = line.trim();
    if (!t) return '';
    const relMatch = line.match(/^(\s*)/);
    const relIndent = relMatch ? relMatch[1] : '';
    return baseIndent + relIndent + t;
  });
  const formattedSnippet = snippetLines.join('\n');

  // Check if existing code contains placeholder pass or TODO at the end
  const lastNonEmptyIdx = lines.findLastIndex((l) => l.trim().length > 0);

  if (lastNonEmptyIdx !== -1) {
    const lastLine = lines[lastNonEmptyIdx].trim();
    if (lastLine === 'pass' || lastLine.startsWith('# TODO') || lastLine.startsWith('// TODO')) {
      // If the preceding line is a placeholder TODO comment, remove it as well
      let removeStart = lastNonEmptyIdx;
      if (lastLine === 'pass' && lastNonEmptyIdx > 0) {
        const prevLine = lines[lastNonEmptyIdx - 1].trim();
        if (
          prevLine.startsWith('# TODO') ||
          prevLine.startsWith('// TODO') ||
          prevLine.startsWith('# Initialize state') ||
          prevLine.startsWith('// Initialize state')
        ) {
          removeStart = lastNonEmptyIdx - 1;
        }
      }
      lines.splice(removeStart, lastNonEmptyIdx - removeStart + 1, formattedSnippet);
      return lines.join('\n');
    }
  }

  // Prevent inserting duplicate snippet if already at the end
  if (repairedCode.trimEnd().endsWith(cleanSnippet.trim())) {
    return repairedCode;
  }

  return repairedCode.trimEnd() + '\n' + formattedSnippet;
}
