# Campaign Payload — Field Reference

```jsonc
{
  "campaignName": "STRING",  // required — used as the output folder name

  "products": [              // required — min 2 products, ids must be unique
    {
      "id": "STRING",        // required — unique slug, used for output folder names (e.g. "td-student-visa")
      "name": "STRING",      // required — human-readable product name
      "description": "STRING", // required — injected into the FLUX image prompt as the subject
      "heroAsset?": "STRING", // optional — path to an existing image relative to --inputs dir (e.g. "assets/hero.jpg"); skips AI generation for this product
      "productImage?": "STRING" // optional — path to a product photo (PNG/JPG) relative to --inputs dir (e.g. "products/shampoo.png"); passed to FLUX as the primary subject reference so the generated hero faithfully reproduces the exact product; generation still runs (unlike heroAsset)
    }
  ],

  "targeting": {
    "audience": "STRING",    // required — injected into the FLUX prompt (e.g. "students aged 17-24, digitally native")
    "regions": ["STRING"]    // required — list of locale codes; each must have a matching key in messages (e.g. ["en", "fr"])
  },

  "messages": {              // required — one entry per locale listed in targeting.regions
    "en": {
      "headline": "STRING",  // required — large bold text overlaid on the image
      "subhead?": "STRING",  // optional — smaller secondary line below the headline
      "font?": ["STRING"]    // optional — font family override for this locale only (e.g. ["Playfair Display"]); falls back to brand.font
    }
  },

  "brand?": {                // optional — omit entirely for unbranded campaigns
    "name": "STRING",        // required if brand is present
    "description?": "STRING", // optional — injected into the FLUX prompt as brand aesthetic context (e.g. "Bold, modern, high-contrast")
    "colors?": ["#HEX"],     // optional — hex brand colors (e.g. ["#00549A", "#FFFFFF"]); injected into prompt and used for post-generation compliance check
    "font?": ["STRING"],     // optional — font family cascade for text overlay (e.g. ["Helvetica Neue", "Arial"]); overridden per-locale by messages[locale].font
    "logo?": {               // optional — composited onto every output image after generation
      "path": "STRING",      // required — path to logo file relative to --inputs dir (e.g. "brands/bell/logo.png")
      "placement?": "top-left | top-right | bottom-left | bottom-right", // optional — corner to pin the logo to; default: "bottom-right"
      "maxHeightPercent?": 8 // optional — logo height as % of image height; default: 8
    },
    "referenceAssets?": "STRING | [STRING]", // optional — path to a folder or list of image file paths relative to --inputs dir (e.g. "brands/bell/" or ["brands/bell/ref1.jpg"]); passed to FLUX as style references, not composited
    "prohibitedWords?": ["STRING"] // optional — words that must not appear in any locale message; violations are flagged in the report (e.g. ["cheap", "free money"])
  },

  "resultingImagePrompt?": "STRING" // optional — appended last to the FLUX prompt; use for scene, mood, or seasonal art direction (e.g. "Golden hour, warm autumn tones")
}
```
