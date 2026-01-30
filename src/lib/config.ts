/**
 * Centralized Configuration
 *
 * ALL configurable values go here. Never hardcode:
 * - Model names, API endpoints, URLs
 * - Rate limits, thresholds
 * - Brand names, emails
 */

import { z } from "zod";
import "dotenv/config";

// ===========================================
// ENVIRONMENT VALIDATION
// ===========================================

const envSchema = z.object({
  // Required
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // Optional with defaults
  AI_MODEL: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),

  // Feature flags
  ENABLE_NEWS_SCRAPER: z.string().optional(),
  ENABLE_TWITTER_SCRAPER: z.string().optional(),
  ENABLE_ONCHAIN_SCRAPER: z.string().optional(),
});

const envParse = envSchema.safeParse(process.env);

if (!envParse.success) {
  console.error("❌ Environment validation failed:");
  console.error(envParse.error.format());
  process.exit(1);
}

const env = envParse.data;

// ===========================================
// CONFIGURATION OBJECT
// ===========================================

export const config = {
  // -----------------------------------------
  // AI / LLM Settings
  // -----------------------------------------
  ai: {
    model: env.AI_MODEL || "claude-3-haiku-20240307",
    maxTokens: 2000,
    temperature: 0.7,
  },

  // -----------------------------------------
  // Voice Profile
  // -----------------------------------------
  voice: {
    twitterHandle: process.env.VOICE_TWITTER_HANDLE || "brianman1",
    style: (process.env.VOICE_STYLE || "casual,data-driven,humorous").split(","),
    tweetMaxLength: Number(process.env.TWEET_MAX_LENGTH) || 280,
  },

  // -----------------------------------------
  // Feature Flags
  // -----------------------------------------
  features: {
    newsScraperEnabled: env.ENABLE_NEWS_SCRAPER !== "false",
    twitterScraperEnabled: env.ENABLE_TWITTER_SCRAPER !== "false",
    onchainScraperEnabled: env.ENABLE_ONCHAIN_SCRAPER !== "false",
  },

  // -----------------------------------------
  // Rate Limits
  // -----------------------------------------
  rateLimits: {
    tweetsPerDay: Number(process.env.TWEETS_PER_DAY) || 5,
    apiCallsPerMinute: Number(process.env.API_CALLS_PER_MINUTE) || 10,
    scraperDelayMs: Number(process.env.SCRAPER_DELAY_MS) || 1000,
  },

  // -----------------------------------------
  // Twitter Accounts to Monitor
  // -----------------------------------------
  twitterAccounts: (process.env.TWITTER_ACCOUNTS ||
    "avalaboratory,avaxfoundation,avalaboratory").split(","),

  // -----------------------------------------
  // News Sources (RSS Feeds)
  // -----------------------------------------
  newsSources: [
    {
      name: "Avalanche Blog",
      url: process.env.RSS_AVALANCHE || "https://medium.com/feed/avalancheavax",
      enabled: true,
    },
    {
      name: "CoinDesk",
      url: process.env.RSS_COINDESK || "https://www.coindesk.com/arc/outboundfeeds/rss/",
      enabled: true,
    },
    {
      name: "The Block",
      url: process.env.RSS_THEBLOCK || "https://www.theblock.co/rss.xml",
      enabled: true,
    },
    {
      name: "Decrypt",
      url: process.env.RSS_DECRYPT || "https://decrypt.co/feed",
      enabled: true,
    },
  ],

  // -----------------------------------------
  // On-Chain Data APIs
  // -----------------------------------------
  onchain: {
    defiLlama: {
      baseUrl: process.env.DEFILLAMA_API || "https://api.llama.fi",
      chainSlug: process.env.CHAIN_SLUG || "Avalanche",
    },
    // Add more providers as needed
  },

  // -----------------------------------------
  // Output Settings
  // -----------------------------------------
  output: {
    draftsDir: process.env.DRAFTS_DIR || "./src/data/drafts",
    cacheDir: process.env.CACHE_DIR || "./src/data/cache",
    logLevel: process.env.LOG_LEVEL || "info",
  },

  // -----------------------------------------
  // Generation Settings
  // -----------------------------------------
  generation: {
    includeEmojis: process.env.INCLUDE_EMOJIS !== "false",
    includeHashtags: process.env.INCLUDE_HASHTAGS !== "false",
    defaultHashtags: (process.env.DEFAULT_HASHTAGS || "#Avalanche,#AVAX").split(","),
  },
} as const;

// Export type for autocomplete
export type Config = typeof config;
