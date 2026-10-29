# @svelteframe/core

Svelte 5 components and helpers for making video from code: a video is a pure function of the frame number.

`Sequence`, `Series`, `Loop` and `Freeze` place parts on the timeline; `interpolate`, `Easing` and `spring` turn frames into values; `Audio` and `OffthreadVideo` add sound and video; `Player` plays a composition live in the browser. A `useVideo()` hook gives any component the current frame.

```svelte
<script lang="ts">
  import { AbsoluteFill, interpolate, useVideo } from '@svelteframe/core';

  const video = useVideo();
  const opacity = $derived(interpolate(video.frame, [0, 30], [0, 1]));
</script>

<AbsoluteFill style="align-items:center;justify-content:center">
  <h1 style="opacity:{opacity}">Hello, video</h1>
</AbsoluteFill>
```

The documentation, with live demos and a full reference, lives in `apps/docs` (run `pnpm docs:dev` from the repository root).

This package is not published yet: use it from the workspace.

## Development

```sh
pnpm --filter @svelteframe/core build   # svelte-package and publint
pnpm --filter @svelteframe/core test    # vitest
pnpm --filter @svelteframe/core check   # svelte-check
```
