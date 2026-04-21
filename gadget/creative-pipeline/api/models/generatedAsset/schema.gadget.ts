import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "generatedAsset" model, go to https://creative-pipeline.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "NK738gEaRRH2",
  fields: {
    campaignProduct: {
      type: "belongsTo",
      parent: { model: "campaignProduct" },
      storageKey: "PddcoEkuW9uW::Dp-hgy1lytnq",
    },
    file: {
      type: "file",
      allowPublicAccess: false,
      validations: { required: true },
      storageKey: "ihnHzbPhdIAH::78a8vf-KIaP_",
    },
    language: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["en", "fr"],
      validations: { required: true },
      storageKey: "ZNYZWeagl7xc::eRjTlQBoJNl2",
    },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "NK738gEaRRH2-BelongsTo-Shop",
    },
    size: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["16x9", "1x1", "9x16"],
      validations: { required: true },
      storageKey: "mrCDaZYe1XnO::BNTms6Dr3BCq",
    },
  },
};
