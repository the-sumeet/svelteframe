# @svelteframe/shapes

SVG shape primitives and smart connecting arrows for Svelteframe video compositions.

## Features

- **Shapes**: `Rect`, `Circle`, `Ellipse`, `Polygon`, `Star`, `Triangle`, and raw `Shape` components.
- **Canvas**: Coordinate system and viewBox management.
- **Connectors**: `Arrow` that attaches smoothly to any registered shape by `id`.

## Installation

```sh
npm install @svelteframe/shapes @svelteframe/core
# or
pnpm add @svelteframe/shapes @svelteframe/core
```

## Basic Usage

```svelte
<script lang="ts">
  import { Canvas, Rect, Circle, Arrow } from '@svelteframe/shapes';
</script>

<Canvas width={800} height={600}>
  <Rect id="box-a" x={100} y={200} width={120} height={80} fill="#3b82f6" />
  <Circle id="box-b" cx={500} cy={200} r={50} fill="#10b981" />
  <Arrow from="box-a" to="box-b" stroke="#ffffff" strokeWidth={3} />
</Canvas>
```

## License

MIT
