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
  const logoIssues = assets.flatMap((a) =>
    a.compliance.logoPresence.issues.map((i) => ({ asset: a.path, ...i }))
  );
  const colorIssues = assets.flatMap((a) =>
    a.compliance.brandColors.issues.map((i) => ({ asset: a.path, ...i }))
  );

  writeFileSync(
    join(runDir, "report.json"),
    JSON.stringify({
      campaignName: brief.campaignName,
      brand: brief.brand?.name || "none",
      generatedAt: new Date().toISOString(),
      totalAssets: assets.length,
      compliance: {
        legal: {
          prohibitedWords: prohibitedWordsResult,
        },
        brand: {
          logoPresence: { passed: logoIssues.length === 0, issues: logoIssues },
          brandColors:  { passed: colorIssues.length === 0, issues: colorIssues },
        },
      },
      assets,
    }, null, 2)
  );

  const byProduct = brief.products.map((p) => ({
    product: p,
    assets: assets.filter((a) => a.productId === p.id),
  }));

  writeFileSync(
    join(runDir, "report.html"),
    renderHtml(brief, assets, byProduct, prohibitedWordsResult)
  );
}

// ── HTML rendering ───────────────────────────────────────────

function checkRow(label: string, result: ComplianceResult): string {
  const status = result.passed
    ? `<span class="badge pass">PASS</span>`
    : `<span class="badge fail">FAIL</span>`;
  const issues = result.passed
    ? ""
    : `<ul class="issues">${result.issues.map((i) => `<li>${escapeXml(i.message)}</li>`).join("")}</ul>`;
  return `<tr><td>${label}</td><td>${status}</td></tr>${issues ? `<tr><td colspan="2">${issues}</td></tr>` : ""}`;
}

function renderHtml(
  brief: Brief,
  assets: AssetRecord[],
  byProduct: { product: Brief["products"][number]; assets: AssetRecord[] }[],
  prohibitedWordsResult: ComplianceResult
): string {
  const allLogoPass  = assets.every((a) => a.compliance.logoPresence.passed);
  const allColorPass = assets.every((a) => a.compliance.brandColors.passed);

  const logoAggregated: ComplianceResult = {
    passed: allLogoPass,
    issues: assets.flatMap((a) =>
      a.compliance.logoPresence.issues.map((i) => ({ ...i, message: `[${a.path}] ${i.message}` }))
    ),
  };
  const colorAggregated: ComplianceResult = {
    passed: allColorPass,
    issues: assets.flatMap((a) =>
      a.compliance.brandColors.issues.map((i) => ({ ...i, message: `[${a.path}] ${i.message}` }))
    ),
  };

  const overallPass = prohibitedWordsResult.passed && allLogoPass && allColorPass;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(brief.campaignName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0d0d0d; color: #d4d4d4; padding: 2rem; max-width: 1400px; margin: 0 auto; }

  header { border-bottom: 1px solid #222; padding-bottom: 1.25rem; margin-bottom: 2rem; display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  header h1 { font-size: 1.25rem; font-weight: 600; color: #f0f0f0; }
  header p { font-size: 0.8rem; color: #666; }

  /* ── Compliance panel ── */
  .compliance-panel { margin-bottom: 2.5rem; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
  .compliance-panel .panel-header { padding: 0.9rem 1.1rem; display: flex; align-items: center; gap: 0.75rem; background: #111; border-bottom: 1px solid #2a2a2a; }
  .compliance-panel .panel-header h2 { font-size: 0.85rem; font-weight: 600; color: #e0e0e0; letter-spacing: 0.04em; text-transform: uppercase; }
  .overall-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .overall-dot.pass { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
  .overall-dot.fail { background: #f87171; box-shadow: 0 0 6px #f87171; }

  .compliance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .check-block { padding: 1rem 1.1rem; border-right: 1px solid #1e1e1e; }
  .check-block:last-child { border-right: none; }
  .check-block h3 { font-size: 0.7rem; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.6rem; }

  table.checks { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  table.checks td { padding: 0.3rem 0; vertical-align: top; }
  table.checks td:first-child { color: #a0a0a0; padding-right: 0.75rem; white-space: nowrap; }

  .badge { font-size: 0.6rem; font-weight: 700; padding: 2px 6px; border-radius: 3px; letter-spacing: 0.05em; }
  .badge.pass { background: #0f2a1a; color: #4ade80; border: 1px solid #1a4a2a; }
  .badge.fail { background: #2a0f0f; color: #f87171; border: 1px solid #4a1a1a; }

  ul.issues { margin-top: 0.35rem; padding-left: 1rem; font-size: 0.72rem; color: #f87171; }
  ul.issues li { margin-bottom: 0.2rem; line-height: 1.4; }

  /* ── Assets ── */
  .section-label { font-size: 0.75rem; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.85rem; }
  .product { margin-bottom: 2.5rem; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
  .card { background: #131313; border: 1px solid #222; border-radius: 6px; overflow: hidden; }
  .card.has-violation { border-color: #4a2a1a; }
  .card img { width: 100%; display: block; }
  .card footer { padding: 0.55rem 0.7rem; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }

  .pill { font-size: 0.62rem; padding: 2px 7px; border-radius: 99px; font-weight: 500; }
  .pill.locale  { background: #1e1e1e; color: #777; border: 1px solid #2e2e2e; }
  .pill.gen     { background: #0f2a1a; color: #4ade80; }
  .pill.reused  { background: #0f1e2a; color: #60a5fa; }
  .pill.ok      { background: #0f2a1a; color: #4ade80; }
  .pill.warn    { background: #2a1a0f; color: #fb923c; }
</style>
</head><body>

<header>
  <div>
    <h1>${escapeXml(brief.campaignName)}</h1>
    <p>${escapeXml(brief.brand?.name || "Unbranded")} &middot; ${assets.length} assets &middot; ${new Date().toLocaleDateString()}</p>
  </div>
</header>

<!-- ── Compliance Panel ── -->
<div class="compliance-panel">
  <div class="panel-header">
    <span class="overall-dot ${overallPass ? "pass" : "fail"}"></span>
    <h2>Compliance Report</h2>
  </div>
  <div class="compliance-grid">

    <div class="check-block">
      <h3>Legal</h3>
      <table class="checks">
        ${checkRow("Prohibited words", prohibitedWordsResult)}
      </table>
    </div>

    <div class="check-block">
      <h3>Brand</h3>
      <table class="checks">
        ${checkRow("Logo presence", logoAggregated)}
        ${checkRow("Brand colors", colorAggregated)}
      </table>
    </div>

  </div>
</div>

<!-- ── Generated Assets ── -->
${byProduct.map(({ product, assets: pa }) => `
<div class="product">
  <p class="section-label">${escapeXml(product.name)}</p>
  <div class="grid">
    ${pa.map((a) => {
      const compliant = a.compliance.logoPresence.passed && a.compliance.brandColors.passed;
      return `
    <div class="card${compliant ? "" : " has-violation"}">
      <img src="${a.path}" alt="${escapeXml(a.productName)} ${a.ratio} ${a.locale}">
      <footer>
        <span class="pill locale">${a.locale.toUpperCase()}</span>
        <span class="pill locale">${a.ratio}</span>
        <span class="pill ${a.heroSource === "generated" ? "gen" : "reused"}">${a.heroSource}</span>
        <span class="pill ${compliant ? "ok" : "warn"}">${compliant ? "✓" : "⚠"}</span>
      </footer>
    </div>`;
    }).join("")}
  </div>
</div>`).join("")}

</body></html>`;
}
