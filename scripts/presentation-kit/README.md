# @imaginaryspace/presentation-kit

Standalone slide-deck design system extracted from the ionous-ai dashboard.
Framework-agnostic React components + a single CSS file. Drop the folder into
any React app (Next.js, Vite, CRA, Remix — anything that runs React 18+).

## What's in here

```
src/
├── index.ts                    # public barrel
├── components/
│   ├── Slide.tsx               # 1920×1080 frame + corner labels
│   ├── slideKit.tsx            # composable primitives (SlideContent, TextBox,
│   │                           # ScopeBarRow, GanttBar, RecapItem, Pill, etc.)
│   ├── MissingData.tsx         # placeholder shown when slide data is incomplete
│   └── GenerativeImage.tsx     # image card with optional prompt bar
├── slides/                     # opinionated, pre-assembled slide variants
│   ├── CoverSlide.tsx
│   ├── ClosingSlide.tsx
│   ├── BreathingSlide.tsx
│   ├── VelocitySlide.tsx
│   ├── SprintScopeSlide.tsx
│   ├── RecapSlide.tsx
│   ├── DevUpdatesSlide.tsx
│   └── TimelineSlide.tsx
├── geometry/
│   ├── velocity-chart-geometry.ts   # cubic-spline SVG path math
│   └── corner-br.ts                 # bottom-right corner label resolver
├── styles/
│   ├── presentations.css            # the entire visual language (~1500 lines)
│   └── fonts.css                    # optional Newsreader + Inter from Google Fonts
├── types/
│   └── presentation.ts              # data view-model types
└── utils/
    ├── cn.ts                        # tiny clsx replacement
    └── presentation-title.ts        # hero-title formatter
```

Zero runtime dependencies (only `react` / `react-dom` peer deps). No Next.js,
no Tailwind, no Supabase, no Linear coupling.

## Copy-and-paste install

1. Copy the entire `presentation-kit/` folder into your target repo (anywhere
   you like — e.g. `packages/presentation-kit/` in a monorepo, or just
   `src/presentation-kit/` in a single-app repo).
2. If your app already has a `tsconfig.json`, you don't need anything special.
   Otherwise see the `tsconfig.json` here as a reference.
3. Import the CSS once from your app entry point:
   ```ts
   import "./presentation-kit/src/styles/presentations.css";
   import "./presentation-kit/src/styles/fonts.css"; // optional
   ```
4. Import any slide or primitive:
   ```tsx
   import { CoverSlide, Slide, SlideContent, ScopeBarRow } from "./presentation-kit/src";
   ```

If you'd rather treat it as a workspace package, leave `package.json` as-is
and add `"@imaginaryspace/presentation-kit": "workspace:*"` to your app's
`package.json`. Both work.

## Minimal example

```tsx
import "@imaginaryspace/presentation-kit/styles";
import "@imaginaryspace/presentation-kit/fonts";
import { CoverSlide, VelocitySlide, ClosingSlide } from "@imaginaryspace/presentation-kit";

export function Deck() {
  // The wrapper is what defines the scale + injects the design tokens.
  // --scale shrinks the 1920×1080 slides to fit the viewport.
  return (
    <div
      className="ims-presentation"
      style={{ ["--scale" as string]: "0.5" }}
    >
      <CoverSlide
        data={{
          heroText: "WEEK 17",
          team: "Imaginary Space, Acme Co",
          date: "Apr 30, 2026",
          cycle: "Retro",
        }}
        corners={{ tl: "Imaginary Space", tr: "Apr 30, 2026", bl: "Acme Co", br: "Cycle 17" }}
      />
      <VelocitySlide
        data={{
          subtitle: "Cycle 17 — Story points",
          completed: 42,
          total: 100,
          progressPct: 42,
          remaining: 58,
          scopeValues: [80, 85, 95, 100, 100],
          startedValues: [10, 25, 40, 55, 60],
          completedValues: [5, 12, 22, 35, 42],
          todayColumn: 3,
        }}
      />
      <ClosingSlide
        data={{
          heroText: "LET'S BUILD",
          thankYou: "THANK YOU",
          teamLine: "IMAGINARY SPACE × ACME",
          dateLine: "APR 30, 2026",
        }}
      />
    </div>
  );
}
```

## Concepts

### The `.ims-presentation` wrapper

Every slide is rendered inside an element with the `ims-presentation` class.
That class is where the design tokens live (`--brand-cream`, `--brand-accent`,
`--slide-w`, `--slide-h`, `--scale`, etc.). Without this wrapper, slides will
appear unstyled.

Set `--scale` on the wrapper to shrink/grow the entire deck. The slides
themselves are always 1920×1080 in CSS pixels — `--scale` applies a CSS
`transform: scale()` and adjusts `margin-bottom` so layout sizing matches.

### Corner labels

Every slide shows four corner labels (top-left, top-right, bottom-left,
bottom-right). Pass a `corners={{ tl, tr, bl, br }}` prop to override; omit
to fall back to the demo defaults baked into `Slide.tsx`.

### Data shape

Each pre-assembled slide consumes one slice of the `Presentation` view-model
(`CoverData`, `VelocityData`, etc.). All fields are optional; pass `active`
to render a "missing data" inspector for absent required fields.

### Building custom slides

If the canned slides don't fit your use case, compose your own from the
primitives in `slideKit.tsx`:

```tsx
import { Slide, SlideContent, ScopeBarRow, ScopeDivider } from "@imaginaryspace/presentation-kit";

export function CustomSlide({ corners }) {
  return (
    <Slide index={3} variant="cream" corners={corners}>
      <SlideContent title="Quarterly Goals" subtitle="Where we are vs target">
        <ScopeBarRow label="Reach" variant="dark" widthPct={72} value="72%" />
        <ScopeBarRow label="Conversion" variant="accent" widthPct={48} value="48%" />
        <ScopeDivider />
      </SlideContent>
    </Slide>
  );
}
```

## Customisation

### Brand colors

All brand colors are CSS variables on `.ims-presentation`. Override them on a
parent selector (or on `:root`) to rebrand the whole deck:

```css
.ims-presentation {
  --brand-accent: #ff5f00;       /* swap indigo → orange */
  --brand-cream: #fff7ed;
  --brand-foreground: #1a0e00;
}
```

### Fonts

`fonts.css` loads **Newsreader** + **Inter** from Google Fonts and binds them
to two variables:

- `--presentation-display-font` — hero / title type
- `--presentation-body-font` — body copy
- `--presentation-mono-font` — `<code>` chips in the missing-data overlay

Skip `fonts.css` and override these variables to use your own fonts:

```css
:root {
  --presentation-display-font: "Your Display Font", serif;
  --presentation-body-font: "Your Body Font", sans-serif;
}
```

If you're using Next.js with `next/font`, you can map `next/font` variables
to these:

```tsx
const display = Newsreader({ subsets: ["latin"], variable: "--presentation-display-font" });
const body = Inter({ subsets: ["latin"], variable: "--presentation-body-font" });
// then add `${display.variable} ${body.variable}` to the <html> className
```

### Image generation

`CoverSlide` and `ClosingSlide` accept an `imageLoader` prop. Provide it to
enable the inline prompt bar that lets users regenerate the slide image:

```tsx
<CoverSlide
  data={data}
  imageLoader={async (prompt) => {
    const res = await fetch("/api/generate-image", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
    const { url } = await res.json();
    return { url };
  }}
  onImageGenerated={(url, prompt) => saveToDb({ url, prompt })}
/>
```

Omit `imageLoader` and the image is rendered read-only (no prompt bar).

## Presentation mode (full-screen)

The CSS supports a full-screen present mode out of the box. Wrap your slides
in `.ims-presentation.ims-presentation-mode.ims-presentation-fullscreen` and
toggle slide visibility via `data-slide-state="entering" | "exiting" | "hidden"`
on each child wrapper. See the source app's `PresentationsTab.tsx` for a
reference implementation if you want to ship this UX.

## Building / testing

```bash
bun install          # or npm install / yarn / pnpm
bun run typecheck    # tsc --noEmit
```

There is no build step; the package ships TypeScript source. If you need
compiled JS, add a `tsup` / `vite` / `rollup` build of your choosing.

## License

UNLICENSED — internal use. Add your own license if you make this public.
