# @svelteframe/cli

Command-line interface for Svelteframe video compositions.

## Prerequisites

- **ffmpeg** installed on your system (`brew install ffmpeg` on macOS, or via your Linux package manager)
- **Chromium** installed for Playwright (`npx playwright install chromium`)

## Installation

```sh
npm install -g @svelteframe/cli
# or install as project dev dependency
pnpm add -D @svelteframe/cli
```

## Usage

```sh
# Render a composition to MP4 video
svelteframe render <composition-id> [output.mp4]

# Render a single still frame to image
svelteframe still <composition-id> [output.png] --frame 30

# List available compositions
svelteframe compositions
```

## Options

- `--props <json|path>`: Pass props as a JSON string or JSON file path
- `--port <number>`: Port for the internal dev server
- `--root <path>`: Root folder of the project containing compositions
- `--quality <1-100>`: JPEG quality (default: 90)
- `--format <jpeg|png>`: Image format for intermediate frames

## License

MIT
