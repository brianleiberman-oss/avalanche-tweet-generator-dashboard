/**
 * News Scraper
 * Fetches real news from RSS feeds about Avalanche
 */

import Parser from "rss-parser";
import { config } from "../lib/config";
import { success, fail } from "../lib/errors";
import type { Result, NewsItem } from "../types";
import { ErrorCode } from "../types";

const parser = new Parser();

// RSS feeds to monitor (removed dead Avalanche Medium blog)
const NEWS_FEEDS = [
  {
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    source: "CoinDesk",
  },
  {
    url: "https://cointelegraph.com/rss",
    source: "CoinTelegraph",
  },
  {
    url: "https://decrypt.co/feed",
    source: "Decrypt",
  },
  {
    url: "https://www.theblock.co/rss.xml",
    source: "The Block",
  },
  {
    url: "https://blockworks.co/feed",
    source: "Blockworks",
  },
];

// Maximum age for news articles (7 days in milliseconds)
const MAX_NEWS_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Keywords to filter for Avalanche-related content
const AVALANCHE_KEYWORDS = [
  "avalanche",
  "avax",
  "ava labs",
  "subnet",
  "c-chain",
  "p-chain",
  "x-chain",
  "avalanchego",
];

/**
 * Check if content is Avalanche-related
 */
function isAvalancheRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  return AVALANCHE_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Calculate relevance score based on keyword matches
 */
function calculateRelevance(title: string, summary: string): number {
  const text = `${title} ${summary}`.toLowerCase();
  let score = 0;

  for (const keyword of AVALANCHE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += keyword === "avalanche" || keyword === "avax" ? 0.3 : 0.1;
    }
  }

  return Math.min(score, 1);
}

/**
 * Check if a date is within the freshness window (last 7 days)
 */
function isFresh(dateStr: string): boolean {
  const publishDate = new Date(dateStr);
  const now = new Date();
  const age = now.getTime() - publishDate.getTime();
  return age <= MAX_NEWS_AGE_MS;
}

/**
 * Fetch news from all RSS feeds
 */
export async function scrapeNews(): Promise<Result<NewsItem[]>> {
  const allNews: NewsItem[] = [];
  const now = new Date();

  for (const feed of NEWS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of parsed.items.slice(0, 30)) { // Check last 30 items
        const title = item.title || "";
        const summary = item.contentSnippet || item.content || "";
        const publishedAt = item.pubDate || new Date().toISOString();

        // CRITICAL: Skip old news (older than 7 days)
        if (!isFresh(publishedAt)) {
          continue;
        }

        // Filter for Avalanche-related content
        if (!isAvalancheRelated(title + summary)) {
          continue;
        }

        allNews.push({
          title,
          summary: summary.slice(0, 500), // Truncate long summaries
          url: item.link || "",
          source: feed.source,
          publishedAt,
          relevanceScore: calculateRelevance(title, summary),
        });
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, config.rateLimits.scraperDelayMs));
    } catch (error) {
      console.warn(`Error fetching RSS from ${feed.source}:`, error);
    }
  }

  if (allNews.length === 0) {
    // No fresh Avalanche news found - this is OK, not an error
    console.log("No fresh Avalanche news found in the last 7 days");
    return success([]);
  }

  // Sort by date, most recent first
  allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  console.log(`Found ${allNews.length} fresh Avalanche news articles`);

  // Return top 10 most recent
  return success(allNews.slice(0, 10));
}

/**
 * Verify a news URL is accessible
 */
export async function verifyNewsUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
