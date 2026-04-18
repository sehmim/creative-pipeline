import { z } from "zod";
import { CampaignPayloadSchema, ProductSchema, BrandSchema, LocaleMessageSchema, LogoSchema } from "./schema";

// ── Domain types (inferred from Zod schemas) ─────────────────

export type CampaignPayload = z.infer<typeof CampaignPayloadSchema>;
export type Product        = z.infer<typeof ProductSchema>;
export type Brand          = z.infer<typeof BrandSchema>;
export type LocaleMessage  = z.infer<typeof LocaleMessageSchema>;
export type Logo           = z.infer<typeof LogoSchema>;

// ── Compliance ───────────────────────────────────────────────

export interface ComplianceIssue {
  type: "prohibited-word" | "logo-missing" | "brand-color-mismatch";
  message: string;
}

export interface ComplianceResult {
  passed: boolean;
  issues: ComplianceIssue[];
}

// ── Report ───────────────────────────────────────────────────

export interface AssetRecord {
  productId: string;
  productName: string;
  ratio: string;
  ratioLabel: string;
  locale: string;
  path: string;
  heroSource: "reused" | "generated";
  prompt?: string;
  compliance: {
    logoPresence: ComplianceResult;
    brandColors: ComplianceResult;
  };
}

// ── Pipeline ─────────────────────────────────────────────────

export const RATIOS = {
  "1x1":  { w: 1080, h: 1080, label: "Feed (Instagram, Facebook)" },
  "9x16": { w: 1080, h: 1920, label: "Stories / Reels / TikTok" },
  "16x9": { w: 1920, h: 1080, label: "YouTube / X / LinkedIn" },
} as const;

export type RatioKey = keyof typeof RATIOS;
