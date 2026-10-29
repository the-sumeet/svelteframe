# Svelteframe

Make videos with Svelte 5 components. A video is a pure function of the frame number: a headless browser steps through the frames, screenshots each one, and `ffmpeg` encodes them (and any audio) into an MP4.

| Package | |
| --- | --- |
| `packages/core` | `@svelteframe/core`: timeline components, `interpolate`, `spring`, `Audio`, `OffthreadVideo`, `Player` |
| `packages/shapes` | `@svelteframe/shapes`: SVG shapes, and arrows that attach to shapes by id |
| `packages/renderer` | `@svelteframe/renderer`: the Node API behind rendering |
| `packages/cli` | `@svelteframe/cli`: the `svelteframe` command |
| `apps/playground` | A SvelteKit project with example compositions |
| `apps/docs` | The documentation site (Astro and Starlight) |

## Try it

Needs Node 24, pnpm, `ffmpeg` (`brew install ffmpeg`), and Chromium for Playwright.

```sh
pnpm install
pnpm build
pnpm --filter @svelteframe/renderer exec playwright install chromium

pnpm dev:play                      # preview the examples in a browser
pnpm svelteframe render main       # render one to main.mp4
pnpm docs:dev                      # the documentation, with live demos
```

## Scripts

| Script | |
| --- | --- |
| `pnpm build` | Build the packages, in dependency order |
| `pnpm test` | Run every package's tests |
| `pnpm svelteframe …` | Run the `svelteframe` command against the playground |
| `pnpm docs:dev`, `pnpm docs:build` | Work on, or build, the documentation |

`PLAN.md` is the build plan the project was made from.
