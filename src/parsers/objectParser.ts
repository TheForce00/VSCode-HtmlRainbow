import * as vscode from 'vscode';
import { ParseResult, ColoredRange, HtmlRainbowConfig } from '../types';
import { BaseParser } from './baseParser';

/**
 * Keywords that indicate the following block is NOT an object literal
 */
const BLOCK_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally',
  'with', 'class', 'function', 'async', 'get', 'set',
]);

/**
 * Characters that indicate the following `{` is likely an object literal
 */
const OBJECT_CONTEXT_CHARS = new Set(['=', ':', '(', '[', ',', '?']);

/**
 * Keywords that indicate the following `{` is an object literal
 */
const OBJECT_CONTEXT_KEYWORDS = new Set(['return', '=>']);

interface BraceMatch {
  position: number;
  isObject: boolean;
  depth: number;
}

interface PropertyKeyMatch {
  start: number;
  end: number;
  depth: number;
}

/**
 * Parser for JavaScript/TypeScript object literals
 */
export class ObjectParser extends BaseParser {
  private colorizeKeys: boolean;
  private objectBracesEnabled: boolean;

  constructor(config: HtmlRainbowConfig) {
    super();
    this.colorizeKeys = config.objectBraces.colorizeKeys;
    this.objectBracesEnabled = config.objectBraces.enabled;
  }

  updateConfig(config: HtmlRainbowConfig): void {
    this.colorizeKeys = config.objectBraces.colorizeKeys;
    this.objectBracesEnabled = config.objectBraces.enabled;
  }

  parse(document: vscode.TextDocument): ParseResult {
    if (!this.objectBracesEnabled) {
      return { ranges: [] };
    }

    const text = document.getText();
    const ranges: ColoredRange[] = [];

    const { braces, propertyKeys } = this.findObjectBracesAndKeys(text);

    // Add brace ranges
    for (const brace of braces) {
      if (brace.isObject) {
        ranges.push(this.createColoredRange(document, brace.position, brace.position + 1, brace.depth));
      }
    }

    // Add property key ranges
    if (this.colorizeKeys) {
      for (const key of propertyKeys) {
        ranges.push(this.createColoredRange(document, key.start, key.end, key.depth));
      }
    }

    return { ranges };
  }

  /**
   * Finds all object literal braces and property keys
   */
  private findObjectBracesAndKeys(text: string): { braces: BraceMatch[]; propertyKeys: PropertyKeyMatch[] } {
    const braces: BraceMatch[] = [];
    const propertyKeys: PropertyKeyMatch[] = [];

    let i = 0;
    const braceStack: { isObject: boolean; depth: number }[] = [];

    while (i < text.length) {
      const char = text[i];

      // Skip comments
      if (char === '/' && i + 1 < text.length) {
        if (text[i + 1] === '/') {
          // Single-line comment
          i = this.skipToEndOfLine(text, i);
          continue;
        } else if (text[i + 1] === '*') {
          // Multi-line comment
          i = this.skipBlockComment(text, i);
          continue;
        }
      }

      // Skip strings
      if (char === '"' || char === "'" || char === '`') {
        i = this.skipString(text, i, char);
        continue;
      }

      // Skip regex literals
      if (char === '/' && this.isRegexContext(text, i)) {
        i = this.skipRegex(text, i);
        continue;
      }

      if (char === '{') {
        const isObject = this.isObjectContext(text, i);
        const depth = braceStack.filter(b => b.isObject).length;

        braceStack.push({ isObject, depth });

        if (isObject) {
          braces.push({ position: i, isObject: true, depth });
        }

        i++;
        continue;
      }

      if (char === '}') {
        const context = braceStack.pop();
        if (context && context.isObject) {
          braces.push({ position: i, isObject: true, depth: context.depth });
        }

        i++;
        continue;
      }

      // Look for property keys inside objects
      if (this.colorizeKeys && braceStack.length > 0 && braceStack[braceStack.length - 1].isObject) {
        const keyMatch = this.matchPropertyKey(text, i);
        if (keyMatch) {
          const currentDepth = braceStack.filter(b => b.isObject).length - 1;
          propertyKeys.push({
            start: keyMatch.start,
            end: keyMatch.end,
            depth: currentDepth,
          });
          i = keyMatch.end;
          continue;
        }
      }

      i++;
    }

    return { braces, propertyKeys };
  }

  /**
   * Determines if the current position is an object literal context
   */
  private isObjectContext(text: string, position: number): boolean {
    // Look backward to find the last significant token
    let i = position - 1;

    // Skip whitespace
    while (i >= 0 && /\s/.test(text[i])) {
      i--;
    }

    if (i < 0) {
      return false; // Start of file
    }

    const char = text[i];

    // Check for arrow function
    if (char === '>' && i > 0 && text[i - 1] === '=') {
      return true;
    }

    // Check for object context characters
    if (OBJECT_CONTEXT_CHARS.has(char)) {
      return true;
    }

    // Check for closing paren - need to determine if it's function params or control flow
    if (char === ')') {
      // Look for what preceded the opening paren
      const parenContext = this.getParenContext(text, i);
      if (parenContext === 'control') {
        return false;
      }
      if (parenContext === 'arrow' || parenContext === 'call') {
        return true;
      }
    }

    // Check for keywords
    const keyword = this.getKeywordBefore(text, i);
    if (keyword) {
      if (OBJECT_CONTEXT_KEYWORDS.has(keyword)) {
        return true;
      }
      if (BLOCK_KEYWORDS.has(keyword)) {
        return false;
      }
    }

    // Default: not an object (likely a block)
    return false;
  }

  /**
   * Determines the context of a closing parenthesis
   */
  private getParenContext(text: string, closeParenPos: number): 'control' | 'arrow' | 'call' | 'unknown' {
    // Find matching opening paren
    let depth = 1;
    let i = closeParenPos - 1;

    while (i >= 0 && depth > 0) {
      if (text[i] === ')') depth++;
      else if (text[i] === '(') depth--;
      i--;
    }

    const openParenPos = i + 1;

    // Look before the opening paren
    let j = openParenPos - 1;
    while (j >= 0 && /\s/.test(text[j])) {
      j--;
    }

    if (j < 0) {
      return 'unknown';
    }

    // Check for control flow keywords
    const keyword = this.getKeywordBefore(text, j);
    if (keyword && BLOCK_KEYWORDS.has(keyword)) {
      return 'control';
    }

    // Check for arrow function after the closing paren
    let k = closeParenPos + 1;
    while (k < text.length && /\s/.test(text[k])) {
      k++;
    }
    if (k < text.length - 1 && text[k] === '=' && text[k + 1] === '>') {
      return 'arrow';
    }

    return 'call';
  }

  /**
   * Gets the keyword immediately before the given position
   */
  private getKeywordBefore(text: string, endPos: number): string | null {
    if (endPos < 0 || !/[a-zA-Z]/.test(text[endPos])) {
      return null;
    }

    let start = endPos;
    while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
      start--;
    }

    return text.slice(start, endPos + 1);
  }

  /**
   * Matches a property key at the current position
   */
  private matchPropertyKey(text: string, pos: number): { start: number; end: number } | null {
    // Skip whitespace
    while (pos < text.length && /\s/.test(text[pos])) {
      pos++;
    }

    if (pos >= text.length) {
      return null;
    }

    // Check for identifier
    if (/[a-zA-Z_$]/.test(text[pos])) {
      const start = pos;
      while (pos < text.length && /[a-zA-Z0-9_$]/.test(text[pos])) {
        pos++;
      }
      const end = pos;

      // Skip whitespace
      while (pos < text.length && /\s/.test(text[pos])) {
        pos++;
      }

      // Check for colon (but not ::)
      if (text[pos] === ':' && text[pos + 1] !== ':') {
        return { start, end };
      }
    }

    // Check for string key (quoted property)
    if (text[pos] === '"' || text[pos] === "'") {
      const quote = text[pos];
      const start = pos;
      pos++;
      while (pos < text.length && text[pos] !== quote) {
        if (text[pos] === '\\') pos++;
        pos++;
      }
      if (pos < text.length) {
        pos++; // Include closing quote
        const end = pos;

        // Skip whitespace
        while (pos < text.length && /\s/.test(text[pos])) {
          pos++;
        }

        // Check for colon
        if (text[pos] === ':' && text[pos + 1] !== ':') {
          return { start, end };
        }
      }
    }

    // Check for computed property [expr]:
    if (text[pos] === '[') {
      const start = pos;
      let depth = 1;
      pos++;
      while (pos < text.length && depth > 0) {
        if (text[pos] === '[') depth++;
        else if (text[pos] === ']') depth--;
        pos++;
      }
      const end = pos;

      // Skip whitespace
      while (pos < text.length && /\s/.test(text[pos])) {
        pos++;
      }

      // Check for colon
      if (text[pos] === ':' && text[pos + 1] !== ':') {
        return { start, end };
      }
    }

    return null;
  }

  /**
   * Skips to the end of a single-line comment
   */
  private skipToEndOfLine(text: string, pos: number): number {
    while (pos < text.length && text[pos] !== '\n') {
      pos++;
    }
    return pos + 1;
  }

  /**
   * Skips a block comment
   */
  private skipBlockComment(text: string, pos: number): number {
    pos += 2; // Skip /*
    while (pos < text.length - 1) {
      if (text[pos] === '*' && text[pos + 1] === '/') {
        return pos + 2;
      }
      pos++;
    }
    return text.length;
  }

  /**
   * Skips a string literal
   */
  private skipString(text: string, pos: number, quote: string): number {
    pos++; // Skip opening quote

    if (quote === '`') {
      // Template literal - handle ${} interpolation
      while (pos < text.length) {
        if (text[pos] === '\\') {
          pos += 2;
          continue;
        }
        if (text[pos] === '`') {
          return pos + 1;
        }
        if (text[pos] === '$' && text[pos + 1] === '{') {
          // Skip interpolation
          pos += 2;
          let depth = 1;
          while (pos < text.length && depth > 0) {
            if (text[pos] === '{') depth++;
            else if (text[pos] === '}') depth--;
            else if (text[pos] === '`') {
              // Nested template literal
              pos = this.skipString(text, pos, '`');
              continue;
            }
            pos++;
          }
          continue;
        }
        pos++;
      }
    } else {
      // Regular string
      while (pos < text.length) {
        if (text[pos] === '\\') {
          pos += 2;
          continue;
        }
        if (text[pos] === quote) {
          return pos + 1;
        }
        if (text[pos] === '\n' && quote !== '`') {
          // Unterminated string
          return pos;
        }
        pos++;
      }
    }

    return pos;
  }

  /**
   * Determines if a / is likely starting a regex literal
   */
  private isRegexContext(text: string, pos: number): boolean {
    // Look backward for context
    let i = pos - 1;
    while (i >= 0 && /\s/.test(text[i])) {
      i--;
    }

    if (i < 0) {
      return true; // Start of file, could be regex
    }

    const char = text[i];

    // After these, / is likely a regex
    const regexContextChars = new Set(['(', '[', '{', ',', ';', ':', '=', '!', '&', '|', '?', '+', '-', '~', '^']);
    if (regexContextChars.has(char)) {
      return true;
    }

    // After certain keywords, / is likely a regex
    const keyword = this.getKeywordBefore(text, i);
    if (keyword && ['return', 'case', 'throw', 'in', 'typeof', 'instanceof', 'void', 'delete', 'new'].includes(keyword)) {
      return true;
    }

    return false;
  }

  /**
   * Skips a regex literal
   */
  private skipRegex(text: string, pos: number): number {
    pos++; // Skip opening /

    while (pos < text.length) {
      if (text[pos] === '\\') {
        pos += 2;
        continue;
      }
      if (text[pos] === '/') {
        pos++;
        // Skip flags
        while (pos < text.length && /[gimsuy]/.test(text[pos])) {
          pos++;
        }
        return pos;
      }
      if (text[pos] === '\n') {
        // Unterminated regex
        return pos;
      }
      if (text[pos] === '[') {
        // Character class - skip until ]
        pos++;
        while (pos < text.length && text[pos] !== ']') {
          if (text[pos] === '\\') pos++;
          pos++;
        }
      }
      pos++;
    }

    return pos;
  }
}
