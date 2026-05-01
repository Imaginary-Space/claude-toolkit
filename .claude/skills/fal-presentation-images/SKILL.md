---
name: fal-presentation-images
description: >-
  Generates and attaches FAL AI images for presentation-kit cover and closing
  image slots. Use during presentation generation, tech-sync deck creation, or
  when a user asks to add generated imagery to the first/last slides.
---

# FAL presentation images

Use this skill after a `scripts/presentation-kit` deck JSON exists and before
rendering the PPTX.

## Requirements

- `FAL_AI_API_KEY` or `FAL_KEY` must be present in the environment.
- Deck JSON must match `scripts/presentation-kit/src/types/presentation.ts`.
- Run commands from the repo root.

## Generate and attach

Preferred one-step command:

```bash
node scripts/presentation-images.mjs generate out/<client-slug>-<YYYY-MM-DD>.json \
  --client-context "<what the client does, their domain, and the product/workflow being built>"
```

What it does:

- Builds two brand-safe prompts from the deck JSON.
- Feeds FAL a client-business context. Pass this explicitly from Linear,
  Supabase, meeting notes, or the user prompt with `--client-context`; otherwise
  the script infers a compact context from workstreams, asks, actions, and
  timeline rows in the JSON.
- Uses the house image direction: a hand-drawn isometric schematic diagram of
  the client's business context with only 2-3 clean assets, lots of negative
  space, and the slide brand palette (`#FFFFFF`, `#0A0A0A`, `#171717`,
  `#E5E5E5`, `#F05100`). It explicitly bans people, faces, human figures,
  humanoid robots, mascots, and portraits.
- Applies different slot themes: cover shows energy / launch momentum; closing
  shows "let's get to work" readiness without using text.
- Calls FAL `fal-ai/nano-banana-2` by default.
- Requests `aspect_ratio: "16:9"`, `resolution: "1K"`,
  `output_format: "png"`, and one image per slot.
- Downloads images into `out/<deck-name>-assets/`.
- Patches `cover_data.coverImageUrl`, `cover_data.coverImagePrompt`,
  `closing_data.closingImageUrl`, and `closing_data.closingImagePrompt`.

Then render normally:

```bash
./scripts/build-presentation.sh out/<client-slug>-<YYYY-MM-DD>.json out/<client-slug>-<YYYY-MM-DD>.pptx
```

## Useful options

```bash
# Generate only one slot.
node scripts/presentation-images.mjs generate out/client.json --slot cover --client-context "..."
node scripts/presentation-images.mjs generate out/client.json --slot closing --client-context "..."

# Use a different FAL text-to-image model.
node scripts/presentation-images.mjs generate out/client.json --model fal-ai/recraft/v4/pro/text-to-image
node scripts/presentation-images.mjs generate out/client.json --model fal-ai/ideogram/v2
node scripts/presentation-images.mjs generate out/client.json --model fal-ai/flux-pro/v1.1-ultra

# Keep the source JSON unchanged and write a new JSON.
node scripts/presentation-images.mjs generate out/client.json --out out/client-with-images.json

# Read longer context from a file.
node scripts/presentation-images.mjs generate out/client.json --client-context-file out/client-context.txt

# Inspect prompts without generating.
node scripts/presentation-images.mjs prompts out/client.json --client-context "..."
```

## Fallback path

If FAL is unavailable, print prompts, generate images with another available
image tool, then attach the returned files or URLs:

```bash
node scripts/presentation-images.mjs prompts out/client.json --client-context "..."
node scripts/presentation-images.mjs attach out/client.json \
  --cover /path/to/cover.png \
  --closing /path/to/closing.png
```

Do not invent alternate image directions in this workflow. Feed the script the
client's actual business context, then let it run the fixed 2-3 asset isometric
schematic prompt. The script writes the full prompt into `coverImagePrompt` and
`closingImagePrompt` for auditability.
