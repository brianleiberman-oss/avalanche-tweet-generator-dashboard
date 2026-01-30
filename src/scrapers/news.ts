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

// RSS feeds to monitor
const NEWS_FEEDS = [
  {
    url: "https://medium.com/feed/avalancheavax",
    source: "Avalanche Blog",
  },
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
];

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
 * Fetch news from all RSS feeds
 */
export async function scrapeNews(): Promise<Result<NewsItem[]>> {
  const allNews: NewsItem[] = [];

  for (const feed of NEWS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of parsed.items.slice(0, 20)) { // Check last 20 items
        const title = item.title || "";
        const summary = item.contentSnippet || item.content || "";

        // Filter for Avalanche-related content (except Avalanche Blog which is all relevant)
        if (feed.source !== "Avalanche Blog" && !isAvalancheRelated(title + summary)) {
          continue;
        }

        allNews.push({
          title,
          summary: summary.slice(0, 500), // Truncate long summaries
          url: item.link || "",
          source: feed.source,
          publishedAt: item.pubDate || new Date().toISOString(),
          relevanceScore: feed.source === "Avalanche Blog" ? 1 : calculateRelevance(title, summary),
        });
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, config.rateLimits.scraperDelayMs));
    } catch (error) {
      console.warn(`Error fetching RSS from ${feed.source}:`, error);
    }
  }

  if (allNews.length === 0) {
    return fail(ErrorCode.NO_DATA_AVAILABLE, "No Avalanche-related news found");
  }

  // Sort by date, most recent first
  allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Return top 10 most relevant
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
