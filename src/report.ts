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

function checkIcon(passed: boolean): string {
  return passed
    ? `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="6" fill="#16a34a"/><path d="M3.5 6l1.8 1.8L8.5 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="6" fill="#dc2626"/><path d="M4 4l4 4M8 4l-4 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

// Per-asset issue block: groups failures under the asset path as a heading
function assetIssueBlock(asset: AssetRecord, prohibitedWords: ComplianceResult): string {
  const issues: { label: string; message: string }[] = [];

  if (!asset.compliance.logoPresence.passed) {
    asset.compliance.logoPresence.issues.forEach((i) =>
      issues.push({ label: "Logo", message: i.message })
    );
  }
  if (!asset.compliance.brandColors.passed) {
    asset.compliance.brandColors.issues.forEach((i) =>
      issues.push({ label: "Brand colors", message: i.message })
    );
  }
  // Prohibited-word issues scoped to this asset's locale
  if (!prohibitedWords.passed) {
    prohibitedWords.issues
      .filter((i) => i.message.startsWith(`Prohibited word`) && i.message.includes(`${asset.locale} `))
      .forEach((i) => issues.push({ label: "Words", message: i.message }));
  }

  if (!issues.length) return "";

  return `
  <div class="asset-issues">
    <div class="asset-issues-path">${escapeXml(asset.productId)} / ${asset.ratio} / ${asset.locale.toUpperCase()} — ${escapeXml(asset.ratioLabel)}</div>
    <ul>
      ${issues.map((i) => `<li><span class="issue-label">${escapeXml(i.label)}</span> ${escapeXml(i.message)}</li>`).join("")}
    </ul>
  </div>`;
}

function renderHtml(
  brief: Brief,
  assets: AssetRecord[],
  byProduct: { product: Brief["products"][number]; assets: AssetRecord[] }[],
  prohibitedWordsResult: ComplianceResult
): string {
  const allLogoPass  = assets.every((a) => a.compliance.logoPresence.passed);
  const allColorPass = assets.every((a) => a.compliance.brandColors.passed);
  const overallPass  = prohibitedWordsResult.passed && allLogoPass && allColorPass;
  const hasLogo      = !!brief.brand?.logo;
  const hasColors    = !!(brief.brand?.colors?.length);
  const hasProhibitedWords = !!(brief.brand?.prohibitedWords?.length);

  const failingAssets = assets.filter(
    (a) => !a.compliance.logoPresence.passed || !a.compliance.brandColors.passed
  );

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeXml(brief.campaignName)} — Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; color: #111827; padding: 2rem; max-width: 1400px; margin: 0 auto; }

  /* ── Header ── */
  header { border-bottom: 1px solid #e5e7eb; padding-bottom: 1.25rem; margin-bottom: 2rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  header h1 { font-size: 1.25rem; font-weight: 600; color: #111827; }
  header .meta { font-size: 0.78rem; color: #6b7280; margin-top: 0.25rem; }
  .overall-tag { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 99px; letter-spacing: 0.05em; white-space: nowrap; }
  .overall-tag.pass { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .overall-tag.fail { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

  /* ── Compliance panel ── */
  .compliance-panel { margin-bottom: 2.5rem; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; }
  .panel-header { padding: 0.75rem 1.2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f3f4f6; }
  .panel-header h2 { font-size: 0.72rem; font-weight: 600; color: #6b7280; letter-spacing: 0.07em; text-transform: uppercase; }

  .compliance-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0; border-bottom: 1px solid #f3f4f6; }
  .check-cell { padding: 1rem 1.2rem; border-right: 1px solid #f3f4f6; }
  .check-cell:last-child { border-right: none; }
  .check-cell-label { font-size: 0.64rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.5rem; }
  .check-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: #374151; padding: 0.25rem 0; }
  .check-row.na { color: #9ca3af; font-style: italic; }
  .check-row svg { flex-shrink: 0; }

  /* ── Issue list ── */
  .issues-section { padding: 1rem 1.2rem; }
  .issues-section-title { font-size: 0.64rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.75rem; }
  .asset-issues { margin-bottom: 0.75rem; padding: 0.65rem 0.9rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; }
  .asset-issues-path { font-size: 0.72rem; font-weight: 600; color: #991b1b; margin-bottom: 0.4rem; font-family: ui-monospace, monospace; }
  .asset-issues ul { padding-left: 1rem; }
  .asset-issues li { font-size: 0.75rem; color: #b91c1c; margin-bottom: 0.2rem; line-height: 1.5; }
  .issue-label { display: inline-block; font-size: 0.6rem; font-weight: 700; background: #dc2626; color: #fff; padding: 1px 5px; border-radius: 3px; margin-right: 0.35rem; vertical-align: middle; letter-spacing: 0.04em; }

  /* ── Divider ── */
  .section-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem; }
  .section-row span { font-size: 0.72rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap; }
  .section-row hr { flex: 1; border: none; border-top: 1px solid #e5e7eb; }

  /* ── Assets ── */
  .product { margin-bottom: 2.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .card.has-violation { border-color: #f87171; }
  .card img { width: 100%; display: block; object-fit: cover; }

  .card-body { padding: 0.6rem 0.75rem; border-top: 1px solid #f3f4f6; }

  /* ratio/locale row */
  .card-placement { font-size: 0.72rem; font-weight: 600; color: #111827; margin-bottom: 0.15rem; }
  .card-sub { font-size: 0.65rem; color: #9ca3af; margin-bottom: 0.55rem; }

  /* check rows inside card */
  .card-checks { display: flex; flex-direction: column; gap: 0.2rem; }
  .card-check { display: flex; align-items: center; gap: 0.35rem; font-size: 0.7rem; }
  .card-check .ck-label { color: #6b7280; flex: 1; }
  .card-check.ck-pass .ck-label { color: #374151; }
  .card-check.ck-fail .ck-label { color: #dc2626; }
  .card-check.ck-na  .ck-label { color: #9ca3af; font-style: italic; }
  .card-check .ck-detail { font-size: 0.62rem; color: #ef4444; display: block; padding-left: 1.25rem; line-height: 1.4; margin-top: 0.1rem; }

  /* source pill */
  .card-footer { padding: 0.4rem 0.75rem; display: flex; align-items: center; gap: 0.35rem; border-top: 1px solid #f3f4f6; }
  .pill { font-size: 0.6rem; padding: 2px 7px; border-radius: 99px; font-weight: 500; }
  .pill.locale  { background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }
  .pill.gen     { background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; }
  .pill.reused  { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
</style>
</head><body>

<header>
  <div>
    <h1>${escapeXml(brief.campaignName)}</h1>
    <p class="meta">${escapeXml(brief.brand?.name || "No brand")} &middot; ${assets.length} assets &middot; ${new Date().toLocaleDateString()}</p>
  </div>
  <span class="overall-tag ${overallPass ? "pass" : "fail"}">${overallPass ? "All checks passed" : "Compliance issues found"}</span>
</header>

<!-- ── Compliance Panel ── -->
<div class="compliance-panel">
  <div class="panel-header">
    <h2>Compliance</h2>
    <span class="overall-tag ${overallPass ? "pass" : "fail"} " style="font-size:0.62rem">${overallPass ? "✓ Pass" : "✗ Fail"}</span>
  </div>

  <div class="compliance-checks">
    <div class="check-cell">
      <p class="check-cell-label">Legal</p>
      ${hasProhibitedWords
        ? `<div class="check-row">${checkIcon(prohibitedWordsResult.passed)} Prohibited words</div>`
        : `<div class="check-row na">— No prohibited words configured</div>`
      }
    </div>

    <div class="check-cell">
      <p class="check-cell-label">Brand — Logo</p>
      ${hasLogo
        ? `<div class="check-row">${checkIcon(allLogoPass)} Logo present on all assets</div>`
        : `<div class="check-row na">— No logo configured</div>`
      }
    </div>

    <div class="check-cell">
      <p class="check-cell-label">Brand — Colors</p>
      ${hasColors
        ? `<div class="check-row">${checkIcon(allColorPass)} Brand palette match (all assets)</div>`
        : `<div class="check-row na">— No brand colors configured</div>`
      }
    </div>
  </div>

  ${failingAssets.length || !prohibitedWordsResult.passed ? `
  <div class="issues-section">
    <p class="issues-section-title">Issues</p>
    ${assets.map((a) => assetIssueBlock(a, prohibitedWordsResult)).join("")}
    ${!prohibitedWordsResult.passed && prohibitedWordsResult.issues.some((i) => !assets.some((a) => i.message.includes(`${a.locale} `)))
      ? `<div class="asset-issues">
           <div class="asset-issues-path">Prohibited words (campaign-wide)</div>
           <ul>${prohibitedWordsResult.issues.map((i) => `<li><span class="issue-label">Words</span> ${escapeXml(i.message)}</li>`).join("")}</ul>
         </div>`
      : ""}
  </div>` : ""}
</div>

<!-- ── Generated Assets ── -->
${byProduct.map(({ product, assets: pa }) => `
<div class="product">
  <div class="section-row"><span>${escapeXml(product.name)}</span><hr></div>
  <div class="grid">
    ${pa.map((a) => {
      const logoOk   = !hasLogo  || a.compliance.logoPresence.passed;
      const colorOk  = !hasColors || a.compliance.brandColors.passed;
      const wordOk   = !hasProhibitedWords || !prohibitedWordsResult.issues.some((i) => i.message.includes(`${a.locale} `));
      const compliant = logoOk && colorOk && wordOk;

      // First issue message for inline detail (truncated)
      const logoMsg  = a.compliance.logoPresence.issues[0]?.message ?? "";
      const colorMsg = a.compliance.brandColors.issues[0]?.message ?? "";

      return `
    <div class="card${compliant ? "" : " has-violation"}">
      <img src="${a.path}" alt="${escapeXml(a.productName)} ${a.ratio} ${a.locale}" loading="lazy">
      <div class="card-body">
        <div class="card-placement">${escapeXml(a.ratioLabel)}</div>
        <div class="card-sub">${a.ratio} &middot; ${a.locale.toUpperCase()}</div>
        <div class="card-checks">
          ${hasLogo
            ? `<div class="card-check ck-${a.compliance.logoPresence.passed ? "pass" : "fail"}">
                 ${checkIcon(a.compliance.logoPresence.passed)}
                 <span class="ck-label">Logo</span>
               </div>${logoMsg ? `<span class="ck-detail">${escapeXml(logoMsg)}</span>` : ""}`
            : `<div class="card-check ck-na">${checkIcon(true)}<span class="ck-label">Logo (n/a)</span></div>`
          }
          ${hasColors
            ? `<div class="card-check ck-${a.compliance.brandColors.passed ? "pass" : "fail"}">
                 ${checkIcon(a.compliance.brandColors.passed)}
                 <span class="ck-label">Brand colors</span>
               </div>${colorMsg ? `<span class="ck-detail">${escapeXml(colorMsg)}</span>` : ""}`
            : `<div class="card-check ck-na">${checkIcon(true)}<span class="ck-label">Colors (n/a)</span></div>`
          }
          ${hasProhibitedWords
            ? `<div class="card-check ck-${wordOk ? "pass" : "fail"}">
                 ${checkIcon(wordOk)}
                 <span class="ck-label">Prohibited words</span>
               </div>`
            : `<div class="card-check ck-na">${checkIcon(true)}<span class="ck-label">Words (n/a)</span></div>`
          }
        </div>
      </div>
      <div class="card-footer">
        <span class="pill ${a.heroSource === "generated" ? "gen" : "reused"}">${a.heroSource === "generated" ? "AI Generated" : "Reused"}</span>
        <span class="pill locale">${a.locale.toUpperCase()}</span>
      </div>
    </div>`;
    }).join("")}
  </div>
</div>`).join("")}

</body></html>`;
}
