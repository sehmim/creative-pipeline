#!/usr/bin/env -S npx tsx
import "dotenv/config";
import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve } from "path";
import { CampaignPayloadSchema } from "./schema";
import { runPipeline } from "./generate";

const program = new Command();

program
  .name("creative-pipeline")
  .description("Generate social ad campaign assets from a campaign payload")
  .requiredOption("--campaign <path>", "Path to campaign payload JSON")
  .option("--inputs <dir>", "Input assets directory", "inputs")
  .option("--output <dir>", "Output directory", "outputs")
  .option("--dry-run", "Validate campaign payload only, no generation")
  .action(async (opts: { campaign: string; inputs: string; output: string; dryRun?: boolean }) => {
    const campaignPayloadPath = resolve(opts.campaign);

    if (opts.dryRun) {
      const raw = JSON.parse(readFileSync(campaignPayloadPath, "utf-8"));
      const result = CampaignPayloadSchema.safeParse(raw);
      if (!result.success) {
        console.error("Campaign payload validation failed:");
        result.error.issues.forEach((i) => console.error(`  ${i.path.join(".")}: ${i.message}`));
        process.exit(1);
      }
      const missing = result.data.targeting.regions.filter((r) => !result.data.messages[r]);
      if (missing.length) {
        console.error(`Missing messages for regions: ${missing.join(", ")}`);
        process.exit(1);
      }
      console.log(`✓ Campaign payload valid. Campaign: "${result.data.campaignName}"`);
      console.log(`  Products: ${result.data.products.length}, Regions: ${result.data.targeting.regions.join(", ")}`);
      process.exit(0);
    }

    await runPipeline(campaignPayloadPath, resolve(opts.inputs), resolve(opts.output));
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
