import sharp from "sharp";
import { type CampaignPayload } from "./types";

export type { ComplianceIssue, ComplianceResult } from "./types";

export function scanProhibitedWords(campaignPayload: CampaignPayload): ComplianceResult {
  const prohibited = campaignPayload.brand?.prohibitedWords;
  if (!prohibited?.length) return { passed: true, issues: [] };

  const wordSet = new Set(prohibited.map((w) => w.toLowerCase()));
  const issues: ComplianceIssue[] = [];
  const seen = new Set<string>();

  for (const [locale, msg] of Object.entries(campaignPayload.messages)) {
    const fields: [string, string | undefined][] = [
      ["headline", msg.headline],
      ["subhead", msg.subhead],
    ];
    for (const [field, text] of fields) {
      if (!text) continue;
      const words = text.match(/\b\w+\b/gi) ?? [];
      for (const word of words) {
        const lower = word.toLowerCase();
        if (wordSet.has(lower)) {
          const key = `${locale}:${field}:${lower}`;
          if (!seen.has(key)) {
            seen.add(key);
            issues.push({ type: "prohibited-word", message: `Prohibited word "${lower}" found in ${locale} ${field}` });
          }
        }
      }
    }
  }

  return { passed: issues.length === 0, issues };
}

export async function checkLogoPresence(
  buf: Buffer,
  placement: string,
  imageWidth: number,
  imageHeight: number,
  logoHeightPercent = 8
): Promise<ComplianceResult> {
  const zoneSide = Math.round(imageHeight * logoHeightPercent / 100);
  if (zoneSide < 1) return { passed: true, issues: [] };

  let left: number;
  let top: number;
  switch (placement) {
    case "bottom-left":  left = 0;                     top = imageHeight - zoneSide; break;
    case "top-right":    left = imageWidth - zoneSide;  top = 0;                     break;
    case "top-left":     left = 0;                     top = 0;                     break;
    default:             left = imageWidth - zoneSide;  top = imageHeight - zoneSide; // bottom-right
  }

  const stats = await sharp(buf)
    .extract({ left, top, width: zoneSide, height: zoneSide })
    .stats();

  const [r, g, b] = stats.channels;
  if (r.mean < 10 && g.mean < 10 && b.mean < 10) {
    return { passed: false, issues: [{ type: "logo-missing", message: "Logo corner region appears uniformly dark — composite may have failed" }] };
  }

  return { passed: true, issues: [] };
}

export async function checkBrandColors(buf: Buffer, colors: string[]): Promise<ComplianceResult> {
  if (!colors.length) return { passed: true, issues: [] };

  const hexRe = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
  const parsed = colors
    .map((c) => hexRe.exec(c))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }));

  if (!parsed.length) return { passed: true, issues: [] };

  const stats = await sharp(buf).stats();
  const [rCh, gCh, bCh] = stats.channels;
  const meanR = rCh.mean;
  const meanG = gCh.mean;
  const meanB = bCh.mean;

  const minDist = Math.min(
    ...parsed.map(({ r, g, b }) =>
      Math.sqrt((r - meanR) ** 2 + (g - meanG) ** 2 + (b - meanB) ** 2)
    )
  );

  if (minDist > 100) {
    return {
      passed: false,
      issues: [{
        type: "brand-color-mismatch",
        message: `Image dominant color (R:${Math.round(meanR)}, G:${Math.round(meanG)}, B:${Math.round(meanB)}) does not match any brand color within tolerance`,
      }],
    };
  }

  return { passed: true, issues: [] };
}
