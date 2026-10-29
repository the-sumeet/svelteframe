# Svelteframe — Implementation Plan

> Placeholder name: **Svelteframe**. Rename everywhere if a different name is chosen.

## Context

Svelteframe is a Remotion-like framework for building videos programmatically with **Svelte 5**.
Core idea: **a video is a pure function of the frame number.** Every component reads the
current frame from context and renders deterministically for it. A headless browser
steps through frames, screenshots each one, and pipes them into ffmpeg.

### Current state (already done)

- pnpm monorepo at repo root with `pnpm-workspace.yaml` covering `packages/*` and `apps/*`
- `packages/core` — scaffolded with `sv create` (Svelte library template, TypeScript)
- `apps/playground` — scaffolded with `sv create` (minimal SvelteKit, TypeScript)
- `packages/renderer` — plain Node package with `playwright`, `typescript`, `tsx`, `@types/node`; Chromium installed via `playwright install chromium`
- System: macOS (Darwin), ffmpeg installed via Homebrew (`/opt/homebrew/bin/ffmpeg`)

## Ground rules for the agent

1. Work **one milestone at a time**. After each milestone: run the verification steps, summarize what changed, and **stop for review** before starting the next.
2. Svelte 5 **runes only** (`$state`, `$derived`, `$props`, `$effect`). No legacy stores, no `export let`.
3. TypeScript strict mode everywhere.
4. **Determinism is the #1 rule.** Inside compositions, nothing may depend on wall-clock time: no Svelte `transition:`/`animate:`, no `tweened`/`spring` from `svelte/motion`, no CSS animations/transitions, no `Date.now()`/`Math.random()` without a seed. Everything derives from `frame`.
5. Keep the core package free of Node-only APIs (it runs in the browser). Keep the renderer free of Svelte imports.
6. Write unit tests (Vitest) for pure functions in core.
7. Do not copy code from Remotion's source (its license is not MIT for companies). Reimplement from the concepts described here.
8. Ask before adding any dependency not listed in this plan.

## Target layout

```
svelteframe/
  packages/
    core/        @svelteframe/core      — Svelte lib: context, primitives, math helpers, Player
    renderer/    @svelteframe/renderer  — Node: Playwright + ffmpeg frame renderer
    cli/         @svelteframe/cli       — (later) `svelteframe render <id>` command
  apps/
    playground/                     — SvelteKit: example compositions, player UI, render routes
  PLAN.md
```

---

## Milestone 0 — Verify and wire the workspace

Tasks:
- `packages/core/package.json`: name `@svelteframe/core`; add script `"watch": "svelte-package --watch"`; confirm `exports` has `types` + `svelte` conditions pointing at `dist`.
- `packages/renderer/package.json`: name `@svelteframe/renderer`, `"type": "module"`, add `tsconfig.json` (ES2022, NodeNext, strict).
- Link core into playground: `pnpm --filter playground add @svelteframe/core@workspace:*`.
- Root `package.json` scripts:
  - `dev:core` → `pnpm --filter @svelteframe/core watch`
  - `dev:play` → `pnpm --filter playground dev`
  - `render` → `pnpm --filter @svelteframe/renderer exec tsx src/cli.ts` (args pass through, e.g. `pnpm render --url ... --out out.mp4`)
  - `test` → `pnpm -r test`
- Remove the demo content the `sv create` library template generated in `packages/core/src/routes` (keep a minimal page or delete routes if unused).

Verify: `pnpm install` succeeds; `pnpm --filter @svelteframe/core build` produces `dist/`; `pnpm dev:play` starts.

---

## Milestone 1 — Core primitives

Files in `packages/core/src/lib/`:

- `video.svelte.ts`
  - `interface VideoContext { readonly frame; fps; width; height; durationInFrames }`
  - `class VideoState implements VideoContext` with `frame = $state(0)` and the config fields from a constructor object.
  - `setVideo(ctx)` / `useVideo()` using `setContext`/`getContext` with a private Symbol key. `useVideo()` throws a clear error if called outside a `<Composition>`.
- `interpolate.ts`
  - `interpolate(input, inputRange[], outputRange[], opts?)` supporting **multi-point ranges** (e.g. `[0, 10, 20] → [0, 1, 0]`), `extrapolateLeft`/`extrapolateRight` (`'clamp' | 'extend' | 'identity'`, default `'clamp'`), and an optional `easing` fn.
  - Validate: ranges same length, ≥2 points, input range strictly increasing.
- `easing.ts` — `Easing.linear`, `ease`, `in/out/inOut` wrappers, `quad`, `cubic`, `bezier(x1,y1,x2,y2)`.
- `Composition.svelte` — props `{ video: VideoState, children: Snippet }`; calls `setVideo(video)`; renders a `position:relative; overflow:hidden` box sized `width×height`.
- `Sequence.svelte` — props `{ from = 0, durationInFrames = Infinity, children }`; provides a child context whose `frame` getter returns `parent.frame - from` (reactive via getter); renders children only while `from <= parent.frame < from + durationInFrames`, inside an absolutely-filled div.
- `AbsoluteFill.svelte` — `position:absolute; inset:0; display:flex; flex-direction:column`.
- `index.ts` — export everything public.

Tests (`*.test.ts`): `interpolate` (linear, multi-point, clamp/extend, easing, invalid input), easing endpoints (`f(0)=0`, `f(1)=1`).

Verify: `pnpm test` green; `pnpm --filter @svelteframe/core build` clean; `svelte-check` clean.

---

## Milestone 2 — Playground render route

- `apps/playground/src/lib/scenes/Intro.svelte` — dark background, centered title that fades in and slides up over frames 0–30 using `interpolate`.
- `apps/playground/src/lib/scenes/Outro.svelte` — a second simple scene.
- `apps/playground/src/routes/render/+page.svelte`
  - Creates `VideoState({ fps: 30, width: 1920, height: 1080, durationInFrames: 150 })`.
  - `<Composition>` with `<Sequence from={0} durationInFrames={90}><Intro/></Sequence>` and `<Sequence from={90} durationInFrames={60}><Outro/></Sequence>`.
  - In `onMount`, expose on `window`:
    - `__Svelteframe.config` → `{ fps, width, height, durationInFrames }`
    - `__Svelteframe.setFrame(n)` → sets `video.frame = n`, `await tick()`, resolves when DOM is updated
    - `__Svelteframe.ready` → `true`
  - Global style: `body { margin:0; overflow:hidden }`.
  - Optional `?frame=N` query param sets the initial frame (handy for manual debugging).
- Add `src/app.d.ts` typings for `window.__Svelteframe`.

Verify: open `/render?frame=0`, `/render?frame=45`, `/render?frame=120` and confirm the expected scene/state appears.

---

## Milestone 3 — Renderer (single-threaded)

`packages/renderer/src/`:
- `render.ts` (library function) — `renderVideo({ url, output, onProgress, imageFormat = 'jpeg', quality = 90, chromiumPath? })`:
  1. Launch Chromium (use `chromiumPath` if given; otherwise the Playwright-bundled Chromium).
  2. `page.goto(url)`; `waitForFunction(() => window.__Svelteframe?.ready)`.
  3. Read `config`; set viewport to `width×height`.
  4. Spawn ffmpeg: `-y -f image2pipe -c:v mjpeg -framerate <fps> -i - -c:v libx264 -pix_fmt yuv420p <output>` (use `-c:v png` input when `imageFormat='png'`).
  5. For each frame: `setFrame(f)` → `page.screenshot({ type, quality })` → write to ffmpeg stdin respecting backpressure (`drain`).
  6. Close stdin, await ffmpeg exit code 0 (reject with captured stderr otherwise), close browser.
- `cli.ts` — `tsx src/cli.ts --url http://localhost:5173/render/main --out out.mp4`; prints progress `frame x/y` and elapsed time / fps. (Milestone 7 adds `--composition <id> --props <file>`, which build that URL from a base URL.)
- Clean up browser + ffmpeg on error and on SIGINT.

Verify: with playground dev server running, `pnpm render` produces `out.mp4`; `ffprobe out.mp4` reports 150 frames, 30 fps, 1920×1080, ~5s.

---

## Milestone 4 — Player component (preview)

In `packages/core/src/lib/Player.svelte`:
- Props: `component` (the scene/root component), `fps`, `width`, `height`, `durationInFrames`, `controls = true`, `loop = true`, `autoplay = false`.
- Owns a `VideoState`; wraps `component` in `<Composition>`.
- Playback via `requestAnimationFrame`, advancing frames based on elapsed time × fps (so it plays at real speed regardless of display refresh rate).
- Scales the composition with CSS `transform: scale()` to fit its container while keeping aspect ratio.
- Controls: play/pause, scrubber (`<input type=range>` bound to frame), current frame / timecode display, keyboard: Space = play/pause, ←/→ = ±1 frame, Shift+←/→ = ±1 second.

Playground home route (`/`) shows the Player with the same composition as `/render`.

Refactor so the composition tree is defined **once** (e.g. `src/lib/compositions/Main.svelte`) and used by both `/` and `/render`.

Verify: scrubbing is smooth; frame shown in player at frame N matches `/render?frame=N`.

---

## Milestone 5 — More primitives

- `spring({ frame, fps, config?: { damping, mass, stiffness }, from = 0, to = 1, durationInFrames? })` — deterministic physics simulated by stepping from frame 0 to `frame` (pure function, memoizable). Unit test: starts at `from`, settles at `to`.
- `Series.svelte` + `Series.Sequence` (or `SeriesItem.svelte`) — children laid out back-to-back without manual `from` math.
- `Loop.svelte` — repeats children every `durationInFrames`.
- `Freeze.svelte` — renders children at a fixed frame.
- `random(seed)` — deterministic PRNG.

Add a demo scene using each in the playground.

---

## Milestone 6 — Async readiness (`delayRender`)

- In core: a per-page pending-handle registry. `delayRender(label?) → handle`, `continueRender(handle)`, plus a timeout (default 30s) that throws with the label so stuck renders are debuggable.
- `__Svelteframe.setFrame(n)` must resolve only after `tick()` **and** all pending handles are cleared **and** `document.fonts.ready`.
- `Img.svelte` — calls `delayRender` until the image `load` (or `error` → fail loudly).
- Demo: a scene that fetches JSON in `onMount` and uses `delayRender` until loaded.

Verify: render a scene with a large remote image; no frame shows it half-loaded.

---

## Milestone 7 — Composition registry + input props

- `defineComposition({ id, component, fps, width, height, durationInFrames, defaultProps, calculateMetadata? })`.
- Playground `src/lib/compositions/index.ts` exports a list of compositions.
- Routes: `/` lists compositions; `/preview/[id]` shows Player; `/render/[id]` is the render target.
- Input props: renderer passes JSON props via `?props=<base64url(JSON)>`; merged over `defaultProps`; `calculateMetadata(props)` may override duration/size.
- Renderer CLI: `--composition <id> --props ./props.json`.

---

## Milestone 8 — Audio

- `Audio.svelte` props: `src`, `startFrom` (trim, frames), `endAt`, `volume` (number or `(frame) => number` — sample per frame for the render), `playbackRate`.
- In the Player: actually play audio synced to the frame (seek on scrub, play/pause with player).
- In render mode: components don't play; they **register** their metadata (`src`, absolute start frame accounting for parent Sequences, trim, volume curve) into `window.__Svelteframe.audio`.
- Renderer: after the video pass, read the audio manifest and build an ffmpeg filter graph (`atrim`, `adelay`, `volume`, `amix`) to mux audio into the final MP4.

Verify: render with background music + a sound effect at frame 60; check sync with ffprobe/playback.

---

## Milestone 9 — Parallel rendering

- `--concurrency N` (default `os.cpus().length / 2`).
- Split frames into N contiguous ranges; each worker uses its own page (one browser, N pages) and its own ffmpeg process writing a chunk.
- Concatenate chunks with the ffmpeg concat demuxer (`-c copy`), then mux audio.
- Benchmark and print fps before/after in the CLI output.

---

## Milestone 10 — CLI package

`packages/cli` → `svelteframe` binary (`pnpm svelteframe …` from the repo root runs it on `apps/playground`):
- `svelteframe render <id> [--out] [--props] [--concurrency] [--quality] [--png]` — serves the project with **its own Vite** (`vite build` + `vite preview` by default, `--dev` for the dev server, or `--url` to use a server that is already running), renders, and shuts the server down.
- `svelteframe still <id> --frame N --out frame.png` — one frame as `.png` or `.jpg`.
- `svelteframe compositions [--json]` — lists ids with metadata. A project opts in by serving `GET /svelteframe/compositions.json` returning `describeCompositions(compositions)` from `@svelteframe/core`.
- Common options: `--root <dir>` (the project, default the current directory), `--chromium <path>`.
- Builds of one project take turns (a lock outside the project), since they share the project's build folder.
- Both `@svelteframe/renderer` and `@svelteframe/cli` compile with `tsc` (`pnpm build` at the root builds all packages in order); the binary runs from `dist`.

---

## Later / stretch

- ~~`OffthreadVideo`~~ — done. `<OffthreadVideo src startFrom endAt volume playbackRate muted fit>`.
  - Preview: a `<video>` kept at the frame's time (shares its sync code with `<Audio>`).
  - Render: an `<img>` of the frame, decoded by ffmpeg. The page asks `/__svelteframe/video-frame?src&time`; the renderer answers that request itself (Playwright route), so projects need no server code. It downloads each video once, probes its frame rate, and shows the last frame that starts at or before the time (the last frame is held past the end).
  - Sound is recorded like `<Audio>` and mixed in; a video with no audio track is skipped.
  - A `<Sequence>` fills its nearest positioned parent, so put the video's box in `position: relative`.
- ~~Shapes~~ — done, as `@svelteframe/shapes` (depends on core). SVG components: `Rect`, `Circle`, `Ellipse`, `Triangle`, `Polygon`, `Star`, `Line`, `Arrow`, plus `Canvas`.
  - In a `<Canvas>` (an `<svg>` the size of the composition, filling its nearest positioned parent) shapes use composition pixels: `x`/`y` put the shape's `anchor` (default top-left; `center`, `bottom-right`... or a point) there. `Line` and `Arrow` take `from`/`to` points.
  - Outside a canvas a shape is an ordinary `<svg>` the page places, so `x`/`y` are ignored.
  - Every shape takes `rotate`, `scale` and `origin` (default the centre), and `progress` (0 to 1) to draw its outline on. A `Line` or `Arrow` with `progress` grows from `from`, the arrowhead going with the tip.
  - Attach by id: give a shape `id="card"`, then `<Arrow from="card" to="dot" />` meets the two edges on the line between their centres. `"card.bottom"` (any of the nine anchor names) is a point of its box; `{ id, anchor, dx, dy }` moves it; a plain `[x, y]` still works, and `gap` leaves space at attached ends. Ends follow shapes that move, rotate or scale. A shape registers as it is created, so the arrow may come before it in the markup; an unknown id fails the render and lists the ids there are. Edges are exact for ellipses and polygons; rounded corners of a `Rect` are ignored.
  - Geometry (`regularPolygon`, `star`, `arrowGeometry`, `shapeTransform`) is pure and exported.
- ~~Documentation~~ — done, as `apps/docs` (Astro + Starlight, with `@astrojs/svelte` so pages embed live `<Player>` demos). `pnpm docs:dev` / `pnpm docs:build`.
  - Pages: getting started (installation, first composition, the project contract), concepts, rendering (CLI, Node API, how it works, troubleshooting) and a hand-written reference per package.
  - Guards: `pnpm --filter @svelteframe/docs test` fails when a package exports a name with no reference heading, when an example imports a name that is not exported, or when a page embeds a demo that does not exist. `check:links` (after a build) checks every internal link and `#fragment`. `pnpm --filter @svelteframe/docs check` type-checks the pages and the Svelte demos.
- Studio UI: composition sidebar, timeline showing Sequences, props editor.
- Transitions package (fade, slide, wipe) built on `interpolate` + `spring`.
- `create-svelteframe` scaffolding template.

## Definition of done for each milestone

- Code compiles (`svelte-check`, `tsc --noEmit`) with no errors.
- Tests pass (`pnpm test`).
- The milestone's "Verify" step has been run and its output reported.
- Short summary of changes + any open questions, then stop.