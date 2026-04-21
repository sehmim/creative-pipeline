import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "brand" model, go to https://creative-pipeline.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "u69N8p2qglPB",
  fields: {
    campaigns: {
      type: "hasMany",
      children: { model: "campaign", belongsToField: "brand" },
      storageKey: "DVnBTLj_5_P5::VwaRze7EwHoX",
    },
    colors: {
      type: "json",
      storageKey: "vB5zFaMMhlQ8::ga0YrHyaDSFy",
    },
    description: {
      type: "richText",
      storageKey: "YNYy_EvSXF96::EjM79o5WBOsN",
    },
    fonts: { type: "json", storageKey: "o3z0VUTzs2i5::X_HnEPgld6Kt" },
    logoMaxHeightPercent: {
      type: "number",
      storageKey: "i_cpa4ZUpunz::LTaafQ-Rwj-d",
    },
    logoPath: {
      type: "string",
      storageKey: "pUd_OtyYbwVs::Lt-uXGLG_wcv",
    },
    logoPlacement: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["top-left", "top-right", "center"],
      storageKey: "LqjEjGdXUZoX::A2aDLs27_0pg",
    },
    name: {
      type: "string",
      validations: { required: true },
      storageKey: "Scz_ssAla_95::HflE0-verL80",
    },
    prohibitedWords: {
      type: "json",
      storageKey: "ApmlErAWcSvG::GrJTv6CKCriE",
    },
    referenceAssets: {
      type: "string",
      storageKey: "_x4UXPlnluc-::FDWBm4w4vNpK",
    },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "u69N8p2qglPB-BelongsTo-Shop",
    },
  },
};
