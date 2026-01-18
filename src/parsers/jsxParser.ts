import * as vscode from 'vscode';
import { ParseResult, ColoredRange, HtmlRainbowConfig } from '../types';
import { BaseParser } from './baseParser';

/**
 * Token types for JSX parsing
 */
enum TokenType {
  JsxOpenStart,     // <Component or <div
  JsxOpenEnd,       // > after opening tag
  JsxClose,         // </Component> or </div>
  JsxSelfClose,     // />
  ExpressionStart,  // { in JSX context
  ExpressionEnd,    // } in JSX context
  ObjectBrace,      // { or } inside JS expression (object literal)
  PropertyKey,      // key in object literal
}

interface Token {
  type: TokenType;
  start: number;
  end: number;
  depth: number;
  tagName?: string;
}

/**
 * Parser for JSX and TSX files
 * Handles both JSX tags and JavaScript expressions with unified depth tracking
 */
export class JsxParser extends BaseParser {
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
    const text = document.getText();
    const ranges: ColoredRange[] = [];

    const tokens = this.tokenize(text);

    for (const token of tokens) {
      ranges.push(this.createColoredRange(document, token.start, token.end, token.depth));
    }

    return { ranges };
  }

  /**
   * Tokenizes the JSX document into colorizable tokens
   */
  private tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    let depth = 0;
    const tagStack: string[] = [];
    let inJsxExpression = false;
    let jsxExpressionBraceDepth = 0;
    const objectBraceStack: number[] = []; // tracks depth at which each object brace was opened

    while (i < text.length) {
      // Skip comments
      if (text[i] === '/' && i + 1 < text.length) {
        if (text[i + 1] === '/') {
          i = this.skipToEndOfLine(text, i);
          continue;
        } else if (text[i + 1] === '*') {
          i = this.skipBlockComment(text, i);
          continue;
        }
      }

      // Skip strings (outside of JSX tags)
      if ((text[i] === '"' || text[i] === "'" || text[i] === '`') && !this.isInsideJsxTag(text, i)) {
        i = this.skipString(text, i, text[i]);
        continue;
      }

      // Handle JSX expression braces
      if (inJsxExpression) {
        if (text[i] === '{') {
          // Check if this is an object literal
          if (this.objectBracesEnabled && this.isObjectContext(text, i)) {
            objectBraceStack.push(depth);
            tokens.push({
              type: TokenType.ObjectBrace,
              start: i,
              end: i + 1,
              depth: depth,
            });
            depth++;
          }
          jsxExpressionBraceDepth++;
          i++;
          continue;
        }

        if (text[i] === '}') {
          jsxExpressionBraceDepth--;

          if (jsxExpressionBraceDepth === 0) {
            // End of JSX expression
            inJsxExpression = false;
            tokens.push({
              type: TokenType.ExpressionEnd,
              start: i,
              end: i + 1,
              depth: depth - 1, // Expression braces are at the parent depth
            });
          } else if (objectBraceStack.length > 0) {
            // Closing object brace
            const braceDepth = objectBraceStack.pop()!;
            depth--;
            tokens.push({
              type: TokenType.ObjectBrace,
              start: i,
              end: i + 1,
              depth: braceDepth,
            });
          }
          i++;
          continue;
        }

        // Look for property keys inside objects
        if (this.colorizeKeys && objectBraceStack.length > 0) {
          const keyMatch = this.matchPropertyKey(text, i);
          if (keyMatch) {
            tokens.push({
              type: TokenType.PropertyKey,
              start: keyMatch.start,
              end: keyMatch.end,
              depth: depth - 1,
            });
            i = keyMatch.end;
            continue;
          }
        }

        // Skip strings inside expressions
        if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
          i = this.skipString(text, i, text[i]);
          continue;
        }

        i++;
        continue;
      }

      // Check for JSX tag start
      if (text[i] === '<') {
        // Check for closing tag
        if (text[i + 1] === '/') {
          const closeTag = this.parseClosingTag(text, i);
          if (closeTag) {
            // Find matching opening tag
            const matchIndex = this.findMatchingOpenTag(tagStack, closeTag.tagName);
            if (matchIndex !== -1) {
              // Pop all tags up to and including the match
              const poppedCount = tagStack.length - matchIndex;
              tagStack.splice(matchIndex);
              depth -= poppedCount;
            }

            // Color the closing tag at current depth
            tokens.push({
              type: TokenType.JsxClose,
              start: i,
              end: i + 2, // </
              depth: depth,
              tagName: closeTag.tagName,
            });

            tokens.push({
              type: TokenType.JsxClose,
              start: closeTag.nameStart,
              end: closeTag.nameEnd,
              depth: depth,
              tagName: closeTag.tagName,
            });

            tokens.push({
              type: TokenType.JsxClose,
              start: closeTag.end - 1,
              end: closeTag.end, // >
              depth: depth,
            });

            i = closeTag.end;
            continue;
          }
        }

        // Check for opening tag
        const openTag = this.parseOpeningTag(text, i);
        if (openTag) {
          const currentDepth = depth;

          // Color the < bracket
          tokens.push({
            type: TokenType.JsxOpenStart,
            start: i,
            end: i + 1,
            depth: currentDepth,
            tagName: openTag.tagName,
          });

          // Color the tag name
          tokens.push({
            type: TokenType.JsxOpenStart,
            start: openTag.nameStart,
            end: openTag.nameEnd,
            depth: currentDepth,
            tagName: openTag.tagName,
          });

          if (openTag.selfClosing) {
            // Self-closing tag: />
            tokens.push({
              type: TokenType.JsxSelfClose,
              start: openTag.end - 2,
              end: openTag.end,
              depth: currentDepth,
            });
          } else {
            // Regular opening tag: >
            tokens.push({
              type: TokenType.JsxOpenEnd,
              start: openTag.end - 1,
              end: openTag.end,
              depth: currentDepth,
            });

            tagStack.push(openTag.tagName);
            depth++;
          }

          i = openTag.end;
          continue;
        }
      }

      // Check for JSX expression start { (only when in JSX context)
      if (text[i] === '{' && tagStack.length > 0) {
        inJsxExpression = true;
        jsxExpressionBraceDepth = 1;

        tokens.push({
          type: TokenType.ExpressionStart,
          start: i,
          end: i + 1,
          depth: depth - 1, // Expression braces are at the parent depth
        });

        i++;
        continue;
      }

      // Handle object braces in pure JS context (outside JSX)
      if (this.objectBracesEnabled && text[i] === '{' && tagStack.length === 0) {
        if (this.isObjectContext(text, i)) {
          tokens.push({
            type: TokenType.ObjectBrace,
            start: i,
            end: i + 1,
            depth: depth,
          });
          objectBraceStack.push(depth);
          depth++;
        }
        i++;
        continue;
      }

      if (this.objectBracesEnabled && text[i] === '}' && tagStack.length === 0 && objectBraceStack.length > 0) {
        const braceDepth = objectBraceStack.pop()!;
        depth--;
        tokens.push({
          type: TokenType.ObjectBrace,
          start: i,
          end: i + 1,
          depth: braceDepth,
        });
        i++;
        continue;
      }

      // Look for property keys in pure JS context
      if (this.colorizeKeys && tagStack.length === 0 && objectBraceStack.length > 0) {
        const keyMatch = this.matchPropertyKey(text, i);
        if (keyMatch) {
          tokens.push({
            type: TokenType.PropertyKey,
            start: keyMatch.start,
            end: keyMatch.end,
            depth: depth - 1,
          });
          i = keyMatch.end;
          continue;
        }
      }

      i++;
    }

    return tokens;
  }

  /**
   * Parses an opening JSX tag starting at the given position
   */
  private parseOpeningTag(text: string, pos: number): { tagName: string; nameStart: number; nameEnd: number; end: number; selfClosing: boolean } | null {
    if (text[pos] !== '<') {
      return null;
    }

    // Check for valid tag start (letter or component name)
    const nameStart = pos + 1;
    if (!/[a-zA-Z_]/.test(text[nameStart])) {
      return null;
    }

    // Parse tag name (including dots for namespaced components like Foo.Bar)
    let nameEnd = nameStart;
    while (nameEnd < text.length && /[a-zA-Z0-9._-]/.test(text[nameEnd])) {
      nameEnd++;
    }

    const tagName = text.slice(nameStart, nameEnd);

    // Find end of tag
    let i = nameEnd;
    let inString = false;
    let stringChar = '';

    while (i < text.length) {
      const char = text[i];

      if (inString) {
        if (char === stringChar && text[i - 1] !== '\\') {
          inString = false;
        }
        i++;
        continue;
      }

      if (char === '"' || char === "'" || char === '{') {
        if (char === '{') {
          // Skip JSX attribute expression
          i = this.skipJsxExpression(text, i);
          continue;
        }
        inString = true;
        stringChar = char;
        i++;
        continue;
      }

      if (char === '/') {
        if (text[i + 1] === '>') {
          return { tagName, nameStart, nameEnd, end: i + 2, selfClosing: true };
        }
      }

      if (char === '>') {
        return { tagName, nameStart, nameEnd, end: i + 1, selfClosing: false };
      }

      if (char === '<') {
        // Malformed tag
        return null;
      }

      i++;
    }

    return null;
  }

  /**
   * Parses a closing JSX tag starting at the given position
   */
  private parseClosingTag(text: string, pos: number): { tagName: string; nameStart: number; nameEnd: number; end: number } | null {
    if (text[pos] !== '<' || text[pos + 1] !== '/') {
      return null;
    }

    const nameStart = pos + 2;

    // Skip whitespace
    let i = nameStart;
    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }

    const actualNameStart = i;

    // Parse tag name
    if (!/[a-zA-Z_]/.test(text[i])) {
      return null;
    }

    while (i < text.length && /[a-zA-Z0-9._-]/.test(text[i])) {
      i++;
    }

    const tagName = text.slice(actualNameStart, i);
    const nameEnd = i;

    // Skip whitespace and find >
    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }

    if (text[i] !== '>') {
      return null;
    }

    return { tagName, nameStart: actualNameStart, nameEnd, end: i + 1 };
  }

  /**
   * Skips a JSX expression {...}
   */
  private skipJsxExpression(text: string, pos: number): number {
    if (text[pos] !== '{') {
      return pos + 1;
    }

    let depth = 1;
    let i = pos + 1;

    while (i < text.length && depth > 0) {
      const char = text[i];

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
      } else if (char === '"' || char === "'" || char === '`') {
        i = this.skipString(text, i, char);
        continue;
      }

      i++;
    }

    return i;
  }

  /**
   * Checks if position is inside a JSX tag (for attribute parsing)
   */
  private isInsideJsxTag(_text: string, _pos: number): boolean {
    // Simplified check - in a real implementation would need to track state
    return false;
  }

  /**
   * Determines if the current position is an object literal context
   */
  private isObjectContext(text: string, position: number): boolean {
    let i = position - 1;

    while (i >= 0 && /\s/.test(text[i])) {
      i--;
    }

    if (i < 0) {
      return false;
    }

    const char = text[i];

    // After arrow function
    if (char === '>' && i > 0 && text[i - 1] === '=') {
      return true;
    }

    // After these characters, likely an object
    const objectContextChars = new Set(['=', ':', '(', '[', ',', '?', '(']);
    if (objectContextChars.has(char)) {
      return true;
    }

    // After return keyword
    const keyword = this.getKeywordBefore(text, i);
    if (keyword === 'return') {
      return true;
    }

    return false;
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
   * Finds the index of a matching opening tag in the stack
   */
  private findMatchingOpenTag(stack: string[], tagName: string): number {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i] === tagName) {
        return i;
      }
    }
    return -1;
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
    pos += 2;
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
    pos++;

    while (pos < text.length) {
      if (text[pos] === '\\') {
        pos += 2;
        continue;
      }
      if (text[pos] === quote) {
        return pos + 1;
      }
      if (text[pos] === '\n' && quote !== '`') {
        return pos;
      }
      if (quote === '`' && text[pos] === '$' && text[pos + 1] === '{') {
        pos += 2;
        let depth = 1;
        while (pos < text.length && depth > 0) {
          if (text[pos] === '{') depth++;
          else if (text[pos] === '}') depth--;
          pos++;
        }
        continue;
      }
      pos++;
    }

    return pos;
  }
}
