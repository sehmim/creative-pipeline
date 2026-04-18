# Campaign Brief — Field Reference

```
{
  "campaignName": "STRING", // required

  "products": [
    {
      "id": "STRING",
      "name": "STRING",
      "description": "STRING",
      "heroAsset?": "STRING" // bypasses image generation with a provided image
    }
  ], // required (min 2, unique ids)

  "targeting": {
    "audience": "STRING", // required — description of target users
    "regions": ["STRING"] // required — locales; should match messages keys
  },

  "messages": {
    "locale": {
      "headline": "STRING", // required
      "subhead?": "STRING", // optional
      "font?": ["FONT_FAMILY"] // optional — overrides brand font
    }
  }, // required — per-locale messaging

  "brand?": {
    "name": "STRING",
    "description?": "STRING",
    "colors?": ["#HEX"],
    "font?": ["FONT_FAMILY"],
    "logo?": {
      "path": "STRING",
      "placement?": "top-left | top-right | bottom-left | bottom-right",
      "maxHeightPercent?": 8
    },
    "referenceAssets?": "STRING | [STRING]",
    "prohibitedWords?": ["STRING"]
  }, // controls colors, fonts, logo, references, and compliance checks; omit for no branding

  "resultingImagePrompt?": "STRING" // tweaks final image style
}
```