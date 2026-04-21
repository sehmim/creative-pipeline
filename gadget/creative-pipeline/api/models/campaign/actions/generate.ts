import { save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  await preventCrossShopDataAccess(params, record);
  record.status = "generating";
  await save(record);
  await api.enqueue(api.runImageGeneration, { campaignId: record.id });
};

export const options: ActionOptions = {
  actionType: "custom",
};
