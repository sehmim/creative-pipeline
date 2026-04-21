# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

Never read or modify `.env`. It must contain `REPLICATE_API_TOKEN` for image generation to work.

## Running the Pipeline

```bash
# Default campaign (npm start shorthand)
npm start

# Arbitrary brief
npx tsx src/cli.ts --campaign inputs/campaigns/td_back_to_school.json

# Custom paths
npx tsx src/cli.ts --campaign inputs/campaigns/td_back_to_school.json --inputs ./inputs --output ./outputs

# Dry-run (validate brief only, no generation)
npx tsx src/cli.ts --campaign inputs/campaigns/td_back_to_school.json --dry-run
```

Sample briefs live in `inputs/campaigns/` (8 examples covering branded, unbranded, multi-locale, custom-prompt scenarios).

## Stack

Node 20+ / TypeScript — executed directly with `tsx`, no compile step. Dependencies: `commander`, `zod`, `replicate`, `sharp`, `dotenv`.

## Architecture

| File | Role |
|------|------|
| `src/cli.ts` | Entry point — Commander wrapper, loads dotenv, calls `runPipeline()` |
| `src/generate.ts` | Core pipeline — validate → hero gen → compose → compliance → report |
| `src/schema.ts` | Zod schemas (`CampaignPayloadSchema`, `ProductSchema`, etc.) |
| `src/types.ts` | TypeScript types inferred from Zod schemas + shared interfaces (`ComplianceResult`, `AssetRecord`, `RATIOS`) |
| `src/compliance.ts` | Prohibited words scan, logo presence + brand-color assertions |
| `src/report.ts` | Writes `report.json` and `report.html` (light-themed asset grid) |
| `src/util.ts` | `resolveFont`, `resolveReferenceAssets`, `pickOverlayColors`, `escapeXml`, `hexToRgb` |
| `payloadExample.json` | Canonical example campaign brief |
| `inputs/brands/<brand>/` | Logo, reference style assets (not committed) |
| `outputs/<slug>_<timestamp>/` | Generated output (gitignored) |

The `gadget/` directory is a separate Shopify app built on the Gadget platform (React Router 7 + Polaris). It is unrelated to the pipeline — do not modify it when working on `src/`.

### Pipeline flow (in `generate.ts → runPipeline`)

1. **Validate** — `CampaignPayloadSchema.safeParse()`, then assert every `targeting.regions` locale has a matching `messages` key
2. **Prohibited words** — `scanProhibitedWords()` runs once against all message strings before any generation
3. **Hero generation** — per product: reuse `product.heroAsset` if present, else call FLUX 2 Pro via Replicate with an assembled prompt; one call per product (not per ratio/locale)
4. **Composition** — per `(product × ratio × locale)`: `sharp().resize(fit:"cover", position:"attention")` + SVG overlay (gradient scrim + headline + subhead) + logo composite
5. **Per-asset compliance** — `checkLogoPresence` + `checkBrandColors` run in parallel via `Promise.all` on each composed buffer
6. **Report** — `writeReport()` emits `report.json` and `report.html`

### Output structure

```
outputs/<slug>_<timestamp>/
├── <productId>/
│   ├── 1x1/<locale>.png      (1080×1080)
│   ├── 9x16/<locale>.png     (1080×1920)
│   └── 16x9/<locale>.png     (1920×1080)
├── report.json
└── report.html
```

### Campaign brief format (key fields)

- `products` — requires **minimum 2** products with unique `id` values (Zod enforces this)
- `brand` — entirely optional; everything inside it except `name` is optional
- `brand.referenceAssets` — string (folder path) or string[] (explicit files); passed to FLUX as `input_images` for style influence; separate from `brand.logo` which is composited post-generation
- `brand.font` / `messages[locale].font` — font cascade: per-locale font → brand font → `sans-serif`
- `products[].heroAsset` — optional path (relative to `inputsDir`); skips FLUX generation when present
- `products[].productImage` — optional reference image sent to FLUX as primary subject (first `input_image`); instructs FLUX to faithfully reproduce that product
- `resultingImagePrompt` — appended last to the auto-built FLUX prompt as user override instructions
- Every locale in `targeting.regions` must have a matching key in `messages`

### Compliance checks

| Check | When | Method |
|-------|------|--------|
| Prohibited words | Pre-generation, once | Regex word-boundary scan of all `messages` headline/subhead |
| Logo presence | Post-composition, per asset | `sharp().extract()` on logo corner region; fails if mean RGB < 10 |
| Brand colors | Post-composition, per asset | `sharp().stats()` mean vs brand hex; fails if Euclidean distance > 100 |

