import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { TweetDraftsOutput } from "@/src/types";

const DRAFTS_DIR = path.join(process.cwd(), "src", "data", "drafts");

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { content } = (await request.json()) as { content: string };

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Find draft across all files
    const files = fs
      .readdirSync(DRAFTS_DIR)
      .filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(DRAFTS_DIR, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(fileContent) as TweetDraftsOutput;

      const draftIndex = data.drafts.findIndex((d) => d.id === id);
      if (draftIndex !== -1) {
        // Update the draft
        data.drafts[draftIndex].content = content;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        return NextResponse.json({ draft: data.drafts[draftIndex] });
      }
    }

    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  } catch (error) {
    console.error("Error updating draft:", error);
    return NextResponse.json(
      { error: "Failed to update draft" },
      { status: 500 }
    );
  }
}
