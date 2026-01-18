import * as vscode from 'vscode';

/**
 * Represents a range of text that should be colored at a specific nesting depth
 */
export interface ColoredRange {
  range: vscode.Range;
  depth: number;
}

/**
 * Result from parsing a document
 */
export interface ParseResult {
  ranges: ColoredRange[];
}

/**
 * Parser interface that all language parsers must implement
 */
export interface Parser {
  parse(document: vscode.TextDocument): ParseResult;
}

/**
 * Configuration for the extension
 */
export interface HtmlRainbowConfig {
  enabled: boolean;
  colors: string[];
  languages: Record<string, boolean>;
  objectBraces: {
    enabled: boolean;
    colorizeKeys: boolean;
  };
  debounceMs: number;
}

/**
 * Token types that can be colorized
 */
export enum TokenType {
  OpenBracket = 'openBracket',
  CloseBracket = 'closeBracket',
  TagName = 'tagName',
  ObjectBrace = 'objectBrace',
  PropertyKey = 'propertyKey',
}
