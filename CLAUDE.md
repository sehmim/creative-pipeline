# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

Never read or modify `.env`. It contains secrets (Replicate API key).

## Running the Pipeline

```bash
# Run with example brief (uses inputsDir=inputs/, outputDir=outputs/)
npx tsx src/cli.ts --brief inputs/payloads/td_back_to_school.json

# Custom paths
npx tsx src/cli.ts --brief inputs/payloads/td_back_to_school.json --inputs ./inputs --output ./outputs

# Dry-run (validate brief only, no generation)
npx tsx src/cli.ts --brief inputs/payloads/td_back_to_school.json --dry-run
```

## Stack

Node 20+ / TypeScript — executed directly with `tsx`, no compile step. Dependencies: `commander`, `zod`, `replicate`, `sharp`, `dotenv`.

## Architecture

| File | Role |
|------|------|
| `src/cli.ts` | Entry point — Commander wrapper, loads dotenv, calls `runPipeline()` |
| `src/generate.ts` | Core pipeline — validate → hero gen → compose → compliance → report |
| `src/schema.ts` | Zod schemas + TypeScript types (`BriefSchema`, `Brief`, `Product`) |
| `src/compliance.ts` | Prohibited words scan, logo presence + brand-color assertions |
| `payloadExample.json` | Canonical example campaign brief |
| `inputs/brands/<brand>/` | Logo, reference style assets (not committed) |
| `outputs/run_<timestamp>/` | Generated output (gitignored) |

### Pipeline flow (in `generate.ts → runPipeline`)

1. **Validate** — `BriefSchema.safeParse()`, then assert every `targeting.regions` locale has a matching `messages` key
2. **Hero generation** — per product: reuse `product.heroAsset` if present, else call FLUX 2 Pro via Replicate with an assembled prompt; one call per product (not per ratio/locale)
3. **Composition** — per `(product × ratio × locale)`: `sharp().resize(fit:"cover", position:"attention")` + SVG overlay (scrim + headline + subhead + CTA) + logo composite
4. **Report** — write `report.json` and `report.html` (dark-themed grid) into the run directory

Compliance checks (prohibited words, logo presence, brand color via `sharp().stats()`) are planned between steps 2–3 and after step 3 respectively.

### Output structure

```
outputs/run_<timestamp>/
├── <productId>/
│   ├── 1x1/<locale>.png      (1080×1080)
│   ├── 9x16/<locale>.png     (1080×1920)
│   └── 16x9/<locale>.png     (1920×1080)
├── report.json
└── report.html
```

### Campaign brief format (key fields)

- `brand` — entirely optional; everything inside it except `name` is optional
- `brand.referenceAssets` — passed to FLUX as `input_images` (style influence); separate from `brand.logo` which is composited post-generation
- `brand.font` / `messages[locale].font` — font cascade: message font → brand font → `sans-serif`
- `products[].heroAsset` — optional path (relative to `inputsDir`); skips generation when present
- `resultingImagePrompt` — appended last to the auto-built FLUX prompt as user instructions
- Every locale in `targeting.regions` must have a matching key in `messages`

