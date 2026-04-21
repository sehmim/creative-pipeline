import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "campaignMessage" model, go to https://creative-pipeline.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "aVzikP_VwCfs",
  fields: {
    campaign: {
      type: "belongsTo",
      parent: { model: "campaign" },
      storageKey: "CPxlhWRlpdg7::p3Dk10Y6Yb1x",
    },
    fonts: { type: "json", storageKey: "4g7p2fUWaku1::6UhSnOb38_Pn" },
    headline: {
      type: "string",
      validations: { required: true },
      storageKey: "WS6WK-oDcd7C::3l4P7g-9j15j",
    },
    language: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["en", "fr"],
      validations: { required: true },
      storageKey: "HH6oArbydc4A::QJ806l2E2WpK",
    },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "aVzikP_VwCfs-BelongsTo-Shop",
    },
    subhead: {
      type: "string",
      validations: { required: true },
      storageKey: "bwLZWOhQo532::Uq0JrhUd_p5I",
    },
  },
};
