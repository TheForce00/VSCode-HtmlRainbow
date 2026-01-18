import * as vscode from 'vscode';
import { ParseResult, ColoredRange } from '../types';
import { BaseParser } from './baseParser';

/**
 * HTML void elements that don't have closing tags and shouldn't increment depth
 */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
  // Deprecated but still valid
  'command', 'keygen', 'menuitem',
]);

/**
 * Regex patterns for tag detection
 */
const TAG_PATTERNS = {
  // Matches opening tags: <tagName or <tagName/> (self-closing)
  // Captures: full match, tagName
  openingTag: /<([a-zA-Z][a-zA-Z0-9._:-]*)/g,

  // Matches closing tags: </tagName>
  closingTag: /<\/([a-zA-Z][a-zA-Z0-9._:-]*)\s*>/g,

  // Matches self-closing end: />
  selfClosingEnd: /\/>/g,

  // Matches regular tag end: >
  tagEnd: />/g,
};

interface TagMatch {
  type: 'open' | 'close' | 'selfClose';
  tagName: string;
  bracketStart: number;  // Position of < or </
  bracketEnd: number;    // Position after > or />
  nameStart: number;     // Position of tag name start
  nameEnd: number;       // Position after tag name
}

/**
 * Parser for HTML and XML documents
 */
export class HtmlParser extends BaseParser {
  parse(document: vscode.TextDocument): ParseResult {
    const text = document.getText();
    const ranges: ColoredRange[] = [];
    const tags = this.findAllTags(text);

    const tagStack: string[] = [];

    for (const tag of tags) {
      if (tag.type === 'open') {
        const currentDepth = tagStack.length;

        // Add colored ranges for brackets and tag name
        ranges.push(...this.createTagRanges(document, tag, currentDepth));

        // Only push to stack if not a void element
        if (!VOID_ELEMENTS.has(tag.tagName.toLowerCase())) {
          tagStack.push(tag.tagName);
        }
      } else if (tag.type === 'selfClose') {
        const currentDepth = tagStack.length;
        ranges.push(...this.createTagRanges(document, tag, currentDepth));
        // Self-closing tags don't affect the stack
      } else if (tag.type === 'close') {
        // Find matching opening tag
        const matchIndex = this.findMatchingOpenTag(tagStack, tag.tagName);
        if (matchIndex !== -1) {
          // Pop all tags up to and including the match
          tagStack.splice(matchIndex);
        }

        // Use depth after pop for closing tag
        const currentDepth = tagStack.length;
        ranges.push(...this.createTagRanges(document, tag, currentDepth));
      }
    }

    return { ranges };
  }

  /**
   * Creates colored ranges for a tag's brackets and name
   */
  protected createTagRanges(document: vscode.TextDocument, tag: TagMatch, depth: number): ColoredRange[] {
    const ranges: ColoredRange[] = [];

    if (tag.type === 'close') {
      // Closing tag: </tagName>
      // Color </ together
      ranges.push(this.createColoredRange(document, tag.bracketStart, tag.bracketStart + 2, depth));
      // Color tag name
      ranges.push(this.createColoredRange(document, tag.nameStart, tag.nameEnd, depth));
      // Color >
      ranges.push(this.createColoredRange(document, tag.bracketEnd - 1, tag.bracketEnd, depth));
    } else if (tag.type === 'selfClose') {
      // Self-closing tag: <tagName ... />
      // Color <
      ranges.push(this.createColoredRange(document, tag.bracketStart, tag.bracketStart + 1, depth));
      // Color tag name
      ranges.push(this.createColoredRange(document, tag.nameStart, tag.nameEnd, depth));
      // Color />
      ranges.push(this.createColoredRange(document, tag.bracketEnd - 2, tag.bracketEnd, depth));
    } else {
      // Opening tag: <tagName ... >
      // Color <
      ranges.push(this.createColoredRange(document, tag.bracketStart, tag.bracketStart + 1, depth));
      // Color tag name
      ranges.push(this.createColoredRange(document, tag.nameStart, tag.nameEnd, depth));
      // Color >
      ranges.push(this.createColoredRange(document, tag.bracketEnd - 1, tag.bracketEnd, depth));
    }

    return ranges;
  }

  /**
   * Finds all tags in the document text
   */
  protected findAllTags(text: string): TagMatch[] {
    const tags: TagMatch[] = [];

    // Find all potential tag starts
    const tagStartRegex = /<\/?([a-zA-Z][a-zA-Z0-9._:-]*)/g;
    let match;

    while ((match = tagStartRegex.exec(text)) !== null) {
      const isClosing = match[0].startsWith('</');
      const tagName = match[1];
      const bracketStart = match.index;
      const nameStart = isClosing ? match.index + 2 : match.index + 1;
      const nameEnd = nameStart + tagName.length;

      // Find where this tag ends
      const tagEndInfo = this.findTagEnd(text, nameEnd, isClosing);
      if (!tagEndInfo) {
        continue; // Malformed tag
      }

      if (isClosing) {
        tags.push({
          type: 'close',
          tagName,
          bracketStart,
          bracketEnd: tagEndInfo.end,
          nameStart,
          nameEnd,
        });
      } else if (tagEndInfo.selfClosing) {
        tags.push({
          type: 'selfClose',
          tagName,
          bracketStart,
          bracketEnd: tagEndInfo.end,
          nameStart,
          nameEnd,
        });
      } else {
        tags.push({
          type: 'open',
          tagName,
          bracketStart,
          bracketEnd: tagEndInfo.end,
          nameStart,
          nameEnd,
        });
      }
    }

    return tags;
  }

  /**
   * Finds the end of a tag starting from the given position
   * Returns the position after > or /> and whether it's self-closing
   */
  protected findTagEnd(text: string, startPos: number, isClosing: boolean): { end: number; selfClosing: boolean } | null {
    let inString = false;
    let stringChar = '';

    for (let i = startPos; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        if (char === stringChar && text[i - 1] !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '>') {
        const selfClosing = !isClosing && text[i - 1] === '/';
        return { end: i + 1, selfClosing };
      }

      // Abort if we hit another < (malformed tag)
      if (char === '<') {
        return null;
      }
    }

    return null;
  }

  /**
   * Finds the index of a matching opening tag in the stack
   */
  protected findMatchingOpenTag(stack: string[], tagName: string): number {
    const lowerTagName = tagName.toLowerCase();
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].toLowerCase() === lowerTagName) {
        return i;
      }
    }
    return -1;
  }
}
