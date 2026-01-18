import * as vscode from 'vscode';
import { HtmlRainbowConfig } from './types';

const CONFIG_SECTION = 'htmlRainbow';

const DEFAULT_COLORS = [
  '#E6B800', // Gold
  '#E65C00', // Orange
  '#E600E6', // Magenta
  '#7A00E6', // Purple
  '#0066E6', // Blue
  '#00B3E6', // Cyan
  '#00E699', // Teal
  '#00E600', // Green
  '#99E600', // Lime
  '#E6E600', // Yellow
];

const DEFAULT_LANGUAGES: Record<string, boolean> = {
  html: true,
  xml: true,
  javascriptreact: true,
  typescriptreact: true,
  javascript: true,
  typescript: true,
};

/**
 * Retrieves the current configuration for the extension
 */
export function getConfiguration(): HtmlRainbowConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  return {
    enabled: config.get<boolean>('enabled', true),
    colors: config.get<string[]>('colors', DEFAULT_COLORS),
    languages: config.get<Record<string, boolean>>('languages', DEFAULT_LANGUAGES),
    objectBraces: {
      enabled: config.get<boolean>('objectBraces.enabled', true),
      colorizeKeys: config.get<boolean>('objectBraces.colorizeKeys', true),
    },
    debounceMs: config.get<number>('debounceMs', 100),
  };
}

/**
 * Checks if colorization is enabled for a specific language
 */
export function isLanguageEnabled(languageId: string, config: HtmlRainbowConfig): boolean {
  if (!config.enabled) {
    return false;
  }
  return config.languages[languageId] ?? false;
}

/**
 * Checks if a language is HTML-like (HTML, XML)
 */
export function isHtmlLanguage(languageId: string): boolean {
  return languageId === 'html' || languageId === 'xml';
}

/**
 * Checks if a language is JSX/TSX
 */
export function isJsxLanguage(languageId: string): boolean {
  return languageId === 'javascriptreact' || languageId === 'typescriptreact';
}

/**
 * Checks if a language is JavaScript or TypeScript (non-JSX)
 */
export function isJsTsLanguage(languageId: string): boolean {
  return languageId === 'javascript' || languageId === 'typescript';
}

/**
 * Registers a listener for configuration changes
 */
export function onConfigurationChange(
  callback: (config: HtmlRainbowConfig) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      callback(getConfiguration());
    }
  });
}
