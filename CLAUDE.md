# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HtmlRainbow is a VS Code extension that colorizes HTML/XML/JSX/TSX tags and JS/TS object braces based on nesting depth. It provides visual indication of tag nesting levels through color-coded brackets, tag names, braces, and property keys.

## Build Commands

```bash
npm install          # Install dependencies
npm run compile      # Build the TypeScript code
npm run watch        # Watch mode for development
```

## Debug

Press F5 in VS Code to launch the extension in debug mode (Extension Development Host).

## Architecture

```
src/
├── extension.ts          # Main entry point, event handling, parser selection
├── decorationManager.ts  # Creates/applies VS Code text decorations
├── configuration.ts      # Settings management from VS Code config
├── parsers/
│   ├── baseParser.ts     # Abstract base class for all parsers
│   ├── htmlParser.ts     # HTML/XML parser (regex-based tag detection)
│   ├── jsxParser.ts      # JSX/TSX parser (extends HTML with expressions)
│   └── objectParser.ts   # JS/TS object literals parser
├── types/index.ts        # TypeScript interfaces and types
└── utils/debounce.ts     # Debounce utility for document changes
```

### Key Concepts

- **Parsers** detect colorizable ranges (brackets, tag names, braces, keys) and assign depth levels
- **DecorationManager** creates VS Code decoration types for each color and applies them to editors
- **Configuration** reads user settings and provides default values
- Colors cycle when nesting depth exceeds the number of defined colors
