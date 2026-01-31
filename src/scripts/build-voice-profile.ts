#!/usr/bin/env npx ts-node
/**
 * Build Voice Profile Script
 *
 * Fetches tweets from a user and generates their voice profile
 *
 * Usage:
 *   npm run build:voice              # Uses VOICE_TWITTER_HANDLE from .env
 *   npm run build:voice -- brianman1 # Explicit username
 */

import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { buildVoiceProfile, generateSamplesFile } from "../scrapers/voice-profile";

async function main() {
  // Get username from args or env
  const username =
    process.argv[2] ||
    process.env.VOICE_TWITTER_HANDLE ||
    "brianman1";

  console.log("=".repeat(60));
  console.log("🎤 Voice Profile Builder");
  console.log("=".repeat(60));

  const result = await buildVoiceProfile(username);

  if (!result.success) {
    console.error(`\n❌ Error: ${result.error.message}`);
    process.exit(1);
  }

  const analysis = result.data;

  // Generate the samples.ts file content
  const fileContent = generateSamplesFile(username, analysis);

  // Write to file
  const outputPath = path.join(__dirname, "..", "voice", "samples.ts");
  fs.writeFileSync(outputPath, fileContent);

  console.log(`\n✅ Voice profile saved to: ${outputPath}`);
  console.log("\n📝 Sample tweets saved:");

  for (const sample of analysis.samples.slice(0, 5)) {
    console.log(`\n   "${sample.text.slice(0, 80)}${sample.text.length > 80 ? "..." : ""}"`);
    console.log(`   👍 ${sample.engagement?.likes || 0} likes | 🔁 ${sample.engagement?.retweets || 0} RTs`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎯 Voice profile ready! Run 'npm run generate' to create tweets.");
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
