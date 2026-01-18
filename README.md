# HTML Rainbow

A VS Code extension that colorizes HTML/XML/JSX/TSX tags and JS/TS object braces based on nesting depth.

## Features

- **Tag colorization**: Both brackets (`<`, `>`, `</`, `/>`) and tag names get colored by depth
- **Object colorization**: JS/TS object braces `{}` and property keys are colorized
- **10 default colors** that cycle for deeper nesting levels
- **Configurable**: Customize colors and behavior via VS Code settings

## Supported Languages

- HTML
- XML
- JSX (JavaScript React)
- TSX (TypeScript React)
- JavaScript (object literals only)
- TypeScript (object literals only)

## Configuration

Configure the extension in your `settings.json`:

```json
{
  "htmlRainbow.enabled": true,
  "htmlRainbow.colors": [
    "#E6B800",
    "#E65C00",
    "#E600E6",
    "#7A00E6",
    "#0066E6",
    "#00B3E6",
    "#00E699",
    "#00E600",
    "#99E600",
    "#E6E600"
  ],
  "htmlRainbow.languages": {
    "html": true,
    "xml": true,
    "javascriptreact": true,
    "typescriptreact": true,
    "javascript": true,
    "typescript": true
  },
  "htmlRainbow.objectBraces.enabled": true,
  "htmlRainbow.objectBraces.colorizeKeys": true,
  "htmlRainbow.debounceMs": 100
}
```

### Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `htmlRainbow.enabled` | boolean | `true` | Enable/disable the extension |
| `htmlRainbow.colors` | string[] | (10 colors) | Array of colors for nesting levels |
| `htmlRainbow.languages` | object | (all enabled) | Enable/disable per language |
| `htmlRainbow.objectBraces.enabled` | boolean | `true` | Colorize object braces in JS/TS |
| `htmlRainbow.objectBraces.colorizeKeys` | boolean | `true` | Colorize property keys in objects |
| `htmlRainbow.debounceMs` | number | `100` | Debounce delay for re-parsing |

## Default Color Palette

1. Gold (#E6B800)
2. Orange (#E65C00)
3. Magenta (#E600E6)
4. Purple (#7A00E6)
5. Blue (#0066E6)
6. Cyan (#00B3E6)
7. Teal (#00E699)
8. Green (#00E600)
9. Lime (#99E600)
10. Yellow (#E6E600)

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Debug

Press F5 in VS Code to launch the extension in debug mode.

## License

MIT
