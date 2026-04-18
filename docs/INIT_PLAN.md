Overview

CLI tool that takes a campaign brief (JSON), generates or reuses hero images via Replicate FLUX 2 Pro, composes ad creatives at 3 aspect ratios with text/logo overlays, runs compliance checks, and outputs an HTML report.
Single provider. Single API key. One command.
Stack

Node 20+ / TypeScript, commander, zod, replicate, sharp, dotenv

NOTE: make sure to add .env in the CLAUDE.md settings so the LLM dont read my secrects

Structure
creative-pipeline/
├── src/
│   ├── cli.ts           # Commander wrapper, calls runPipeline()
│   ├── schema.ts        # Zod schemas + types
│   ├── generate.ts      # EXISTS — core pipeline (validate → generate → compose → report)
│   └── compliance.ts    # Prohibited words, logo check
├── inputs/
│   ├── payloadExample.json  # EXISTS — example brief
│   └── brands/aquapure/     # Logo + reference assets
├── outputs/
├── .env.example
└── README.md

Brief Format
See inputs/payloadExample.json. Key rules:

So the flow is:
1. Validate brief (zod)
2. Per product: get or generate hero
3. Compliance: scan messages for prohibited words ← before composing
4. Per (product × ratio × locale): compose variant (crop + text + logo)
5. Compliance: logo presence + brand color check ← after composing
6. Report (includes compliance results)

brand is entirely optional. Everything inside it except name is optional
brand.referenceAssets → passed to FLUX as input_images (style guides). Separate from brand.logo which is composited post-generation
brand.font → array with fallback chain: ["Montserrat", "Helvetica"]
messages[locale].font → optionally overrides brand.font for that locale
resultingImagePrompt → optional, appended last to auto-built prompt as user custom instructions
products[].heroAsset → optional, skips generation when present
Every locale in targeting.regions must have a matching key in messages

Pipeline (inside generate.ts)
1. Validate brief
Load JSON → zod parse → check regions have matching messages → fail loudly or return typed Brief
2. Per product: get or generate hero

heroAsset exists → read file, skip generation
Missing → buildPrompt() then call FLUX 2 Pro

Prompt assembly order:

Commercial product photography of {product.description}.
Target audience: {targeting.audience}.
Clean composition with space for text overlay, studio lighting.
Brand aesthetic: {brand.description}. (if exists)
Color palette: {brand.colors}. (if exists)
{resultingImagePrompt} (if exists — user instructions last)

FLUX call: { prompt, aspect_ratio: "1:1", output_format: "png", input_images?: [base64 refs] }
One call per product. Not per ratio or locale.
3. Per (product × ratio × locale): compose variant

sharp().resize(w, h, { fit: "cover", position: "attention" }) — saliency crop
SVG overlay: scrim + headline + subhead + CTA from messages[locale]
Font: messages[locale].font → brand.font → sans-serif
Logo composite at brand.logo.placement, scaled to maxHeightPercent
Write to outputs/run_{ts}/{product.id}/{ratio}/{locale}.png

Ratios: 1x1 (1080×1080), 9x16 (1080×1920), 16x9 (1920×1080)
4. Compliance
Prohibited words scan on copy, logo presence assertion, brand color check via sharp().stats()
5. Report
report.json + report.html (dark-themed grid of all assets with metadata)
Output
outputs/run_1713380000/
├── aquapure-sport/
│   ├── 1x1/en.png, fr.png
│   ├── 9x16/en.png, fr.png
│   └── 16x9/en.png, fr.png
├── aquapure-zen/
│   └── (same)
├── report.json
└── report.html
2 products × 3 ratios × 2 locales = 12 assets.
CLI
bashnpx tsx src/cli.ts --brief inputs/payloadExample.json
npx tsx src/cli.ts --brief brief.json --inputs ./assets --output ./out
npx tsx src/cli.ts --brief inputs/payloadExample.json --dry-run
Build Order

schema.ts — zod schemas, validate payloadExample.json
cli.ts — commander wrapper, --dry-run works
generate.ts — wire runPipeline(): validation → hero gen → composition → report
compliance.ts — prohibited words, logo assertion
README + demo video

Design Decisions (for README)

Single provider — one API key, reviewer runs in 30 seconds
User-supplied translations — real clients don't ship auto-translated copy. LLM localization is v2
Logo separate from reference assets — refs influence generation style, logo composited deterministically post-gen
One hero, three ratios — one FLUX call per product, sharp derives ratios. Saves cost, ensures consistency
Text overlay not baked in — SVG gives deterministic typography, per-locale swaps without regeneration
Brand optional — pipeline works brandless, layers on constraints progressively
Font cascade — message font → brand font → sans-serif
resultingImagePrompt appended last — user refines without replacing auto-built prompt