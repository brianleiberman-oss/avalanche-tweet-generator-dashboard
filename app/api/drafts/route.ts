import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { generateTweets, saveDrafts } from "@/src/generator/tweet-generator";
import type { TweetDraftsOutput, GenerationInput } from "@/src/types";

const DRAFTS_DIR = path.join(process.cwd(), "src", "data", "drafts");

// Fallback sample data for production/demo
const SAMPLE_DRAFTS: TweetDraftsOutput = {
  date: new Date().toISOString().split("T")[0],
  generatedAt: new Date().toISOString(),
  input: {
    news: [
      {
        title: "Avalanche Network Overview",
        summary: "Real-time data about the Avalanche blockchain ecosystem",
        url: "https://defillama.com/chain/Avalanche",
        source: "DeFiLlama",
        publishedAt: new Date().toISOString(),
      }
    ],
    onchainData: {
      chain: "Avalanche",
      timestamp: new Date().toISOString(),
      tvl: 1250000000,
      tvlChange24h: 2.5,
      transactions24h: 850000,
      activeAddresses24h: 125000,
    }
  },
  drafts: [
    {
      id: "sample-tvl-001",
      content: "Avalanche TVL update:\n\n$1.25B locked across the ecosystem\n850K transactions in the last 24h\n\nThe network keeps building 🔺",
      source: "onchain",
      context: "On-chain data from DeFiLlama showing current Avalanche metrics",
      confidence: 0.85,
      createdAt: new Date().toISOString(),
    },
    {
      id: "sample-ecosystem-002",
      content: "Quick Avalanche ecosystem check:\n\n- TVL: $1.25B (+2.5% 24h)\n- 125K active addresses\n- 850K daily transactions\n\nNumbers don't lie #AVAX",
      source: "onchain",
      context: "Summary of key on-chain metrics",
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    }
  ]
};

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

    // Return sample data if no files exist (e.g., on Vercel)
    console.log("No draft files found, returning sample data");
    return NextResponse.json({
      drafts: [SAMPLE_DRAFTS],
      dates: [SAMPLE_DRAFTS.date],
      isDemo: true
    });
  } catch (error) {
    console.error("Error fetching drafts:", error);
    // Return sample data on error
    return NextResponse.json({
      drafts: [SAMPLE_DRAFTS],
      dates: [SAMPLE_DRAFTS.date],
      isDemo: true,
      error: "Using demo data"
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerationInput;

    const result = await generateTweets(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: 500 }
      );
    }

    // Try to save drafts (may fail on read-only filesystems like Vercel)
    try {
      const saveResult = saveDrafts(result.data.drafts, body);
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
    });
  } catch (error) {
    console.error("Error generating drafts:", error);
    return NextResponse.json(
      { error: "Failed to generate drafts" },
      { status: 500 }
    );
  }
}
