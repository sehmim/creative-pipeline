// generate.ts — core pipeline: validate → hero → compose → compliance → report

import Replicate from "replicate";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join, dirname, extname } from "path";
import sharp from "sharp";
import { BriefSchema, type Brief, type Product } from "./schema";
import { scanProhibitedWords, checkLogoPresence, checkBrandColors, type ComplianceResult } from "./compliance";
import { writeReport, type AssetRecord } from "./report";
import { escapeXml, resolveFont, resolveReferenceAssets } from "./util";

const replicate = new Replicate();

// Target dimensions for each social placement
const RATIOS = {
  "1x1":  { w: 1080, h: 1080, label: "Feed (Instagram, Facebook)" },
  "9x16": { w: 1080, h: 1920, label: "Stories / Reels / TikTok" },
  "16x9": { w: 1920, h: 1080, label: "YouTube / X / LinkedIn" },
} as const;

type RatioKey = keyof typeof RATIOS;

// ── 1. Validation ───────────────────────────────────────────

function validateBrief(filePath: string): Brief {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  const result = BriefSchema.safeParse(raw);

  if (!result.success) {
    console.error("Brief validation failed:");
    result.error.issues.forEach((i) => console.error(`  ${i.path.join(".")}: ${i.message}`));
    process.exit(1);
  }

  // Zod validates field shapes; this checks cross-field consistency
  const missing = result.data.targeting.regions.filter((r) => !result.data.messages[r]);
  if (missing.length) {
    console.error(`Missing messages for regions: ${missing.join(", ")}`);
    process.exit(1);
  }

  return result.data;
}

// ── 2. Prompt Building ──────────────────────────────────────

// resultingImagePrompt is appended last so user instructions override auto-built context
function buildPrompt(product: Product, brief: Brief): string {
  const parts = [
    `Commercial product photography of ${product.description}.`,
    `The product is the undisputed hero and sole focus of the image — centered, prominent, and sharply in focus. Nothing competes with it for attention.`,
    `Target audience: ${brief.targeting.audience}.`,
    `Clean composition with ample negative space at the bottom third for text overlay. Studio lighting with a subtle spotlight on the product.`,
  ];

  if (brief.brand?.description) parts.push(`Brand aesthetic: ${brief.brand.description}.`);
  if (brief.brand?.colors?.length) parts.push(`Color palette: ${brief.brand.colors.join(", ")}.`);
  if (brief.resultingImagePrompt) parts.push(brief.resultingImagePrompt);

  return parts.join(" ");
}

// ── 3. Image Generation ─────────────────────────────────────

// One FLUX call per product — ratios are derived from this single 1:1 hero via sharp crop
async function generateHero(product: Product, brief: Brief, inputsDir: string): Promise<Buffer> {
  const input: Record<string, any> = {
    prompt: buildPrompt(product, brief),
    aspect_ratio: "1:1",
    output_format: "png",
  };

  // referenceAssets influence generation style; brand.logo is composited separately post-gen
  if (brief.brand?.referenceAssets) {
    const files = resolveReferenceAssets(brief.brand.referenceAssets, inputsDir);
    if (files.length) {
      input.input_images = files.map((p) => {
        const buf = readFileSync(resolve(inputsDir, p));
        const mime = extname(p).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
        return `data:${mime};base64,${buf.toString("base64")}`;
      });
    }
  }

  console.log(`  Generating hero for "${product.name}"...`);
  const output = await replicate.run("black-forest-labs/flux-2-pro", { input });
  const response = await fetch(output as unknown as string);
  return Buffer.from(await response.arrayBuffer());
}

// ── 4. Composition ──────────────────────────────────────────

async function composeVariant(
  heroBuffer: Buffer,
  ratio: RatioKey,
  locale: string,
  brief: Brief,
  inputsDir: string
): Promise<Buffer> {
  const { w, h } = RATIOS[ratio];
  const msg = brief.messages[locale];
  const font = resolveFont(brief, locale);

  // SVG overlay keeps text deterministic and locale-swappable without re-generating the hero
  const svg = `
    <svg width="${w}" height="${h}">
      <rect x="0" y="${h * 0.6}" width="${w}" height="${h * 0.4}" fill="rgba(0,0,0,0.45)"/>
      <text x="${w / 2}" y="${h * 0.75}" font-family="${font}, sans-serif"
            font-size="${Math.round(w * 0.05)}" font-weight="700"
            fill="white" text-anchor="middle">${escapeXml(msg.headline)}</text>
      ${msg.subhead ? `
      <text x="${w / 2}" y="${h * 0.82}" font-family="${font}, sans-serif"
            font-size="${Math.round(w * 0.03)}"
            fill="rgba(255,255,255,0.85)" text-anchor="middle">${escapeXml(msg.subhead)}</text>` : ""}
      ${msg.cta ? `
      <text x="${w / 2}" y="${h * 0.92}" font-family="${font}, sans-serif"
            font-size="${Math.round(w * 0.035)}" font-weight="600"
            fill="white" text-anchor="middle">${escapeXml(msg.cta)}</text>` : ""}
    </svg>`;

  const composites: sharp.OverlayOptions[] = [
    { input: Buffer.from(svg), top: 0, left: 0 },
  ];

  if (brief.brand?.logo) {
    const logo = brief.brand.logo;
    const logoHeight = Math.round(h * ((logo.maxHeightPercent || 8) / 100));
    const logoBuffer = await sharp(resolve(inputsDir, logo.path))
      .resize({ height: logoHeight })
      .toBuffer();

    // sharp uses compass gravity strings instead of corner names
    const gravityMap: Record<string, string> = {
      "bottom-right": "southeast", "bottom-left": "southwest",
      "top-right": "northeast", "top-left": "northwest",
    };
    composites.push({
      input: logoBuffer,
      gravity: (gravityMap[logo.placement || "bottom-right"] || "southeast") as any,
    });
  }

  // position:"attention" uses saliency to keep the subject in frame across all crops
  return sharp(heroBuffer)
    .resize(w, h, { fit: "cover", position: "attention" })
    .composite(composites)
    .png()
    .toBuffer();
}

// ── Main Pipeline ───────────────────────────────────────────

export async function runPipeline(briefPath: string, inputsDir: string, outputDir: string) {
  const brief = validateBrief(briefPath);

  // Prohibited words check runs once before compositing — cheaper than per-asset
  const prohibitedWordsResult = scanProhibitedWords(brief);
  if (!prohibitedWordsResult.passed) {
    console.warn("⚠  Compliance: prohibited words detected:");
    prohibitedWordsResult.issues.forEach((i) => console.warn(`     ${i.message}`));
  } else {
    console.log("✓ Compliance: no prohibited words");
  }

  const ratioKeys = Object.keys(RATIOS) as RatioKey[];
  const total = brief.products.length * ratioKeys.length * brief.targeting.regions.length;

  console.log(`Campaign: "${brief.campaignName}"`);
  console.log(`${brief.products.length} products × ${brief.targeting.regions.length} locales × ${ratioKeys.length} ratios = ${total} assets\n`);

  const runDir = join(outputDir, `run_${Date.now()}`);
  const assets: AssetRecord[] = [];

  for (const product of brief.products) {
    let heroBuffer: Buffer;
    let heroSource: "reused" | "generated";
    let prompt: string | undefined;

    if (product.heroAsset) {
      heroBuffer = readFileSync(resolve(inputsDir, product.heroAsset));
      heroSource = "reused";
      console.log(`✓ Reused hero for "${product.name}"`);
    } else {
      prompt = buildPrompt(product, brief);
      heroBuffer = await generateHero(product, brief, inputsDir);
      heroSource = "generated";
      console.log(`✓ Generated hero for "${product.name}"`);
    }

    for (const ratio of ratioKeys) {
      for (const locale of brief.targeting.regions) {
        const outPath = join(runDir, product.id, ratio, `${locale}.png`);
        mkdirSync(dirname(outPath), { recursive: true });

        const buffer = await composeVariant(heroBuffer, ratio, locale, brief, inputsDir);
        writeFileSync(outPath, buffer);

        // Logo presence and brand color checks run in parallel — both read the same buffer
        const { w, h } = RATIOS[ratio];
        const [logoPresenceResult, brandColorsResult] = await Promise.all([
          brief.brand?.logo
            ? checkLogoPresence(buffer, brief.brand.logo.placement ?? "bottom-right", w, h, brief.brand.logo.maxHeightPercent ?? 8)
            : Promise.resolve({ passed: true, issues: [] } as ComplianceResult),
          brief.brand?.colors?.length
            ? checkBrandColors(buffer, brief.brand.colors)
            : Promise.resolve({ passed: true, issues: [] } as ComplianceResult),
        ]);

        if (!logoPresenceResult.passed || !brandColorsResult.passed) {
          console.warn(`  ⚠  Compliance issues on ${product.id}/${ratio}/${locale}.png:`);
          [...logoPresenceResult.issues, ...brandColorsResult.issues].forEach((i) => console.warn(`     ${i.message}`));
        }

        assets.push({
          productId: product.id,
          productName: product.name,
          ratio,
          ratioLabel: RATIOS[ratio].label,
          locale,
          path: `${product.id}/${ratio}/${locale}.png`,
          heroSource,
          prompt,
          compliance: { logoPresence: logoPresenceResult, brandColors: brandColorsResult },
        });

        console.log(`  → ${product.id}/${ratio}/${locale}.png`);
      }
    }
  }

  writeReport(runDir, brief, assets, prohibitedWordsResult);
  console.log(`\nDone — ${assets.length} assets in ${runDir}`);
}
