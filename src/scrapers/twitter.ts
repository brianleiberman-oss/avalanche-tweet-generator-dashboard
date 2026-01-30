/**
 * Twitter/X Scraper
 * Fetches real tweets from Avalanche-related accounts
 */

import { config } from "../lib/config";
import { success, fail } from "../lib/errors";
import type { Result, TwitterPost } from "../types";
import { ErrorCode } from "../types";

const TWITTER_API_BASE = "https://api.twitter.com/2";

// Accounts to monitor - Official + Key Team Members
const AVALANCHE_ACCOUNTS = [
  // Official accounts
  "avax",           // Main Avalanche handle
  "AvalancheFDN",   // Avalanche Foundation
  "AvaLabs",        // Ava Labs
  // Team & Key Contributors
  "el33th4xor",     // Emin Gün Sirer
  "John1wu",        // John Wu
  "JohnNahas84",    // John Nahas
  "stvngts",        // Steven Gates
  "MorganKrupetsky",// Morgan Krupetsky
  "vohvohh",        // Vohvohh
  "avery_bartlett", // Avery Bartlett
  "cryptoreine",    // Cryptoreine
  "kyledineen",     // Kyle Dineen
  "nobsfud",        // NoBsFud
  "__arielle__",    // Arielle
  "dantwany",       // Dan Twany
  "MattSchmenk",    // Matt Schmenk
  "luigidemeo",     // Luigi Demeo
  "Parkk___",       // Parkk
  "glabuz",         // Glabuz
  "encycloplydia",  // Encycloplydia
  "DominicCarb",    // Dominic Carb
  "jnuno",          // J Nuno
  "justinkim415",   // Justin Kim
  "veritaim",       // Veritaim
  "chrischalfoun",  // Chris Chalfoun
  "owenwg",         // Owen WG
  "jackyavalabs",   // Jacky (Ava Labs)
  "Andyvargtz",     // Andy Vargtz
];

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
  author_id: string;
}

interface TwitterResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
  };
  errors?: Array<{ message: string }>;
}

/**
 * Fetch recent tweets from Avalanche accounts
 */
export async function scrapeTwitter(): Promise<Result<TwitterPost[]>> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (!bearerToken || bearerToken === "your-twitter-bearer-token") {
    return fail(ErrorCode.MISSING_ENV_VAR, "Twitter bearer token not configured");
  }

  const allTweets: TwitterPost[] = [];

  for (const username of AVALANCHE_ACCOUNTS) {
    try {
      // First get user ID
      const userResponse = await fetch(
        `${TWITTER_API_BASE}/users/by/username/${username}`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      );

      if (!userResponse.ok) {
        console.warn(`Failed to fetch user ${username}: ${userResponse.status}`);
        continue;
      }

      const userData = await userResponse.json() as { data?: TwitterUser };
      if (!userData.data) continue;

      const userId = userData.data.id;

      // Get recent tweets (5 per account to stay within rate limits)
      const tweetsResponse = await fetch(
        `${TWITTER_API_BASE}/users/${userId}/tweets?max_results=5&tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=name,username`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      );

      if (!tweetsResponse.ok) {
        console.warn(`Failed to fetch tweets for ${username}: ${tweetsResponse.status}`);
        continue;
      }

      const tweetsData = await tweetsResponse.json() as TwitterResponse;

      if (tweetsData.data) {
        for (const tweet of tweetsData.data) {
          allTweets.push({
            id: tweet.id,
            author: userData.data.name,
            authorHandle: username,
            content: tweet.text,
            postedAt: tweet.created_at,
            engagement: tweet.public_metrics ? {
              likes: tweet.public_metrics.like_count,
              retweets: tweet.public_metrics.retweet_count,
              replies: tweet.public_metrics.reply_count,
            } : undefined,
          });
        }
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, config.rateLimits.scraperDelayMs));
    } catch (error) {
      console.warn(`Error fetching tweets for ${username}:`, error);
    }
  }

  if (allTweets.length === 0) {
    return fail(ErrorCode.NO_DATA_AVAILABLE, "No tweets found from monitored accounts");
  }

  // Sort by date, most recent first
  allTweets.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  return success(allTweets);
}

/**
 * Search for tweets about Avalanche
 */
export async function searchAvalancheTweets(query: string = "Avalanche AVAX"): Promise<Result<TwitterPost[]>> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (!bearerToken || bearerToken === "your-twitter-bearer-token") {
    return fail(ErrorCode.MISSING_ENV_VAR, "Twitter bearer token not configured");
  }

  try {
    const response = await fetch(
      `${TWITTER_API_BASE}/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      }
    );

    if (!response.ok) {
      return fail(ErrorCode.SCRAPER_FAILED, `Twitter search failed: ${response.status}`);
    }

    const data = await response.json() as TwitterResponse;

    if (!data.data) {
      return fail(ErrorCode.NO_DATA_AVAILABLE, "No tweets found for query");
    }

    const userMap = new Map<string, TwitterUser>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user);
      }
    }

    const tweets: TwitterPost[] = data.data.map(tweet => {
      const user = userMap.get(tweet.author_id);
      return {
        id: tweet.id,
        author: user?.name || "Unknown",
        authorHandle: user?.username || "unknown",
        content: tweet.text,
        postedAt: tweet.created_at,
        engagement: tweet.public_metrics ? {
          likes: tweet.public_metrics.like_count,
          retweets: tweet.public_metrics.retweet_count,
          replies: tweet.public_metrics.reply_count,
        } : undefined,
      };
    });

    return success(tweets);
  } catch (error) {
    return fail(ErrorCode.SCRAPER_FAILED, "Twitter search failed", error);
  }
}
