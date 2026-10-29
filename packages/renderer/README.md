# @svelteframe/renderer

Headless browser and ffmpeg rendering engine behind Svelteframe.

Renders Svelteframe video compositions into MP4 videos or still images frame-by-frame using Playwright and ffmpeg.

## Prerequisites

- **ffmpeg** installed on your system (`brew install ffmpeg` on macOS, or via your Linux package manager)
- **Chromium** installed for Playwright (`npx playwright install chromium`)

## Installation

```sh
npm install @svelteframe/renderer
# or
pnpm add @svelteframe/renderer
```

## API

```ts
import { renderMedia, renderStill } from '@svelteframe/renderer';

// Render a video
await renderMedia({
  url: 'http://localhost:5173/render?id=main',
  output: 'output.mp4',
  onProgress: ({ frame, totalFrames, percent }) => {
    console.log(`Rendered frame ${frame}/${totalFrames} (${(percent * 100).toFixed(1)}%)`);
  }
});

// Render a single still image
await renderStill({
  url: 'http://localhost:5173/render?id=main',
  output: 'thumb.png',
  frame: 30
});
```

## License

MIT
