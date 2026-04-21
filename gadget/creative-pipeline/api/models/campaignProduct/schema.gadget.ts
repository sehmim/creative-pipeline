import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "campaignProduct" model, go to https://creative-pipeline.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "1vnZrUBeyRFw",
  fields: {
    campaign: {
      type: "belongsTo",
      parent: { model: "campaign" },
      storageKey: "v0XJcBwg7101::xHwqdYjI4Tr6",
    },
    customPrompt: {
      type: "richText",
      storageKey: "f-IcJ9cIevFK::2V7kozMgjFCF",
    },
    generatedAssets: {
      type: "hasMany",
      children: {
        model: "generatedAsset",
        belongsToField: "campaignProduct",
      },
      storageKey: "7T9U0VZXiGzb::i758vGgev50C",
    },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "1vnZrUBeyRFw-BelongsTo-Shop",
    },
    shopifyProduct: {
      type: "belongsTo",
      parent: { model: "shopifyProduct" },
      storageKey: "ba0focJ_vJpB::h7TDv0sJeCRp",
    },
  },
};
