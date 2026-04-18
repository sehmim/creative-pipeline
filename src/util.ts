import { readdirSync, statSync } from "fs";
import { resolve, join, extname } from "path";
import { type CampaignPayload } from "./types";

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

// Font cascade: per-locale override → brand font → system sans-serif
export function resolveFont(campaignPayload: CampaignPayload, locale: string): string {
  const msgFonts = campaignPayload.messages[locale]?.font;
  if (msgFonts?.length) return msgFonts.map((f) => `'${f}'`).join(", ");

  if (campaignPayload.brand?.font?.length) return campaignPayload.brand.font.map((f) => `'${f}'`).join(", ");

  return "sans-serif";
}

const REFERENCE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Accepts a folder path (string) or explicit file list (string[])
export function resolveReferenceAssets(referenceAssets: string | string[], inputsDir: string): string[] {
  if (Array.isArray(referenceAssets)) return referenceAssets;

  const dir = resolve(inputsDir, referenceAssets);
  if (!statSync(dir).isDirectory()) return [referenceAssets];

  return readdirSync(dir)
    .filter((f) => REFERENCE_EXTS.has(extname(f).toLowerCase()))
    .map((f) => join(referenceAssets, f));
}

// ── Brand color utilities ────────────────────────────────────

export interface Rgb { r: number; g: number; b: number; }

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

// Perceived luminance (0 = black, 1 = white)
function luminance({ r, g, b }: Rgb): number {
  const ch = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function rgbToHex({ r, g, b }: Rgb): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

// Darken a hex color by mixing it with black at the given ratio (0–1)
function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#000000";
  return rgbToHex({
    r: Math.round(rgb.r * (1 - amount)),
    g: Math.round(rgb.g * (1 - amount)),
    b: Math.round(rgb.b * (1 - amount)),
  });
}

export interface OverlayColors {
  scrim: string;
}

// Returns the darkest brand color (or black) to use as the gradient scrim base.
export function pickOverlayColors(brandColors?: string[]): OverlayColors {
  const parsed = (brandColors ?? []).map(hexToRgb).filter((c): c is Rgb => c !== null);

  if (!parsed.length) {
    return { scrim: "#000000" };
  }

  const sorted = [...parsed].sort((a, b) => luminance(a) - luminance(b));
  const darkest = sorted[0];
  const scrim = luminance(darkest) < 0.15 ? rgbToHex(darkest) : darken(rgbToHex(sorted[0]), 0.5);

  return { scrim };
}
