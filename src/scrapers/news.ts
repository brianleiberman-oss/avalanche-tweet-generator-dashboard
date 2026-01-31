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

// RSS feeds to monitor - comprehensive crypto and finance sources
const NEWS_FEEDS = [
  // Crypto-native
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
  // Wire services (often break institutional news)
  {
    url: "https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss",
    source: "PR Newswire",
  },
  {
    url: "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFpRWg==",
    source: "Business Wire",
  },
  // Mainstream finance
  {
    url: "https://finance.yahoo.com/rss/topstories",
    source: "Yahoo Finance",
  },
  {
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    source: "CNBC",
  },
  {
    url: "https://www.marketwatch.com/rss/topstories",
    source: "MarketWatch",
  },
  // Reddit (JSON feed)
  {
    url: "https://www.reddit.com/r/avax/hot.json?limit=25",
    source: "Reddit r/avax",
    isReddit: true,
  },
];

// Maximum age for news articles (7 days in milliseconds)
const MAX_NEWS_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Keywords to filter for Avalanche-related content (case-insensitive)
const AVALANCHE_KEYWORDS = [
  "avalanche",
  "avax",
  "$avax",
  "ava labs",
  "avalabs",
  "subnet",
  "c-chain",
  "p-chain",
  "x-chain",
  "avalanchego",
  "emin gun sirer",
  "emin gün sirer",
  "john wu ava",
  // Common misspellings and variations
  "avlanche",
  "avalanch",
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
function isFresh(dateStr: string | number): boolean {
  const publishDate = typeof dateStr === 'number'
    ? new Date(dateStr * 1000) // Unix timestamp
    : new Date(dateStr);
  const now = new Date();
  const age = now.getTime() - publishDate.getTime();
  return age <= MAX_NEWS_AGE_MS;
}

/**
 * Fetch Reddit posts from r/avax
 */
async function fetchReddit(url: string): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AvalancheTweetBot/1.0',
      },
    });
    if (!response.ok) return items;

    const data = await response.json();
    const posts = data?.data?.children || [];

    for (const post of posts) {
      const { title, selftext, url: postUrl, created_utc, score } = post.data || {};
      if (!title || score < 5) continue; // Skip low-engagement posts

      if (!isFresh(created_utc)) continue;

      items.push({
        title,
        summary: (selftext || '').slice(0, 500),
        url: postUrl || `https://reddit.com${post.data.permalink}`,
        source: 'Reddit r/avax',
        publishedAt: new Date(created_utc * 1000).toISOString(),
        relevanceScore: 1, // All r/avax posts are relevant
      });
    }
  } catch (error) {
    console.warn('Error fetching Reddit:', error);
  }
  return items;
}

/**
 * Fetch news from all RSS feeds
 */
export async function scrapeNews(): Promise<Result<NewsItem[]>> {
  const allNews: NewsItem[] = [];

  for (const feed of NEWS_FEEDS) {
    try {
      // Handle Reddit separately
      if ((feed as { isReddit?: boolean }).isReddit) {
        const redditItems = await fetchReddit(feed.url);
        allNews.push(...redditItems);
        continue;
      }

      const parsed = await parser.parseURL(feed.url);

      for (const item of parsed.items.slice(0, 50)) { // Check more items
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
          summary: summary.slice(0, 500),
          url: item.link || "",
          source: feed.source,
          publishedAt,
          relevanceScore: calculateRelevance(title, summary),
        });
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`Error fetching from ${feed.source}:`, error);
    }
  }

  if (allNews.length === 0) {
    console.log("No fresh Avalanche news found in the last 7 days");
    return success([]);
  }

  // Sort by date, most recent first
  allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  console.log(`Found ${allNews.length} fresh Avalanche news articles`);

  // Return top 15 most recent
  return success(allNews.slice(0, 15));
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
