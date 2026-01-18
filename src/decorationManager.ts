import * as vscode from 'vscode';
import { ColoredRange, HtmlRainbowConfig } from './types';

/**
 * Manages text editor decorations for colorized elements
 */
export class DecorationManager {
  private decorationTypes: vscode.TextEditorDecorationType[] = [];
  private colors: string[] = [];

  constructor(config: HtmlRainbowConfig) {
    this.createDecorationTypes(config.colors);
  }

  /**
   * Creates decoration types for each color in the palette
   */
  private createDecorationTypes(colors: string[]): void {
    // Dispose existing decoration types
    this.dispose();

    this.colors = colors;
    this.decorationTypes = colors.map(color =>
      vscode.window.createTextEditorDecorationType({
        color: color,
      })
    );
  }

  /**
   * Updates decoration types when configuration changes
   */
  updateConfig(config: HtmlRainbowConfig): void {
    // Only recreate if colors have changed
    if (JSON.stringify(this.colors) !== JSON.stringify(config.colors)) {
      this.createDecorationTypes(config.colors);
    }
  }

  /**
   * Applies decorations to an editor based on parsed ranges
   */
  applyDecorations(editor: vscode.TextEditor, ranges: ColoredRange[]): void {
    if (this.decorationTypes.length === 0) {
      return;
    }

    // Group ranges by color level (depth % numColors)
    const numColors = this.decorationTypes.length;
    const rangesByLevel: Map<number, vscode.Range[]> = new Map();

    for (let i = 0; i < numColors; i++) {
      rangesByLevel.set(i, []);
    }

    for (const coloredRange of ranges) {
      const level = coloredRange.depth % numColors;
      rangesByLevel.get(level)!.push(coloredRange.range);
    }

    // Apply decorations for each level
    for (let i = 0; i < numColors; i++) {
      const decorationType = this.decorationTypes[i];
      const levelRanges = rangesByLevel.get(i) || [];
      editor.setDecorations(decorationType, levelRanges);
    }
  }

  /**
   * Clears all decorations from an editor
   */
  clearDecorations(editor: vscode.TextEditor): void {
    for (const decorationType of this.decorationTypes) {
      editor.setDecorations(decorationType, []);
    }
  }

  /**
   * Disposes all decoration types
   */
  dispose(): void {
    for (const decorationType of this.decorationTypes) {
      decorationType.dispose();
    }
    this.decorationTypes = [];
    this.colors = [];
  }
}
