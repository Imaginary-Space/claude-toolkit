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
│   │                           # ScopeBarRow, GanttBar, RecapItem, Pill,
│   │                           # SlideCallout, etc.)
│   ├── MissingData.tsx         # placeholder shown when slide data is incomplete
│   └── GenerativeImage.tsx     # image card with optional prompt bar
├── slides/
│   │   # Default tech-sync deck — these are the seven slides the CLI renders
│   │   # (cover → timeline → numbers → this-week → actions → asks → closing):
│   ├── CoverSlide.tsx
│   ├── TimelineSlide.tsx       # "01 · TIMELINE"
│   ├── NumbersSlide.tsx        # "02 · NUMBERS"
│   ├── WorkstreamsSlide.tsx    # "03 · THIS WEEK"
│   ├── ActionsSlide.tsx        # "04 · ACTIONS"
│   ├── AsksSlide.tsx           # "05 · ASKS"
│   ├── ClosingSlide.tsx
│   │   # Orphan slides — still exported for ad-hoc decks but not part of the
│   │   # default schema:
│   ├── BreathingSlide.tsx
│   ├── VelocitySlide.tsx
│   ├── SprintScopeSlide.tsx
│   ├── RecapSlide.tsx
│   └── DevUpdatesSlide.tsx
├── geometry/
│   ├── velocity-chart-geometry.ts   # cubic-spline SVG path math
│   └── corner-br.ts                 # bottom-right corner label resolver
├── styles/
│   ├── presentations.css            # the entire visual language (~1500 lines)
│   └── fonts.css                    # optional Funnel Display (brand) from Google Fonts
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
import {
  CoverSlide,
  TimelineSlide,
  NumbersSlide,
  WorkstreamsSlide,
  ActionsSlide,
  AsksSlide,
  ClosingSlide,
} from "@imaginaryspace/presentation-kit";

export function Deck() {
  // The wrapper is what defines the scale + injects the design tokens.
  // --scale shrinks the 1920×1080 slides to fit the viewport.
  const corners = { tl: "Imaginary Space", tr: "Apr 30, 2026", bl: "Acme Co", br: "Cycle 21" };
  const footerLabel = "ACME · CYCLE 21 · APR 30, 2026";
  return (
    <div className="ims-presentation" style={{ ["--scale" as string]: "0.5" }}>
      <CoverSlide
        data={{
          heroText: "ACME",
          team: "IMAGINARY SPACE × ACME",
          date: "APR 30, 2026",
          cycle: "CYCLE 21 · TECH SYNC",
        }}
        corners={corners}
      />
      <TimelineSlide
        data={{
          title: "Phase 2 progress",
          dates: ["Now", "Next", "Then", "Launch"],
          todayColumn: 1,
          sections: [
            {
              label: "Phase 2",
              tasks: [{ name: "Foundation", cells: ["done", "empty", "empty", "empty"] }],
            },
          ],
        }}
        corners={corners}
        footerLabel={footerLabel}
      />
      <NumbersSlide
        data={{
          title: "Cycle 21 by the numbers",
          stats: [
            { value: "8 / 27", label: "Issues complete", context: "30% of scope" },
            { value: "27 / 61", label: "Points delivered", context: "44% of scope" },
          ],
        }}
        corners={corners}
        footerLabel={footerLabel}
      />
      <WorkstreamsSlide
        data={{
          title: "Three workstreams in flight",
          workstreams: [
            { id: "ACME-1", name: "API", impact: "Real data replacing mocks", status: "QA", points: "8 pt" },
          ],
        }}
        corners={corners}
        footerLabel={footerLabel}
      />
      <ActionsSlide
        data={{
          title: "From Monday's dev sync",
          actions: [{ owner: "Federico", task: "Save credentials", status: "DONE" }],
        }}
        corners={corners}
        footerLabel={footerLabel}
      />
      <AsksSlide
        data={{
          title: "What we need from Nick",
          asks: [{ ask: "Paid API key", detail: "Nationwide coverage", priority: "BLOCKING WK 2" }],
        }}
        corners={corners}
        footerLabel={footerLabel}
      />
      <ClosingSlide
        data={{
          heroText: "LET'S BUILD",
          thankYou: "THANK YOU",
          teamLine: "IMAGINARY SPACE × ACME",
          dateLine: "APR 30, 2026",
        }}
        corners={corners}
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

The default tokens match the [Imaginary Space](https://imaginaryspace.ai)
brand: `#f05100` orange accent, pure white "paper", `#0a0a0a` dark register,
`#e5e5e5` hairlines. All values are CSS variables on `.ims-presentation`,
so a different brand can be applied with a single override:

```css
.ims-presentation {
  --brand-accent: #6366f1;     /* sub in your accent */
  --brand-cream: #fffdf9;      /* page background */
  --brand-dark: #0d0d0d;       /* dark register */
  --brand-foreground: #1a1a1a; /* primary text */
}
```

### Fonts

`fonts.css` loads **Funnel Display** (the brand site's display + body face)
from Google Fonts and binds it to:

- `--presentation-display-font` — hero / title type
- `--presentation-body-font` — body copy
- `--presentation-mono-font` — `<code>` chips in the missing-data overlay

Skip `fonts.css` and override these variables to use your own fonts:

```css
:root {
  --presentation-display-font: "Your Display Font", sans-serif;
  --presentation-body-font: "Your Body Font", sans-serif;
}
```

If you're using Next.js with `next/font`, map `next/font` variables to these:

```tsx
const display = Funnel_Display({ subsets: ["latin"], variable: "--presentation-display-font" });
// then add `${display.variable}` to the <html> className
```

### Image generation

The cover and closing slides each reserve the top-right image slot
(`902×612px`). In rendered JSON, fill these fields:

- `cover_data.coverImageUrl`
- `cover_data.coverImagePrompt`
- `closing_data.closingImageUrl`
- `closing_data.closingImagePrompt`

For agent/routine workflows, use the helper script after composing the deck JSON
and before rendering:

The default prompt is intentionally fixed: a hand-drawn isometric schematic
diagram of the client's business context with only 2-3 clean assets, lots of
negative space, and the slide brand palette (`#FFFFFF`, `#0A0A0A`, `#171717`,
`#E5E5E5`, `#F05100`). The cover theme shows energy / launch momentum; the
closing theme shows "let's get to work" readiness. The only client-specific
additions are the client name and client-business context.

```bash
# 1. Print brand-safe prompts for the two image slots.
node scripts/presentation-images.mjs prompts out/client-2026-04-30.json \
  --client-context "AI agents automating government RFI responses for real estate / land diligence workflows."

# 2. Preferred: generate both images with FAL using FAL_AI_API_KEY or FAL_KEY.
# Defaults to fal-ai/nano-banana-2.
node scripts/presentation-images.mjs generate out/client-2026-04-30.json \
  --client-context "AI agents automating government RFI responses for real estate / land diligence workflows."

# 3. Alternative: generate images elsewhere, then attach returned local paths or
# URLs. Local files are copied beside the JSON into out/client-2026-04-30-assets/
# and are inlined into the PDF at render time.
node scripts/presentation-images.mjs attach out/client-2026-04-30.json \
  --cover /path/to/generated-cover.png \
  --closing /path/to/generated-closing.png

# 4. Render normally.
./scripts/build-presentation.sh out/client-2026-04-30.json out/client-2026-04-30.pdf
```

In app/editor workflows, `CoverSlide` and `ClosingSlide` also accept an
`imageLoader` prop. Provide it to enable the inline prompt bar that lets users
regenerate the slide image:

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