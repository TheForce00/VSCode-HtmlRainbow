import * as vscode from 'vscode';
import { Parser, ParseResult, ColoredRange } from '../types';

/**
 * Abstract base class for all parsers
 */
export abstract class BaseParser implements Parser {
  abstract parse(document: vscode.TextDocument): ParseResult;

  /**
   * Creates a Range from character offsets in the document text
   */
  protected createRange(document: vscode.TextDocument, startOffset: number, endOffset: number): vscode.Range {
    const startPos = document.positionAt(startOffset);
    const endPos = document.positionAt(endOffset);
    return new vscode.Range(startPos, endPos);
  }

  /**
   * Creates a ColoredRange with the specified depth
   */
  protected createColoredRange(
    document: vscode.TextDocument,
    startOffset: number,
    endOffset: number,
    depth: number
  ): ColoredRange {
    return {
      range: this.createRange(document, startOffset, endOffset),
      depth,
    };
  }
}
