import { NextResponse } from "next/server";
import { scrapeTwitter } from "@/src/scrapers/twitter";
import { scrapeNews } from "@/src/scrapers/news";
import { scrapeOnchainData } from "@/src/scrapers/onchain";
import type { GenerationInput } from "@/src/types";

/**
 * GET /api/scrape
 * Scrapes real data from Twitter, news, and on-chain sources
 */
export async function GET() {
  const results: {
    input: GenerationInput;
    errors: string[];
    sources: {
      twitter: { success: boolean; count: number; error?: string };
      news: { success: boolean; count: number; error?: string };
      onchain: { success: boolean; error?: string };
    };
  } = {
    input: {},
    errors: [],
    sources: {
      twitter: { success: false, count: 0 },
      news: { success: false, count: 0 },
      onchain: { success: false },
    },
  };

  // Scrape Twitter
  try {
    const twitterResult = await scrapeTwitter();
    if (twitterResult.success) {
      results.input.tweets = twitterResult.data;
      results.sources.twitter = { success: true, count: twitterResult.data.length };
    } else {
      results.sources.twitter = { success: false, count: 0, error: twitterResult.error.message };
      results.errors.push(`Twitter: ${twitterResult.error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    results.sources.twitter = { success: false, count: 0, error: message };
    results.errors.push(`Twitter: ${message}`);
  }

  // Scrape News
  try {
    const newsResult = await scrapeNews();
    if (newsResult.success) {
      results.input.news = newsResult.data;
      results.sources.news = { success: true, count: newsResult.data.length };
    } else {
      results.sources.news = { success: false, count: 0, error: newsResult.error.message };
      results.errors.push(`News: ${newsResult.error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    results.sources.news = { success: false, count: 0, error: message };
    results.errors.push(`News: ${message}`);
  }

  // Scrape On-chain data
  try {
    const onchainResult = await scrapeOnchainData();
    if (onchainResult.success) {
      results.input.onchainData = onchainResult.data;
      results.sources.onchain = { success: true };
    } else {
      results.sources.onchain = { success: false, error: onchainResult.error.message };
      results.errors.push(`On-chain: ${onchainResult.error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    results.sources.onchain = { success: false, error: message };
    results.errors.push(`On-chain: ${message}`);
  }

  return NextResponse.json(results);
}
