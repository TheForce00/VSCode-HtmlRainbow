import * as vscode from 'vscode';
import { DecorationManager } from './decorationManager';
import {
  getConfiguration,
  isLanguageEnabled,
  isHtmlLanguage,
  isJsxLanguage,
  isJsTsLanguage,
  onConfigurationChange,
} from './configuration';
import { HtmlParser } from './parsers/htmlParser';
import { JsxParser } from './parsers/jsxParser';
import { ObjectParser } from './parsers/objectParser';
import { DebouncedFunction } from './utils/debounce';
import { HtmlRainbowConfig, Parser } from './types';

let decorationManager: DecorationManager;
let htmlParser: HtmlParser;
let jsxParser: JsxParser;
let objectParser: ObjectParser;
let config: HtmlRainbowConfig;
let debouncedUpdate: DebouncedFunction<(editor: vscode.TextEditor) => void>;

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext): void {
  // Initialize configuration
  config = getConfiguration();

  // Initialize parsers
  htmlParser = new HtmlParser();
  jsxParser = new JsxParser(config);
  objectParser = new ObjectParser(config);

  // Initialize decoration manager
  decorationManager = new DecorationManager(config);

  // Create debounced update function
  debouncedUpdate = new DebouncedFunction(updateDecorations, config.debounceMs);

  // Register event handlers
  context.subscriptions.push(
    // Configuration changes
    onConfigurationChange(handleConfigChange),

    // Editor changes
    vscode.window.onDidChangeActiveTextEditor(handleEditorChange),

    // Document changes
    vscode.workspace.onDidChangeTextDocument(handleDocumentChange),

    // Disposables
    { dispose: () => decorationManager.dispose() },
    { dispose: () => debouncedUpdate.dispose() },
  );

  // Apply decorations to current active editor
  if (vscode.window.activeTextEditor) {
    updateDecorations(vscode.window.activeTextEditor);
  }
}

/**
 * Extension deactivation entry point
 */
export function deactivate(): void {
  decorationManager?.dispose();
  debouncedUpdate?.dispose();
}

/**
 * Handles configuration changes
 */
function handleConfigChange(newConfig: HtmlRainbowConfig): void {
  config = newConfig;

  // Update parsers
  jsxParser.updateConfig(config);
  objectParser.updateConfig(config);

  // Update decoration manager
  decorationManager.updateConfig(config);

  // Update debounce timing
  debouncedUpdate.setWait(config.debounceMs);

  // Refresh all visible editors
  for (const editor of vscode.window.visibleTextEditors) {
    updateDecorations(editor);
  }
}

/**
 * Handles active editor changes
 */
function handleEditorChange(editor: vscode.TextEditor | undefined): void {
  if (editor) {
    updateDecorations(editor);
  }
}

/**
 * Handles document content changes
 */
function handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  const editor = vscode.window.activeTextEditor;

  if (editor && editor.document === event.document) {
    debouncedUpdate.call(editor);
  }
}

/**
 * Updates decorations for an editor
 */
function updateDecorations(editor: vscode.TextEditor): void {
  const document = editor.document;
  const languageId = document.languageId;

  // Check if extension is enabled for this language
  if (!isLanguageEnabled(languageId, config)) {
    decorationManager.clearDecorations(editor);
    return;
  }

  // Select the appropriate parser
  const parser = getParser(languageId);
  if (!parser) {
    decorationManager.clearDecorations(editor);
    return;
  }

  // Parse the document
  const result = parser.parse(document);

  // Apply decorations
  decorationManager.applyDecorations(editor, result.ranges);
}

/**
 * Gets the appropriate parser for a language
 */
function getParser(languageId: string): Parser | null {
  if (isHtmlLanguage(languageId)) {
    return htmlParser;
  }

  if (isJsxLanguage(languageId)) {
    return jsxParser;
  }

  if (isJsTsLanguage(languageId)) {
    return objectParser;
  }

  return null;
}
