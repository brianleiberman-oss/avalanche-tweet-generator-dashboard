import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { generateTweets, saveDrafts } from "@/src/generator/tweet-generator";
import type { TweetDraftsOutput, GenerationInput } from "@/src/types";

const DRAFTS_DIR = path.join(process.cwd(), "src", "data", "drafts");

export async function GET() {
  try {
    // Ensure directory exists
    if (!fs.existsSync(DRAFTS_DIR)) {
      return NextResponse.json({ drafts: [], dates: [] });
    }

    // Get all JSON files
    const files = fs
      .readdirSync(DRAFTS_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse(); // Most recent first

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
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
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

    // Save drafts with input data
    const saveResult = saveDrafts(result.data.drafts, body);
    if (!saveResult.success) {
      return NextResponse.json(
        { error: saveResult.error.message },
        { status: 500 }
      );
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
