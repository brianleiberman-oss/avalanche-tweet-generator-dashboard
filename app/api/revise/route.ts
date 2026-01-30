import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/src/lib/config";

const anthropic = new Anthropic();

interface ReviseRequest {
  draftId: string;
  feedback: string;
  originalContent: string;
}

export async function POST(request: Request) {
  try {
    const { feedback, originalContent } = (await request.json()) as ReviseRequest;

    if (!feedback || !originalContent) {
      return NextResponse.json(
        { error: "Feedback and originalContent are required" },
        { status: 400 }
      );
    }

    const revisionPrompt = `You are revising a tweet draft.

Original tweet:
"${originalContent}"

User feedback:
${feedback}

Requirements:
- Max ${config.voice.tweetMaxLength} characters
- Maintain the voice profile of @${config.voice.twitterHandle}
- Address the user's feedback specifically

Return ONLY the revised tweet text, no explanation.`;

    const response = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      messages: [{ role: "user", content: revisionPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      revisedContent: textBlock.text.trim(),
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    });
  } catch (error) {
    console.error("Error revising draft:", error);
    return NextResponse.json(
      { error: "Failed to revise draft" },
      { status: 500 }
    );
  }
}
