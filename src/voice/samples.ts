/**
 * Voice Samples & Style Guidelines
 *
 * These are used to teach the AI your writing style.
 * Add 10-20 of your favorite tweets that represent your voice.
 */

import type { VoiceSample, StyleGuidelines } from "../types";

/**
 * Sample tweets from @brianman1
 *
 * TODO: Add your actual tweets here
 */
export const voiceSamples: VoiceSample[] = [
  // Example format - replace with your real tweets:
  // {
  //   text: "Avalanche just processed 1M transactions in 24 hours. For context, that's more than some L1s do in a week. The subnet thesis is playing out.",
  //   topics: ["avalanche", "data", "subnets"],
  //   engagement: { likes: 150, retweets: 30 },
  // },
];

/**
 * Style guidelines extracted from your tweets
 */
export const styleGuidelines: StyleGuidelines = {
  // Tone
  usesEmojis: true,
  emojiFrequency: "moderate",

  // Structure
  usesThreads: false,
  averageLength: "medium",
  usesHashtags: true,

  // Content style
  dataFirst: true,         // Leads with numbers/stats
  includesHumor: true,     // Adds jokes or wit
  asksQuestions: true,     // Engages audience with questions
  usesCTA: false,          // Avoids "like and RT" type asks

  // Vocabulary
  avoidWords: [
    "bullish",
    "bearish",
    "to the moon",
    "wagmi",
    "ngmi",
    "wen",
    "ser",
    "fren",
    "probably nothing",
    "few understand",
  ],
  preferredTerms: {
    "cryptocurrency": "crypto",
    "decentralized finance": "DeFi",
    "non-fungible token": "NFT",
    "layer 1": "L1",
    "layer 2": "L2",
  },
};

/**
 * Example tweets by category (for AI reference)
 */
export const examplesByCategory: Record<string, string[]> = {
  // When sharing Avalanche news
  news: [
    // Add examples like:
    // "Big news from @avalaboratory - [news]. What this means for builders: [insight]"
  ],

  // When sharing data/metrics
  data: [
    // Add examples like:
    // "Avalanche TVL: $X billion (+Y% this week). The interesting part? [insight]"
  ],

  // When being humorous
  humor: [
    // Add examples of your jokes/wit
  ],

  // When engaging with community
  engagement: [
    // Add examples of how you interact
  ],
};
