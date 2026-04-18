import { readdirSync, statSync } from "fs";
import { resolve, join, extname } from "path";
import { type Brief } from "./schema";

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

// Font cascade: per-locale override → brand font → system sans-serif
export function resolveFont(brief: Brief, locale: string): string {
  const msgFonts = brief.messages[locale]?.font;
  if (msgFonts?.length) return msgFonts.map((f) => `'${f}'`).join(", ");

  if (brief.brand?.font?.length) return brief.brand.font.map((f) => `'${f}'`).join(", ");

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
  scrim: string;    // base color for the gradient scrim
  accent: string;   // CTA button and highlight color
  ctaText: string;  // text color on top of the accent button
}

// Picks the most useful scrim + accent pair from brand colors.
// Scrim: darkest color (so the gradient stays readable).
// Accent: most saturated non-dark color (stands out for CTA).
export function pickOverlayColors(brandColors?: string[]): OverlayColors {
  const parsed = (brandColors ?? []).map(hexToRgb).filter((c): c is Rgb => c !== null);

  if (!parsed.length) {
    return { scrim: "#000000", accent: "#ffffff", ctaText: "#000000" };
  }

  // Scrim: darkest brand color; if none is dark enough, darken the primary
  const sorted = [...parsed].sort((a, b) => luminance(a) - luminance(b));
  const darkest = sorted[0];
  const scrim = luminance(darkest) < 0.15 ? rgbToHex(darkest) : darken(rgbToHex(sorted[0]), 0.5);

  // Accent: most saturated color that isn't near-white (luminance < 0.8)
  const candidates = parsed.filter((c) => luminance(c) < 0.8);
  const accent = candidates.length
    ? rgbToHex(candidates.reduce((best, c) => {
        const sat = (rgb: Rgb) => Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
        return sat(c) > sat(best) ? c : best;
      }))
    : rgbToHex(parsed[0]);

  // CTA text: white on dark accents, dark on light accents
  const ctaText = luminance(hexToRgb(accent)!) > 0.4 ? "#1a1a1a" : "#ffffff";

  return { scrim, accent, ctaText };
}
