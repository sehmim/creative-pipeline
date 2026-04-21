import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "campaign" model, go to https://creative-pipeline.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "LMg05ftnwD7K",
  fields: {
    audience: {
      type: "richText",
      storageKey: "vl1rgbnyi0ZI::efdvVOLSlCt9",
    },
    brand: {
      type: "belongsTo",
      parent: { model: "brand" },
      storageKey: "FGgw73NtTvIw::XfWZI07u6NnN",
    },
    campaignProducts: {
      type: "hasMany",
      children: {
        model: "campaignProduct",
        belongsToField: "campaign",
      },
      storageKey: "8ptT72Bd5AFw::WvGvj9x2rVkw",
    },
    generatedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "Z-lW8WYghNvc::K7MZE7z43j6C",
    },
    imagePrompt: {
      type: "richText",
      validations: { required: true },
      storageKey: "Iph2zaAMSgEo::dB4N0FVVKFml",
    },
    messages: {
      type: "hasMany",
      children: {
        model: "campaignMessage",
        belongsToField: "campaign",
      },
      storageKey: "s5r_Es7KZOwo::h8SlyQhIrLra",
    },
    name: {
      type: "string",
      validations: { required: true },
      storageKey: "h43eYbZCyKO3::PdajQ_HFSIDs",
    },
    regions: {
      type: "json",
      storageKey: "7YppXCK_VbNp::uwOATJLWQfqr",
    },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "LMg05ftnwD7K-BelongsTo-Shop",
    },
    status: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["draft", "generating", "completed"],
      validations: { required: true },
      storageKey: "s-RPKc0vYUqx::TQRRDl829fac",
    },
  },
};
