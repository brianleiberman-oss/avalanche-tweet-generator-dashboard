/**
 * Voice Profile Scraper
 * Fetches and analyzes tweets from a user to build their voice profile
 */

import { config } from "../lib/config";
import { success, fail } from "../lib/errors";
import type { Result, VoiceSample, StyleGuidelines } from "../types";
import { ErrorCode } from "../types";

const TWITTER_API_BASE = "https://api.twitter.com/2";

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count?: number;
  };
}

interface TwitterTimelineResponse {
  data?: TwitterTweet[];
  meta?: {
    next_token?: string;
    result_count: number;
  };
}

export interface VoiceAnalysis {
  samples: VoiceSample[];
  guidelines: Partial<StyleGuidelines>;
  stats: {
    totalTweets: number;
    avgLength: number;
    avgLikes: number;
    avgRetweets: number;
    topTopics: string[];
    emojiCount: number;
    hashtagCount: number;
    questionCount: number;
  };
}

/**
 * Fetch tweets from a specific user
 */
export async function fetchUserTweets(
  username: string,
  maxTweets: number = 100
): Promise<Result<TwitterTweet[]>> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (!bearerToken || bearerToken === "your-twitter-bearer-token") {
    return fail(ErrorCode.MISSING_ENV_VAR, "Twitter bearer token not configured");
  }

  try {
    // First get user ID
    const userResponse = await fetch(
      `${TWITTER_API_BASE}/users/by/username/${username}?user.fields=public_metrics`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      }
    );

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      return fail(
        ErrorCode.SCRAPER_FAILED,
        `Failed to fetch user @${username}: ${userResponse.status} - ${errorText}`
      );
    }

    const userData = (await userResponse.json()) as { data?: TwitterUser };
    if (!userData.data) {
      return fail(ErrorCode.NO_DATA_AVAILABLE, `User @${username} not found`);
    }

    const userId = userData.data.id;
    console.log(`Found @${username} (ID: ${userId})`);
    console.log(`  Total tweets: ${userData.data.public_metrics?.tweet_count || "unknown"}`);

    const allTweets: TwitterTweet[] = [];
    let nextToken: string | undefined;
    let requestCount = 0;
    const maxRequests = Math.ceil(maxTweets / 100);

    // Paginate through tweets
    while (allTweets.length < maxTweets && requestCount < maxRequests) {
      const url = new URL(`${TWITTER_API_BASE}/users/${userId}/tweets`);
      url.searchParams.set("max_results", "100");
      url.searchParams.set("tweet.fields", "created_at,public_metrics");
      // Exclude retweets and replies to get original content
      url.searchParams.set("exclude", "retweets,replies");

      if (nextToken) {
        url.searchParams.set("pagination_token", nextToken);
      }

      const tweetsResponse = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (!tweetsResponse.ok) {
        console.warn(`Failed to fetch tweets page: ${tweetsResponse.status}`);
        break;
      }

      const tweetsData = (await tweetsResponse.json()) as TwitterTimelineResponse;

      if (tweetsData.data) {
        allTweets.push(...tweetsData.data);
        console.log(`  Fetched ${allTweets.length} tweets...`);
      }

      nextToken = tweetsData.meta?.next_token;
      if (!nextToken) break;

      requestCount++;
      // Rate limit protection
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (allTweets.length === 0) {
      return fail(ErrorCode.NO_DATA_AVAILABLE, `No tweets found for @${username}`);
    }

    console.log(`Total: ${allTweets.length} original tweets fetched`);
    return success(allTweets);
  } catch (error) {
    return fail(ErrorCode.SCRAPER_FAILED, `Failed to fetch tweets: ${error}`);
  }
}

/**
 * Analyze tweets to extract voice patterns
 */
export function analyzeTweets(tweets: TwitterTweet[]): VoiceAnalysis {
  // Filter out tweets that are mostly links or very short
  const substantiveTweets = tweets.filter((t) => {
    const text = t.text.replace(/https?:\/\/\S+/g, "").trim();
    return text.length > 30;
  });

  // Calculate stats
  const lengths = substantiveTweets.map((t) => t.text.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  const likes = substantiveTweets.map((t) => t.public_metrics?.like_count || 0);
  const avgLikes = likes.reduce((a, b) => a + b, 0) / likes.length;

  const retweets = substantiveTweets.map((t) => t.public_metrics?.retweet_count || 0);
  const avgRetweets = retweets.reduce((a, b) => a + b, 0) / retweets.length;

  // Count patterns
  let emojiCount = 0;
  let hashtagCount = 0;
  let questionCount = 0;

  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const hashtagRegex = /#\w+/g;
  const questionRegex = /\?/g;

  for (const tweet of substantiveTweets) {
    const emojis = tweet.text.match(emojiRegex);
    if (emojis) emojiCount += emojis.length;

    const hashtags = tweet.text.match(hashtagRegex);
    if (hashtags) hashtagCount += hashtags.length;

    const questions = tweet.text.match(questionRegex);
    if (questions) questionCount += questions.length;
  }

  // Extract topic keywords (simplified)
  const topicKeywords: Record<string, number> = {};
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "it", "this", "that", "these", "those", "and", "or", "but",
    "if", "so", "as", "its", "just", "not", "you", "your", "we",
    "our", "my", "i", "me", "they", "them", "he", "she", "will",
    "can", "has", "have", "had", "do", "does", "did", "would",
    "could", "should", "may", "might", "about", "what", "when",
    "how", "why", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "nor", "only", "own",
    "same", "than", "too", "very", "now", "also", "here", "there",
    "https", "co", "rt", "via", "amp",
  ]);

  for (const tweet of substantiveTweets) {
    const words = tweet.text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^a-z0-9\s@#]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    for (const word of words) {
      topicKeywords[word] = (topicKeywords[word] || 0) + 1;
    }
  }

  const topTopics = Object.entries(topicKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  // Determine style guidelines
  const emojiFrequency =
    emojiCount / substantiveTweets.length > 1
      ? "heavy"
      : emojiCount / substantiveTweets.length > 0.3
      ? "moderate"
      : emojiCount / substantiveTweets.length > 0.1
      ? "light"
      : "none";

  const avgLengthCategory =
    avgLength > 220 ? "long" : avgLength > 140 ? "medium" : "short";

  // Select best performing tweets as samples
  const sortedByEngagement = [...substantiveTweets].sort((a, b) => {
    const aScore =
      (a.public_metrics?.like_count || 0) + (a.public_metrics?.retweet_count || 0) * 2;
    const bScore =
      (b.public_metrics?.like_count || 0) + (b.public_metrics?.retweet_count || 0) * 2;
    return bScore - aScore;
  });

  // Get top 20 tweets as samples
  const samples: VoiceSample[] = sortedByEngagement.slice(0, 20).map((tweet) => ({
    text: tweet.text,
    topics: extractTopics(tweet.text, topTopics),
    engagement: {
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
    },
  }));

  const guidelines: Partial<StyleGuidelines> = {
    usesEmojis: emojiCount > substantiveTweets.length * 0.2,
    emojiFrequency,
    usesHashtags: hashtagCount > substantiveTweets.length * 0.1,
    averageLength: avgLengthCategory,
    asksQuestions: questionCount > substantiveTweets.length * 0.15,
    dataFirst: containsDataPatterns(substantiveTweets),
    includesHumor: detectHumorPatterns(substantiveTweets),
  };

  return {
    samples,
    guidelines,
    stats: {
      totalTweets: substantiveTweets.length,
      avgLength: Math.round(avgLength),
      avgLikes: Math.round(avgLikes),
      avgRetweets: Math.round(avgRetweets),
      topTopics,
      emojiCount,
      hashtagCount,
      questionCount,
    },
  };
}

/**
 * Extract relevant topics from tweet text
 */
function extractTopics(text: string, topTopics: string[]): string[] {
  const lowerText = text.toLowerCase();
  return topTopics.filter((topic) => lowerText.includes(topic)).slice(0, 5);
}

/**
 * Check if tweets commonly lead with data/numbers
 */
function containsDataPatterns(tweets: TwitterTweet[]): boolean {
  const dataPatterns = [
    /\d+%/,
    /\$[\d,.]+[BMK]?/i,
    /\d+[BMK]\+?/i,
    /\d{1,3}(,\d{3})+/,
    /\d+x/i,
  ];

  let dataCount = 0;
  for (const tweet of tweets) {
    if (dataPatterns.some((p) => p.test(tweet.text))) {
      dataCount++;
    }
  }

  return dataCount > tweets.length * 0.15;
}

/**
 * Detect humor patterns (simplified heuristic)
 */
function detectHumorPatterns(tweets: TwitterTweet[]): boolean {
  const humorIndicators = [
    /lol/i,
    /lmao/i,
    /haha/i,
    /\ud83d\ude02|\ud83d\ude05|\ud83d\ude06|\ud83d\ude23/u, // laughing emojis
    /\ud83d\udc80/u, // skull
    /tbh/i,
    /ngl/i,
    /lowkey/i,
    /highkey/i,
  ];

  let humorCount = 0;
  for (const tweet of tweets) {
    if (humorIndicators.some((p) => p.test(tweet.text))) {
      humorCount++;
    }
  }

  return humorCount > tweets.length * 0.05;
}

/**
 * Build complete voice profile
 */
export async function buildVoiceProfile(
  username: string
): Promise<Result<VoiceAnalysis>> {
  console.log(`\n🎤 Building voice profile for @${username}...\n`);

  const tweetsResult = await fetchUserTweets(username, 200);
  if (!tweetsResult.success) {
    return fail(tweetsResult.error.code, tweetsResult.error.message);
  }

  const analysis = analyzeTweets(tweetsResult.data);

  console.log("\n📊 Voice Analysis Results:");
  console.log(`   Total tweets analyzed: ${analysis.stats.totalTweets}`);
  console.log(`   Average length: ${analysis.stats.avgLength} chars`);
  console.log(`   Average likes: ${analysis.stats.avgLikes}`);
  console.log(`   Average retweets: ${analysis.stats.avgRetweets}`);
  console.log(`   Top topics: ${analysis.stats.topTopics.slice(0, 10).join(", ")}`);
  console.log(`   Emoji usage: ${analysis.guidelines.emojiFrequency}`);
  console.log(`   Uses hashtags: ${analysis.guidelines.usesHashtags}`);
  console.log(`   Asks questions: ${analysis.guidelines.asksQuestions}`);
  console.log(`   Data-driven: ${analysis.guidelines.dataFirst}`);
  console.log(`   Includes humor: ${analysis.guidelines.includesHumor}`);
  console.log(`\n✅ Found ${analysis.samples.length} high-performing sample tweets\n`);

  return success(analysis);
}

/**
 * Generate samples.ts file content
 */
export function generateSamplesFile(
  username: string,
  analysis: VoiceAnalysis
): string {
  const samplesJson = JSON.stringify(analysis.samples, null, 2)
    .replace(/"/g, "'")
    .replace(/\\n/g, "\\n")
    .replace(/'/g, '"');

  const topicsStr = analysis.stats.topTopics.slice(0, 10).join(", ");

  return `/**
 * Voice Samples & Style Guidelines
 *
 * Auto-generated from @${username}'s tweets
 * Generated at: ${new Date().toISOString()}
 * Tweets analyzed: ${analysis.stats.totalTweets}
 */

import type { VoiceSample, StyleGuidelines } from "../types";

/**
 * Top-performing tweets from @${username}
 * These are used to teach the AI your writing style.
 */
export const voiceSamples: VoiceSample[] = ${samplesJson};

/**
 * Style guidelines extracted from @${username}'s tweets
 *
 * Stats:
 * - Average tweet length: ${analysis.stats.avgLength} chars
 * - Average likes: ${analysis.stats.avgLikes}
 * - Average retweets: ${analysis.stats.avgRetweets}
 * - Top topics: ${topicsStr}
 */
export const styleGuidelines: StyleGuidelines = {
  // Tone
  usesEmojis: ${analysis.guidelines.usesEmojis},
  emojiFrequency: "${analysis.guidelines.emojiFrequency}",

  // Structure
  usesThreads: false,
  averageLength: "${analysis.guidelines.averageLength}",
  usesHashtags: ${analysis.guidelines.usesHashtags},

  // Content style
  dataFirst: ${analysis.guidelines.dataFirst},
  includesHumor: ${analysis.guidelines.includesHumor},
  asksQuestions: ${analysis.guidelines.asksQuestions},
  usesCTA: false,

  // Vocabulary - common crypto terms to avoid
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
    "this is huge",
    "game changer",
    "revolutionary",
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
  // Categorized samples could be added here
  news: [],
  data: [],
  humor: [],
  engagement: [],
};
`;
}
