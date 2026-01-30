/**
 * Tweet Generator
 *
 * Uses Claude AI to generate tweet drafts based on:
 * - Scraped news
 * - Twitter activity
 * - On-chain data
 *
 * All in the voice/style of the configured user.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { config } from "../lib/config";
import { success, fail, logError, tryCatch } from "../lib/errors";
import { voiceSamples, styleGuidelines } from "../voice/samples";
import type {
  Result,
  TweetDraft,
  TweetDraftsOutput,
  GenerationInput,
  GenerationOutput,
} from "../types";
import { ErrorCode as EC } from "../types";

const anthropic = new Anthropic();

/**
 * Generate tweet drafts based on input data
 */
export async function generateTweets(
  input: GenerationInput
): Promise<Result<GenerationOutput>> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return fail(EC.AI_INVALID_RESPONSE, "No text response from Claude");
    }

    // Parse JSON response
    const drafts = parseResponse(textBlock.text);
    if (!drafts) {
      return fail(EC.AI_INVALID_RESPONSE, "Failed to parse AI response as JSON");
    }

    const output: GenerationOutput = {
      drafts,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      modelUsed: config.ai.model,
      generatedAt: new Date().toISOString(),
    };

    return success(output);
  } catch (error) {
    const apiError = error as { status?: number; message?: string };

    // Handle specific API errors
    if (apiError.status === 401 || apiError.status === 403) {
      return fail(EC.AI_UNAVAILABLE, "Invalid or missing API key", { status: apiError.status });
    }
    if (apiError.status === 429) {
      return fail(EC.AI_RATE_LIMITED, "Rate limited by AI provider", { status: apiError.status });
    }
    if (apiError.status === 404) {
      return fail(EC.AI_MODEL_NOT_FOUND, `Model not found: ${config.ai.model}`, { model: config.ai.model });
    }

    return fail(
      EC.UNKNOWN_ERROR,
      apiError.message || "Unknown error during generation",
      error
    );
  }
}

/**
 * Build system prompt with voice profile
 */
function buildSystemPrompt(): string {
  const sampleTweets = voiceSamples.map((s) => `- "${s.text}"`).join("\n");

  return `You are a tweet ghostwriter for @${config.voice.twitterHandle}, who works in the Avalanche ecosystem.

## Voice Profile
- Style: ${config.voice.style.join(", ")}
- Uses emojis: ${styleGuidelines.usesEmojis ? `Yes, ${styleGuidelines.emojiFrequency}ly` : "Rarely"}
- Data-driven: ${styleGuidelines.dataFirst ? "Leads with numbers/stats when available" : "No"}
- Humor: ${styleGuidelines.includesHumor ? "Includes wit and jokes" : "Serious tone"}
- Hashtags: ${styleGuidelines.usesHashtags ? `Uses hashtags like ${config.generation.defaultHashtags.join(", ")}` : "Avoids hashtags"}

## Words to AVOID (overused crypto terms)
${styleGuidelines.avoidWords.map((w) => `- "${w}"`).join("\n")}

${sampleTweets.length > 0 ? `## Example Tweets (for style reference)\n${sampleTweets}` : ""}

## Rules
1. Max ${config.voice.tweetMaxLength} characters per tweet
2. Be authentic to the voice profile
3. When sharing data, make it interesting - don't just state facts
4. Add a human touch - opinions, reactions, questions
5. Return a JSON array of tweet drafts

## Output Format
Return ONLY a JSON array with this structure:
[
  {
    "id": "unique-id",
    "content": "The tweet text (max ${config.voice.tweetMaxLength} chars)",
    "source": "news|twitter|onchain|mixed",
    "context": "Brief explanation of what inspired this tweet",
    "confidence": 0.0-1.0,
    "createdAt": "ISO timestamp"
  }
]`;
}

/**
 * Build user prompt with current data
 */
function buildUserPrompt(input: GenerationInput): string {
  let prompt = `Generate ${config.rateLimits.tweetsPerDay} tweet drafts based on this data:\n\n`;

  if (input.news && input.news.length > 0) {
    prompt += `## Latest News\n`;
    input.news.forEach((n) => {
      prompt += `- [${n.source}] ${n.title}: ${n.summary}\n`;
    });
    prompt += "\n";
  }

  if (input.tweets && input.tweets.length > 0) {
    prompt += `## Recent Tweets from Avalanche Accounts\n`;
    input.tweets.forEach((t) => {
      prompt += `- @${t.authorHandle}: "${t.content}"\n`;
    });
    prompt += "\n";
  }

  if (input.onchainData) {
    prompt += `## On-Chain Data (${input.onchainData.chain})\n`;
    if (input.onchainData.tvl !== undefined) {
      prompt += `- TVL: $${formatNumber(input.onchainData.tvl)}`;
      if (input.onchainData.tvlChange24h !== undefined) {
        const sign = input.onchainData.tvlChange24h >= 0 ? "+" : "";
        prompt += ` (${sign}${input.onchainData.tvlChange24h.toFixed(1)}% 24h)`;
      }
      prompt += "\n";
    }
    if (input.onchainData.transactions24h !== undefined) {
      prompt += `- 24h Transactions: ${input.onchainData.transactions24h.toLocaleString()}\n`;
    }
    if (input.onchainData.activeAddresses24h !== undefined) {
      prompt += `- Active Addresses (24h): ${input.onchainData.activeAddresses24h.toLocaleString()}\n`;
    }
    prompt += "\n";
  }

  if (!input.news?.length && !input.tweets?.length && !input.onchainData) {
    prompt += `No specific data provided. Generate general Avalanche ecosystem tweets based on your knowledge.\n`;
  }

  prompt += `\nReturn ONLY the JSON array, no other text or markdown.`;

  return prompt;
}

/**
 * Format large numbers for readability
 */
function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

/**
 * Parse Claude's response into TweetDraft array
 */
function parseResponse(text: string): TweetDraft[] | null {
  try {
    // Clean up response (remove markdown code blocks if present)
    let jsonText = text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }

    const parsed = JSON.parse(jsonText.trim());

    // Validate structure
    if (!Array.isArray(parsed)) {
      return null;
    }

    // Add missing fields
    return parsed.map((draft: Partial<TweetDraft>, index: number) => ({
      id: draft.id || `draft-${Date.now()}-${index}`,
      content: draft.content || "",
      source: draft.source || "mixed",
      context: draft.context || "",
      confidence: draft.confidence || 0.5,
      createdAt: draft.createdAt || new Date().toISOString(),
    }));
  } catch {
    return null;
  }
}

/**
 * Save drafts to file
 */
export function saveDrafts(drafts: TweetDraft[], input?: GenerationInput): Result<string> {
  try {
    const date = new Date().toISOString().split("T")[0];
    const outputDir = config.output.draftsDir;

    // Ensure directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(outputDir, `${date}.json`);
    const output: TweetDraftsOutput = {
      date,
      generatedAt: new Date().toISOString(),
      drafts,
      input,
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    return success(filePath);
  } catch (error) {
    return fail(
      EC.UNKNOWN_ERROR,
      "Failed to save drafts",
      error
    );
  }
}
