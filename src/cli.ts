#!/usr/bin/env -S npx tsx
import "dotenv/config";
import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve } from "path";
import { BriefSchema } from "./schema";
import { runPipeline } from "./generate";

const program = new Command();

program
  .name("creative-pipeline")
  .description("Generate social ad campaign assets from a campaign brief")
  .requiredOption("--brief <path>", "Path to campaign brief JSON")
  .option("--inputs <dir>", "Input assets directory", "inputs")
  .option("--output <dir>", "Output directory", "outputs")
  .option("--dry-run", "Validate brief only, no generation")
  .action(async (opts: { brief: string; inputs: string; output: string; dryRun?: boolean }) => {
    const briefPath = resolve(opts.brief);

    if (opts.dryRun) {
      const raw = JSON.parse(readFileSync(briefPath, "utf-8"));
      const result = BriefSchema.safeParse(raw);
      if (!result.success) {
        console.error("Brief validation failed:");
        result.error.issues.forEach((i) => console.error(`  ${i.path.join(".")}: ${i.message}`));
        process.exit(1);
      }
      const missing = result.data.targeting.regions.filter((r) => !result.data.messages[r]);
      if (missing.length) {
        console.error(`Missing messages for regions: ${missing.join(", ")}`);
        process.exit(1);
      }
      console.log(`✓ Brief valid. Campaign: "${result.data.campaignName}"`);
      console.log(`  Products: ${result.data.products.length}, Regions: ${result.data.targeting.regions.join(", ")}`);
      process.exit(0);
    }

    await runPipeline(briefPath, resolve(opts.inputs), resolve(opts.output));
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
