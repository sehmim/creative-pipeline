import { writeFileSync } from "fs";
import { join } from "path";
import { type Brief } from "./schema";
import { type ComplianceResult } from "./compliance";
import { escapeXml } from "./util";

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

export function writeReport(
  runDir: string,
  brief: Brief,
  assets: AssetRecord[],
  prohibitedWordsResult: ComplianceResult
) {
  writeFileSync(
    join(runDir, "report.json"),
    JSON.stringify({
      campaignName: brief.campaignName,
      brand: brief.brand?.name || "none",
      generatedAt: new Date().toISOString(),
      totalAssets: assets.length,
      compliance: { prohibitedWords: prohibitedWordsResult },
      assets,
    }, null, 2)
  );

  const byProduct = brief.products.map((p) => ({
    product: p,
    assets: assets.filter((a) => a.productId === p.id),
  }));

  writeFileSync(join(runDir, "report.html"), renderHtml(brief, assets, byProduct, prohibitedWordsResult));
}

function renderHtml(
  brief: Brief,
  assets: AssetRecord[],
  byProduct: { product: Brief["products"][number]; assets: AssetRecord[] }[],
  prohibitedWordsResult: ComplianceResult
): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(brief.campaignName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0d0d0d; color: #d4d4d4; padding: 2rem; }

  header { border-bottom: 1px solid #222; padding-bottom: 1.25rem; margin-bottom: 1.75rem; }
  header h1 { font-size: 1.25rem; font-weight: 600; color: #f0f0f0; }
  header p { font-size: 0.8rem; color: #666; margin-top: 0.3rem; }

  .alert { font-size: 0.8rem; padding: 0.5rem 0.75rem; border-radius: 5px; margin-bottom: 1.75rem; }
  .alert.pass { background: #0f2a1a; color: #4ade80; border: 1px solid #1a4a2a; }
  .alert.fail { background: #2a0f0f; color: #f87171; border: 1px solid #4a1a1a; }

  .product { margin-bottom: 2.5rem; }
  .product h2 { font-size: 0.9rem; font-weight: 600; color: #a0a0a0; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
  .card { background: #161616; border: 1px solid #222; border-radius: 6px; overflow: hidden; }
  .card img { width: 100%; display: block; }
  .card footer { padding: 0.6rem 0.75rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }

  .pill { font-size: 0.65rem; padding: 2px 7px; border-radius: 99px; font-weight: 500; }
  .pill.locale  { background: #1e1e1e; color: #888; border: 1px solid #333; }
  .pill.gen     { background: #0f2a1a; color: #4ade80; }
  .pill.reused  { background: #0f1e2a; color: #60a5fa; }
  .pill.ok      { background: #0f2a1a; color: #4ade80; }
  .pill.warn    { background: #2a1a0f; color: #fb923c; }
</style>
</head><body>

<header>
  <h1>${escapeXml(brief.campaignName)}</h1>
  <p>${escapeXml(brief.brand?.name || "Unbranded")} &middot; ${assets.length} assets &middot; ${new Date().toLocaleDateString()}</p>
</header>

<div class="alert ${prohibitedWordsResult.passed ? "pass" : "fail"}">
  ${prohibitedWordsResult.passed
    ? "✓ No prohibited words detected"
    : "⚠ " + prohibitedWordsResult.issues.map((i) => escapeXml(i.message)).join(" · ")
  }
</div>

${byProduct.map(({ product, assets: pa }) => `
<section class="product">
  <h2>${escapeXml(product.name)}</h2>
  <div class="grid">
    ${pa.map((a) => `
    <div class="card">
      <img src="${a.path}" alt="${escapeXml(a.productName)} ${a.ratio} ${a.locale}">
      <footer>
        <span class="pill locale">${a.locale.toUpperCase()}</span>
        <span class="pill locale">${a.ratio}</span>
        <span class="pill ${a.heroSource === "generated" ? "gen" : "reused"}">${a.heroSource}</span>
        ${a.compliance.logoPresence.passed && a.compliance.brandColors.passed
          ? '<span class="pill ok">✓</span>'
          : '<span class="pill warn">⚠</span>'
        }
      </footer>
    </div>`).join("")}
  </div>
</section>`).join("")}

</body></html>`;
}
