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
