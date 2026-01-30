import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { generateTweets, saveDrafts } from "@/src/generator/tweet-generator";
import { scrapeTwitter } from "@/src/scrapers/twitter";
import { scrapeNews } from "@/src/scrapers/news";
import { scrapeOnchainData } from "@/src/scrapers/onchain";
import type { TweetDraftsOutput, GenerationInput } from "@/src/types";

const DRAFTS_DIR = path.join(process.cwd(), "src", "data", "drafts");

export async function GET() {
  try {
    // Try to read from filesystem first
    if (fs.existsSync(DRAFTS_DIR)) {
      const files = fs
        .readdirSync(DRAFTS_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();

      if (files.length > 0) {
        const allDrafts: TweetDraftsOutput[] = [];
        const dates: string[] = [];

        for (const file of files) {
          const filePath = path.join(DRAFTS_DIR, file);
          const content = fs.readFileSync(filePath, "utf-8");
          const data = JSON.parse(content) as TweetDraftsOutput;
          allDrafts.push(data);
          dates.push(data.date);
        }

        return NextResponse.json({ drafts: allDrafts, dates });
      }
    }

    // No drafts yet - return empty with message to generate
    return NextResponse.json({
      drafts: [],
      dates: [],
      message: "No drafts yet. Click 'Generate New Drafts' to scrape real data and create tweets."
    });
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return NextResponse.json({
      drafts: [],
      dates: [],
      error: "Failed to load drafts"
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerationInput & { scrapeFirst?: boolean };
    let input: GenerationInput = body;

    // Scrape fresh data if requested or no data provided
    const shouldScrape = body.scrapeFirst !== false && (!body.news?.length && !body.tweets?.length && !body.onchainData);

    if (shouldScrape) {
      console.log("Scraping fresh data from all sources...");

      const scrapedInput: GenerationInput = {};
      const scrapeErrors: string[] = [];

      // Scrape Twitter
      try {
        const twitterResult = await scrapeTwitter();
        if (twitterResult.success && twitterResult.data.length > 0) {
          scrapedInput.tweets = twitterResult.data;
          console.log(`Scraped ${twitterResult.data.length} tweets`);
        } else if (!twitterResult.success) {
          scrapeErrors.push(`Twitter: ${twitterResult.error.message}`);
        }
      } catch (e) {
        scrapeErrors.push(`Twitter: ${e instanceof Error ? e.message : "Unknown error"}`);
      }

      // Scrape News
      try {
        const newsResult = await scrapeNews();
        if (newsResult.success && newsResult.data.length > 0) {
          scrapedInput.news = newsResult.data;
          console.log(`Scraped ${newsResult.data.length} news articles`);
        } else if (!newsResult.success) {
          scrapeErrors.push(`News: ${newsResult.error.message}`);
        }
      } catch (e) {
        scrapeErrors.push(`News: ${e instanceof Error ? e.message : "Unknown error"}`);
      }

      // Scrape On-chain data
      try {
        const onchainResult = await scrapeOnchainData();
        if (onchainResult.success) {
          scrapedInput.onchainData = onchainResult.data;
          console.log("Scraped on-chain data:", scrapedInput.onchainData);
        } else {
          scrapeErrors.push(`On-chain: ${onchainResult.error.message}`);
        }
      } catch (e) {
        scrapeErrors.push(`On-chain: ${e instanceof Error ? e.message : "Unknown error"}`);
      }

      // Log any scrape errors but continue
      if (scrapeErrors.length > 0) {
        console.warn("Some scrapers failed:", scrapeErrors);
      }

      // Use scraped data
      input = scrapedInput;
    }

    // Check if we have any data to work with
    const hasData = input.news?.length || input.tweets?.length || input.onchainData;
    if (!hasData) {
      return NextResponse.json(
        {
          error: "No data available to generate tweets. Make sure Twitter API key is configured and try again.",
          scrapeErrors: []
        },
        { status: 400 }
      );
    }

    // Generate tweets
    const result = await generateTweets(input);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: 500 }
      );
    }

    // Try to save drafts (may fail on read-only filesystems like Vercel)
    try {
      const saveResult = saveDrafts(result.data.drafts, input);
      if (!saveResult.success) {
        console.warn("Could not save drafts to filesystem:", saveResult.error.message);
      }
    } catch (saveError) {
      console.warn("Filesystem save failed (expected on Vercel):", saveError);
    }

    return NextResponse.json({
      drafts: result.data.drafts,
      tokensUsed: result.data.tokensUsed,
      modelUsed: result.data.modelUsed,
      input, // Include the scraped input data for source display
    });
  } catch (error) {
    console.error("Error generating drafts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate drafts" },
      { status: 500 }
    );
  }
}
