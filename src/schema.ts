import { z } from "zod";

export const LogoSchema = z.object({
  path: z.string(),
  placement: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional(),
  maxHeightPercent: z.number().optional(),
});

export const BrandSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  colors: z.array(z.string()).optional(),
  font: z.array(z.string()).optional(),
  logo: LogoSchema.optional(),
  referenceAssets: z.union([z.string(), z.array(z.string())]).optional(),
  prohibitedWords: z.array(z.string()).optional(),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  heroAsset: z.string().optional(),
  productImage: z.string().optional(),
});

export const LocaleMessageSchema = z.object({
  headline: z.string(),
  subhead: z.string().optional(),
  font: z.array(z.string()).optional(),
});

export const CampaignPayloadSchema = z.object({
  campaignName: z.string(),
  brand: BrandSchema.optional(),
  resultingImagePrompt: z.string().optional(),
  products: z.array(ProductSchema).min(2).refine(
    (ps) => new Set(ps.map((p) => p.id)).size === ps.length,
    { message: "Product ids must be unique" }
  ),
  targeting: z.object({
    audience: z.string(),
    regions: z.array(z.string()).min(1),
  }),
  messages: z.record(z.string(), LocaleMessageSchema),
});
