import { ActionOptions } from "gadget-server";
import Replicate from "replicate";
import sharp from "sharp";

// ── Pixel dimensions matching src/types.ts RATIOS ───────────
const RATIOS = {
  "1x1":  { w: 1080, h: 1080 },
  "9x16": { w: 1080, h: 1920 },
  "16x9": { w: 1920, h: 1080 },
} as const;
type RatioKey = keyof typeof RATIOS;

// ── Utilities (ported from src/util.ts + src/compliance.ts) ─

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

function resolveFont(brandFonts: string[] | null, messageFonts: string[] | null): string {
  if (messageFonts?.length) return messageFonts.map((f) => `'${f}'`).join(", ");
  if (brandFonts?.length) return brandFonts.map((f) => `'${f}'`).join(", ");
  return "sans-serif";
}

interface Rgb { r: number; g: number; b: number; }

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function luminance({ r, g, b }: Rgb): number {
  return [r, g, b].reduce((acc, c, i) => {
    const s = c / 255;
    const lin = s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    return acc + lin * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function rgbToHex({ r, g, b }: Rgb): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#000000";
  return rgbToHex({ r: Math.round(rgb.r * (1 - amount)), g: Math.round(rgb.g * (1 - amount)), b: Math.round(rgb.b * (1 - amount)) });
}

function pickScrimColor(brandColors: string[] | null): string {
  const parsed = (brandColors ?? []).map(hexToRgb).filter((c): c is Rgb => c !== null);
  if (!parsed.length) return "#000000";
  const sorted = [...parsed].sort((a, b) => luminance(a) - luminance(b));
  const darkest = sorted[0];
  return luminance(darkest) < 0.15 ? rgbToHex(darkest) : darken(rgbToHex(darkest), 0.5);
}

function scanProhibitedWords(
  prohibitedWords: string[] | null,
  messages: Array<{ language: string; headline: string; subhead?: string | null }>
): string[] {
  if (!prohibitedWords?.length) return [];
  const wordSet = new Set(prohibitedWords.map((w) => w.toLowerCase()));
  const found: string[] = [];
  const seen = new Set<string>();
  for (const msg of messages) {
    for (const [field, text] of [["headline", msg.headline], ["subhead", msg.subhead ?? ""]] as const) {
      if (!text) continue;
      for (const word of (text.match(/\b\w+\b/gi) ?? [])) {
        const lower = word.toLowerCase();
        const key = `${msg.language}:${field}:${lower}`;
        if (wordSet.has(lower) && !seen.has(key)) {
          seen.add(key);
          found.push(`"${lower}" in ${msg.language} ${field}`);
        }
      }
    }
  }
  return found;
}

// ── FLUX prompt builder (ported from src/generate.ts) ────────

interface ProductInfo {
  title: string;
  body: string | null;
  productImageUrl: string | null;
}

interface CampaignInfo {
  audience: string | null;
  imagePrompt: string | null;
  brandDescription: string | null;
  brandColors: string[] | null;
}

function buildPrompt(product: ProductInfo, campaign: CampaignInfo): string {
  const parts = [
    `Commercial product photography of ${product.title}${product.body ? `: ${product.body.replace(/<[^>]+>/g, " ").trim().slice(0, 200)}` : ""}.`,
    `The product is the undisputed hero and sole focus of the image — centered, prominent, and sharply in focus. Nothing competes with it for attention.`,
  ];

  if (product.productImageUrl) {
    parts.push(`Faithfully reproduce the exact product shown in the reference image — preserve its shape, label, packaging, and colors precisely. Do not alter or substitute the product.`);
  }

  if (campaign.audience) {
    parts.push(`Target audience: ${campaign.audience}.`);
  }

  parts.push(`Clean composition with ample negative space at the bottom third for text overlay. Studio lighting with a subtle spotlight on the product.`);

  if (campaign.brandDescription) {
    parts.push(`Brand aesthetic: ${campaign.brandDescription}.`);
  }

  if (campaign.brandColors?.length) {
    parts.push(
      `The entire scene must be dominated by these brand colors: ${campaign.brandColors.join(", ")}. ` +
      `Background, ambient lighting, shadows, surfaces, and environmental tones must all strongly reflect this palette. ` +
      `Do not introduce colors outside this palette.`
    );
  }

  if (campaign.imagePrompt) {
    parts.push(campaign.imagePrompt);
  }

  return parts.join(" ");
}

// ── FLUX generation ──────────────────────────────────────────

async function generateHero(
  prompt: string,
  productImageUrl: string | null,
  logger: any
): Promise<Buffer> {
  const replicate = new Replicate();
  const input: Record<string, any> = {
    prompt,
    aspect_ratio: "1:1",
    output_format: "png",
  };

  if (productImageUrl) {
    const res = await fetch(productImageUrl);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get("content-type") ?? "image/jpeg";
      input.input_images = [`data:${mimeType};base64,${buf.toString("base64")}`];
    } else {
      logger.warn({ productImageUrl }, "Could not fetch product image for FLUX — generating without reference");
    }
  }

  logger.info("Calling FLUX 2 Pro via Replicate...");
  const output = await replicate.run("black-forest-labs/flux-2-pro", { input });
  const response = await fetch(output as unknown as string);
  return Buffer.from(await response.arrayBuffer());
}

// ── Composition (ported from src/generate.ts composeVariant) ─

interface MessageInfo {
  language: string;
  headline: string;
  subhead?: string | null;
  fonts: string[] | null;
}

interface BrandInfo {
  fonts: string[] | null;
  colors: string[] | null;
  logoPath: string | null;
  logoPlacement: string | null;
  logoMaxHeightPercent: number | null;
}

async function composeVariant(
  heroBuffer: Buffer,
  ratio: RatioKey,
  message: MessageInfo,
  brand: BrandInfo,
  logoBuffer: Buffer | null
): Promise<Buffer> {
  const { w, h } = RATIOS[ratio];
  const font = resolveFont(brand.fonts as string[] | null, message.fonts);
  const scrim = pickScrimColor(brand.colors as string[] | null);

  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${scrim}" stop-opacity="0"/>
          <stop offset="40%"  stop-color="${scrim}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="${scrim}" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${Math.round(h * 0.42)}" width="${w}" height="${Math.round(h * 0.58)}" fill="url(#scrim)"/>
      <text x="${w / 2}" y="${Math.round(h * 0.70)}"
            font-family="${font}, sans-serif"
            font-size="${Math.round(w * 0.048)}" font-weight="700"
            fill="#ffffff" text-anchor="middle"
            filter="drop-shadow(0 1px 3px rgba(0,0,0,0.5))">${escapeXml(message.headline)}</text>
      ${message.subhead ? `
      <text x="${w / 2}" y="${Math.round(h * 0.775)}"
            font-family="${font}, sans-serif"
            font-size="${Math.round(w * 0.027)}"
            fill="rgba(255,255,255,0.88)" text-anchor="middle">${escapeXml(message.subhead)}</text>` : ""}
    </svg>`;

  const composites: sharp.OverlayOptions[] = [
    { input: Buffer.from(svg), top: 0, left: 0 },
  ];

  if (logoBuffer) {
    const logoHeight = Math.round(h * ((brand.logoMaxHeightPercent ?? 8) / 100));
    const resizedLogo = await sharp(logoBuffer).resize({ height: logoHeight }).toBuffer();
    const gravityMap: Record<string, string> = {
      "bottom-right": "southeast", "bottom-left": "southwest",
      "top-right": "northeast", "top-left": "northwest",
    };
    composites.push({
      input: resizedLogo,
      gravity: (gravityMap[brand.logoPlacement ?? "bottom-right"] ?? "southeast") as any,
    });
  }

  return sharp(heroBuffer)
    .resize(w, h, { fit: "cover", position: "attention" })
    .composite(composites)
    .png()
    .toBuffer();
}

// ── Main action ──────────────────────────────────────────────

export const params = {
  campaignId: { type: "string", required: true },
};

export const run: ActionRun = async ({ params, logger, api }) => {
  const { campaignId } = params;

  logger.info({ campaignId }, "Fetching campaign data");

  const campaign = await api.campaign.findOne(campaignId, {
    select: {
      id: true,
      shopId: true,
      status: true,
      audience: { markdown: true },
      imagePrompt: { markdown: true },
      brand: {
        id: true,
        name: true,
        description: { markdown: true },
        colors: true,
        fonts: true,
        logoPath: true,
        logoPlacement: true,
        logoMaxHeightPercent: true,
        prohibitedWords: true,
      },
      messages: {
        edges: {
          node: {
            id: true,
            language: true,
            headline: true,
            subhead: true,
            fonts: true,
          },
        },
      },
      campaignProducts: {
        edges: {
          node: {
            id: true,
            shopifyProduct: {
              id: true,
              title: true,
              body: true,
              featuredMedia: {
                file: {
                  url: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const messages = campaign.messages.edges.map((e) => e.node);
  const campaignProducts = campaign.campaignProducts.edges.map((e) => e.node);

  // Idempotency: wipe any assets from previous (timed-out) attempts
  const existingAssets = await api.generatedAsset.findMany({
    filter: { campaignProduct: { campaignId: { equals: campaignId } } },
    select: { id: true },
  });
  if (existingAssets.length) {
    await Promise.all(existingAssets.map((a) => api.generatedAsset.delete(a.id)));
    logger.info({ deleted: existingAssets.length }, "Cleared stale assets from prior attempt");
  }

  // Prohibited words check
  const prohibitedWords = campaign.brand?.prohibitedWords as string[] | null;
  const violations = scanProhibitedWords(
    prohibitedWords,
    messages.map((m) => ({ language: m.language, headline: m.headline, subhead: m.subhead }))
  );
  if (violations.length) {
    logger.warn({ violations }, "Prohibited words detected in campaign messages");
  }

  await api.campaign.update(campaignId, { status: "generating" });
  logger.info({ campaignId, products: campaignProducts.length, locales: messages.length }, "Starting generation");

  const brand: BrandInfo = {
    fonts: campaign.brand?.fonts as string[] | null,
    colors: campaign.brand?.colors as string[] | null,
    logoPath: campaign.brand?.logoPath ?? null,
    logoPlacement: campaign.brand?.logoPlacement ?? null,
    logoMaxHeightPercent: campaign.brand?.logoMaxHeightPercent ?? null,
  };

  // Fetch logo once — reused across all variants
  let logoBuffer: Buffer | null = null;
  if (brand.logoPath) {
    try {
      const res = await fetch(brand.logoPath);
      if (res.ok) {
        logoBuffer = Buffer.from(await res.arrayBuffer());
      }
    } catch {
      logger.warn({ logoPath: brand.logoPath }, "Could not fetch logo — compositing without it");
    }
  }

  const campaignInfo: CampaignInfo = {
    audience: (campaign.audience as any)?.markdown ?? null,
    imagePrompt: (campaign.imagePrompt as any)?.markdown ?? null,
    brandDescription: (campaign.brand?.description as any)?.markdown ?? null,
    brandColors: campaign.brand?.colors as string[] | null,
  };

  const ratioKeys = Object.keys(RATIOS) as RatioKey[];

  for (const campaignProduct of campaignProducts) {
    const product = campaignProduct.shopifyProduct;
    if (!product) {
      logger.warn({ campaignProductId: campaignProduct.id }, "No linked Shopify product — skipping");
      continue;
    }

    const productImageUrl = (product.featuredMedia as any)?.file?.url ?? null;

    const productInfo: ProductInfo = {
      title: product.title ?? "Product",
      body: product.body ?? null,
      productImageUrl,
    };

    logger.info({ productTitle: product.title }, "Generating hero image");
    const prompt = buildPrompt(productInfo, campaignInfo);
    const heroBuffer = await generateHero(prompt, productImageUrl, logger);
    logger.info({ productTitle: product.title }, "Hero generated — compositing variants");

    for (const ratio of ratioKeys) {
      for (const message of messages) {
        const composed = await composeVariant(heroBuffer, ratio, message as MessageInfo, brand, logoBuffer);

        await api.generatedAsset.create({
          campaignProduct: { _link: campaignProduct.id },
          shop: { _link: campaign.shopId! },
          language: message.language as "en" | "fr",
          size: ratio as "1x1" | "9x16" | "16x9",
          file: {
            base64: composed.toString("base64"),
            fileName: `${product.title?.toLowerCase().replace(/\s+/g, "-") ?? "product"}-${ratio}-${message.language}.png`,
            mimeType: "image/png",
          },
        });

        logger.info({ productTitle: product.title, ratio, language: message.language }, "Asset saved");
      }
    }
  }

  await api.campaign.update(campaignId, { status: "completed", generatedAt: new Date() });
  logger.info({ campaignId }, "Campaign generation complete");
};

export const options: ActionOptions = {
  triggers: { api: true },
  timeoutMS: 900000, // 15 minutes — FLUX + sharp per product takes ~30-60s each
};
