# Creative Automation Pipeline

A CLI tool that generates localized social ad campaign assets from a JSON brief using FLUX 2 Pro for hero image generation and Sharp for composition.

## Prerequisites

- Node.js 20+
- A [Replicate](https://replicate.com) API token

## Setup

```bash
npm install
cp .env.example .env   # add your REPLICATE_API_TOKEN
```

`.env` format:
```
REPLICATE_API_TOKEN=r8_...
```

## Running

```bash
# Standard run
npx tsx src/cli.ts --brief inputs/campaigns/td_back_to_school.json

# Custom input/output directories
npx tsx src/cli.ts --brief inputs/campaigns/td_back_to_school.json --inputs ./inputs --output ./outputs

# Validate brief only (no generation, no API calls)
npx tsx src/cli.ts --brief inputs/campaigns/td_back_to_school.json --dry-run

# Or invoke directly (no npm prefix needed)
./src/cli.ts --brief inputs/campaigns/td_back_to_school.json
```

## Input — Campaign Brief

Briefs are JSON files. Two example campaigns are included under `inputs/campaigns/`.

**Minimum required fields:**

```json
{
  "campaignName": "My Campaign",
  "products": [
    { "id": "product-a", "name": "Product A", "description": "..." },
    { "id": "product-b", "name": "Product B", "description": "..." }
  ],
  "targeting": {
    "audience": "Adults 25-40",
    "regions": ["en"]
  },
  "messages": {
    "en": { "headline": "Buy Now" }
  }
}
```

At least **two products** are required. Every locale listed in `targeting.regions` must have a matching key in `messages`.

See [`docs/inputs.md`](docs/inputs.md) for the full optional field reference (`brand`, `logo`, `colors`, `prohibitedWords`, `heroAsset`, etc.).

## Output

Each run produces a timestamped folder under `outputs/`:

```
outputs/back_to_school_banking_2026_<timestamp>/
├── td-student-chequing/
│   ├── 1x1/en.png          (1080×1080 — Feed)
│   ├── 1x1/fr.png
│   ├── 9x16/en.png         (1080×1920 — Stories / Reels / TikTok)
│   ├── 9x16/fr.png
│   ├── 16x9/en.png         (1920×1080 — YouTube / X / LinkedIn)
│   └── 16x9/fr.png
├── td-student-visa/
│   └── ...
├── report.json
└── report.html
```

The `report.html` is a dark-themed visual grid with per-asset compliance badges. Open it in any browser.

## Pipeline

```
Brief JSON
    │
    ▼
1. Validate (Zod + cross-field locale check)
    │
    ▼
2. Prohibited words scan (campaign-wide, pre-generation)
    │
    ▼
3. Hero generation — one FLUX 2 Pro call per product
   (skipped if product.heroAsset is set)
    │
    ▼
4. Composition — per (product × ratio × locale)
   Sharp resize (attention-saliency crop) + SVG overlay (headline, subhead) + logo composite
    │
    ▼
5. Compliance checks per asset
   • Logo presence (corner region brightness heuristic)
   • Brand color match (mean RGB vs. palette, Euclidean distance)
    │
    ▼
6. Report — report.json + report.html
```

## Key Design Decisions

**One hero per product, not per ratio.** FLUX is called once per product at 1:1. All ratio variants are derived from that single image via Sharp's `attention`-based saliency crop. This keeps generation cost proportional to the number of products, not `products × ratios`.

**SVG overlay for text.** Text is rendered as a Sharp-composited SVG rather than baked into the prompt. This makes locale swapping free (no re-generation), keeps the headline/subhead pixel-accurate, and is deterministic across runs.

**Prompt color injection.** When `brand.colors` are provided, they are injected as a hard instruction into the FLUX prompt ("the entire scene must be dominated by these colors"). This improves the brand color compliance pass rate without requiring post-processing recoloring.

**Compliance as reporting, not gating.** Compliance checks flag but do not block. The pipeline always produces all assets; violations are surfaced in the report so a human can review. This avoids silent partial outputs when a check fails.

## Assumptions & Limitations

- **Single hero crop strategy.** The 16:9 crop of a 1:1 hero will lose the top and bottom of the subject. For wide-format placements, a native 16:9 generation would yield better results; this is a deliberate trade-off for cost and speed.
- **Brand color check is approximate.** The check compares the image's mean RGB against the brand palette. A compliant image with a large white area can shift the mean away from a dark brand color and trigger a false positive.
- **Logo presence check is a heuristic.** It samples a corner region and flags if it appears uniformly dark. It does not perform template matching or object detection.
- **No retry on generation failure.** If the Replicate API call fails, the pipeline exits. Production use would warrant retry logic with exponential backoff.
- **Local file storage only.** Assets are written to the local filesystem. The brief schema is designed to be storage-agnostic (paths are resolved via `inputsDir`) so swapping in S3/Azure Blob would require only a loader change.
