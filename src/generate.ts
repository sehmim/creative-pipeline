// generate.ts — core pipeline: validate → hero → compose → compliance → report

import Replicate from "replicate";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join, dirname, extname } from "path";
import sharp from "sharp";
import { CampaignPayloadSchema } from "./schema";
import { scanProhibitedWords, checkLogoPresence, checkBrandColors } from "./compliance";
import { writeReport } from "./report";
import { escapeXml, resolveFont, resolveReferenceAssets, pickOverlayColors } from "./util";
import { RATIOS, type RatioKey, type CampaignPayload, type Product, type ComplianceResult, type ComplianceIssue, type AssetRecord } from "./types";

const replicate = new Replicate();

// ── 1. Validation ───────────────────────────────────────────

function validateCampaignPayload(filePath: string): CampaignPayload {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  const result = CampaignPayloadSchema.safeParse(raw);

  if (!result.success) {
    console.error("Campaign payload validation failed:");
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
function buildPrompt(product: Product, campaignPayload: CampaignPayload): string {
  const parts = [
    `Commercial product photography of ${product.description}.`,
    `The product is the undisputed hero and sole focus of the image — centered, prominent, and sharply in focus. Nothing competes with it for attention.`,
  ];

  if (product.productImage) {
    parts.push(
      `Faithfully reproduce the exact product shown in the reference image — preserve its shape, label, packaging, and colors precisely. Do not alter or substitute the product.`
    );
  }

  parts.push(
    `Target audience: ${campaignPayload.targeting.audience}.`,
    `Clean composition with ample negative space at the bottom third for text overlay. Studio lighting with a subtle spotlight on the product.`,
  );

  if (campaignPayload.brand?.description) parts.push(`Brand aesthetic: ${campaignPayload.brand.description}.`);
  if (campaignPayload.brand?.colors?.length) {
    // Forceful color instruction — drives the generated image toward brand palette so compliance checks pass
    parts.push(
      `The entire scene must be dominated by these brand colors: ${campaignPayload.brand.colors.join(", ")}. ` +
      `Background, ambient lighting, shadows, surfaces, and environmental tones must all strongly reflect this palette. ` +
      `Do not introduce colors outside this palette.`
    );
  }
  if (campaignPayload.resultingImagePrompt) parts.push(campaignPayload.resultingImagePrompt);

  return parts.join(" ");
}

// ── 3. Image Generation ─────────────────────────────────────

// One FLUX call per product — ratios are derived from this single 1:1 hero via sharp crop
async function generateHero(productId: string, campaignPayload: CampaignPayload, inputsDir: string): Promise<Buffer> {
  const product = campaignPayload.products.find((p) => p.id === productId)!;
  const input: Record<string, any> = {
    prompt: buildPrompt(product, campaignPayload),
    aspect_ratio: "1:1",
    output_format: "png",
  };

  const inputImages: string[] = [];

  // productImage goes first — FLUX treats first input_image as primary subject reference
  if (product.productImage) {
    const buf = readFileSync(resolve(inputsDir, product.productImage));
    const mime = extname(product.productImage).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
    inputImages.push(`data:${mime};base64,${buf.toString("base64")}`);
  }

  // referenceAssets influence generation style; brand.logo is composited separately post-gen
  if (campaignPayload.brand?.referenceAssets) {
    const files = resolveReferenceAssets(campaignPayload.brand.referenceAssets, inputsDir);
    files.forEach((p) => {
      const buf = readFileSync(resolve(inputsDir, p));
      const mime = extname(p).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
      inputImages.push(`data:${mime};base64,${buf.toString("base64")}`);
    });
  }

  if (inputImages.length) input.input_images = inputImages;

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
  campaignPayload: CampaignPayload,
  inputsDir: string
): Promise<Buffer> {
  const { w, h } = RATIOS[ratio];
  const msg = campaignPayload.messages[locale];
  const font = resolveFont(campaignPayload, locale);

  // SVG overlay keeps text deterministic and locale-swappable without re-generating the hero
  const { scrim } = pickOverlayColors(campaignPayload.brand?.colors);

  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${scrim}" stop-opacity="0"/>
          <stop offset="40%"  stop-color="${scrim}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="${scrim}" stop-opacity="0.92"/>
        </linearGradient>
      </defs>

      <!-- Soft gradient scrim over the bottom half -->
      <rect x="0" y="${Math.round(h * 0.42)}" width="${w}" height="${Math.round(h * 0.58)}" fill="url(#scrim)"/>

      <!-- Headline -->
      <text x="${w / 2}" y="${Math.round(h * 0.70)}"
            font-family="${font}, sans-serif"
            font-size="${Math.round(w * 0.048)}" font-weight="700"
            fill="#ffffff" text-anchor="middle"
            filter="drop-shadow(0 1px 3px rgba(0,0,0,0.5))">${escapeXml(msg.headline)}</text>

      ${msg.subhead ? `
      <!-- Subhead -->
      <text x="${w / 2}" y="${Math.round(h * 0.775)}"
            font-family="${font}, sans-serif"
            font-size="${Math.round(w * 0.027)}"
            fill="rgba(255,255,255,0.88)" text-anchor="middle">${escapeXml(msg.subhead)}</text>` : ""}
    </svg>`;

  const composites: sharp.OverlayOptions[] = [
    { input: Buffer.from(svg), top: 0, left: 0 },
  ];

  if (campaignPayload.brand?.logo) {
    const logo = campaignPayload.brand.logo;
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

export async function runPipeline(campaignPayloadPath: string, inputsDir: string, outputDir: string) {
  const campaignPayload = validateCampaignPayload(campaignPayloadPath);

  // Prohibited words check runs once before compositing — cheaper than per-asset
  const prohibitedWordsResult = scanProhibitedWords(campaignPayload);
  if (!prohibitedWordsResult.passed) {
    console.warn("⚠  Compliance: prohibited words detected:");
    prohibitedWordsResult.issues.forEach((i: ComplianceIssue) => console.warn(`     ${i.message}`));
  } else {
    console.log("✓ Compliance: no prohibited words");
  }

  const ratioKeys = Object.keys(RATIOS) as RatioKey[];
  const total = campaignPayload.products.length * ratioKeys.length * campaignPayload.targeting.regions.length;

  console.log(`Campaign: "${campaignPayload.campaignName}"`);
  console.log(`${campaignPayload.products.length} products × ${campaignPayload.targeting.regions.length} locales × ${ratioKeys.length} ratios = ${total} assets\n`);

  const slug = campaignPayload.campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const runDir = join(outputDir, `${slug}_${Date.now()}`);
  const assets: AssetRecord[] = [];

  for (const product of campaignPayload.products) {
    let heroBuffer: Buffer;
    let heroSource: "reused" | "generated";
    let prompt: string | undefined;

    if (product.heroAsset) {
      heroBuffer = readFileSync(resolve(inputsDir, product.heroAsset));
      heroSource = "reused";
      console.log(`✓ Reused hero for "${product.name}"`);
    } else {
      prompt = buildPrompt(product, campaignPayload);
      heroBuffer = await generateHero(product.id, campaignPayload, inputsDir);
      heroSource = "generated";
      console.log(`✓ Generated hero for "${product.name}"`);
    }

    for (const ratio of ratioKeys) {
      for (const locale of campaignPayload.targeting.regions) {
        const outPath = join(runDir, product.id, ratio, `${locale}.png`);
        mkdirSync(dirname(outPath), { recursive: true });

        const buffer = await composeVariant(heroBuffer, ratio, locale, campaignPayload, inputsDir);
        writeFileSync(outPath, buffer);

        // Logo presence and brand color checks run in parallel — both read the same buffer
        const { w, h } = RATIOS[ratio];
        const [logoPresenceResult, brandColorsResult] = await Promise.all([
          campaignPayload.brand?.logo
            ? checkLogoPresence(buffer, campaignPayload.brand.logo.placement ?? "bottom-right", w, h, campaignPayload.brand.logo.maxHeightPercent ?? 8)
            : Promise.resolve({ passed: true, issues: [] } as ComplianceResult),
          campaignPayload.brand?.colors?.length
            ? checkBrandColors(buffer, campaignPayload.brand.colors)
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

  writeReport(runDir, campaignPayload, assets, prohibitedWordsResult);
  console.log(`\nDone — ${assets.length} assets in ${runDir}`);
}
