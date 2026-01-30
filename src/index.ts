/**
 * Avalanche Tweet Generator
 *
 * Main entry point. Run with: npm run generate
 */

import { generateTweets, saveDrafts } from "./generator/tweet-generator";
import { config } from "./lib/config";
import { isSuccess, logError } from "./lib/errors";
import type { GenerationInput } from "./types";

async function main() {
  console.log("🏔️  Avalanche Tweet Generator\n");
  console.log(`   Model: ${config.ai.model}`);
  console.log(`   Voice: @${config.voice.twitterHandle}`);
  console.log(`   Drafts per day: ${config.rateLimits.tweetsPerDay}\n`);

  // TODO: Replace with real scraped data from scrapers
  const mockInput: GenerationInput = {
    news: [
      {
        title: "Avalanche Launches New Subnet",
        summary: "A new gaming subnet goes live with 10,000 TPS capability",
        url: "https://example.com/news",
        source: "Avalanche Blog",
        publishedAt: new Date().toISOString(),
      },
    ],
    onchainData: {
      chain: "Avalanche",
      timestamp: new Date().toISOString(),
      tvl: 1_200_000_000, // $1.2B
      tvlChange24h: 3.5,
      transactions24h: 1_500_000,
      activeAddresses24h: 50_000,
    },
    tweets: [
      {
        id: "1",
        author: "Avalanche",
        authorHandle: "avalancheavax",
        content: "Big things coming to the Avalanche ecosystem this week 👀",
        postedAt: new Date().toISOString(),
      },
    ],
  };

  console.log("📊 Input data:");
  console.log(`   - ${mockInput.news?.length || 0} news items`);
  console.log(`   - ${mockInput.tweets?.length || 0} recent tweets`);
  if (mockInput.onchainData?.tvl) {
    console.log(`   - On-chain: $${(mockInput.onchainData.tvl / 1e9).toFixed(2)}B TVL`);
  }
  console.log("");

  console.log("⏳ Generating tweets...\n");

  const result = await generateTweets(mockInput);

  if (!isSuccess(result)) {
    logError("Main", result.error);
    console.error(`\n❌ Failed: ${result.error.code} - ${result.error.message}`);
    process.exit(1);
  }

  const { drafts, tokensUsed, modelUsed } = result.data;

  console.log(`✅ Generated ${drafts.length} tweet drafts\n`);
  console.log(`   Tokens used: ${tokensUsed}`);
  console.log(`   Model: ${modelUsed}\n`);

  drafts.forEach((draft, i) => {
    console.log(`━━━ Draft ${i + 1} (${draft.source}) ━━━`);
    console.log(`📝 ${draft.content}`);
    console.log(`💡 Context: ${draft.context}`);
    console.log(`🎯 Confidence: ${(draft.confidence * 100).toFixed(0)}%\n`);
  });

  // Save drafts
  const saveResult = saveDrafts(drafts);
  if (isSuccess(saveResult)) {
    console.log(`💾 Saved to: ${saveResult.data}`);
  } else {
    logError("Save", saveResult.error);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
