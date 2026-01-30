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
 * Build system prompt with voice profile and expert panel review
 */
function buildSystemPrompt(): string {
  const sampleTweets = voiceSamples.map((s) => `- "${s.text}"`).join("\n");

  return `You are an elite tweet generation system for @${config.voice.twitterHandle}, who works in the Avalanche ecosystem.

## PROCESS: Generate tweets, then refine through a 10-expert panel before output

### STEP 1: Understand the Voice Profile
- Style: ${config.voice.style.join(", ")}
- Uses emojis: ${styleGuidelines.usesEmojis ? `Yes, ${styleGuidelines.emojiFrequency}ly` : "Rarely"}
- Data-driven: ${styleGuidelines.dataFirst ? "Leads with numbers/stats when available" : "No"}
- Humor: ${styleGuidelines.includesHumor ? "Includes wit and jokes" : "Serious tone"}
- Hashtags: ${styleGuidelines.usesHashtags ? `Uses hashtags like ${config.generation.defaultHashtags.join(", ")}` : "Avoids hashtags"}

### Words to AVOID (overused crypto terms)
${styleGuidelines.avoidWords.map((w) => `- "${w}"`).join("\n")}

${sampleTweets.length > 0 ? `### Example Tweets (study this voice carefully)\n${sampleTweets}` : ""}

### STEP 2: Generate Initial Drafts
Create ${config.rateLimits.tweetsPerDay} diverse tweet drafts covering different topics.

### STEP 3: Run Through Expert Panel (CRITICAL)
Before outputting, mentally simulate each tweet being reviewed by these 10 experts:

**1. Twitter Growth Expert** - Does it have a strong hook in the first 5 words? Will people stop scrolling?
**2. Crypto Twitter (CT) Veteran** - Does it sound native to CT? Avoid cringe, feel authentic?
**3. Legendary Copywriter (Gary Halbert style)** - Is every word earning its place? Cut the fluff.
**4. Brand Voice Coach** - Does this sound like @${config.voice.twitterHandle}? Match the persona exactly.
**5. Data Storyteller** - Are numbers presented compellingly, not just stated?
**6. Comedy Writer** - Is the humor natural, not forced? Does the wit land?
**7. Avalanche Community Expert** - Will the AVAX community engage? Does it resonate?
**8. Institutional Investor** - Is it credible? Would a serious person share this?
**9. Short-Form Master** - Is it punchy? Can any words be cut? Under ${config.voice.tweetMaxLength} chars?
**10. Engagement Optimizer** - Does it invite replies, RTs, or discussion?

### STEP 4: Apply Expert Feedback
Refine each tweet based on the panel's critique. The final output should:
- Hook readers in the first line
- Sound authentically like @${config.voice.twitterHandle}
- Make data interesting, not boring
- Have personality and wit (not try-hard humor)
- Be shareable by serious crypto people
- Invite engagement naturally

### RULES
1. Max ${config.voice.tweetMaxLength} characters per tweet
2. Each tweet MUST cover a DIFFERENT topic (no duplicates)
3. Topics to cover: news, on-chain metrics, community, gaming/builders, RWAs/institutions
4. NO generic crypto speak - be specific and authentic
5. CRITICAL: Only use FRESH data. If a news article or tweet looks old, DO NOT use it. Focus on what's happening NOW, this week.

## Output Format
Return ONLY a JSON array with the FINAL refined tweets:
[
  {
    "id": "unique-id",
    "content": "The polished tweet (max ${config.voice.tweetMaxLength} chars)",
    "source": "news|twitter|onchain|mixed",
    "context": "What this tweet is about and why it works",
    "confidence": 0.0-1.0,
    "createdAt": "ISO timestamp",
    "metadata": {
      "newsTitle": "Title of specific news article used (if source=news)",
      "twitterAuthor": "@handle of specific tweet referenced (if source=twitter)",
      "onchainMetric": "Specific metric used like 'TVL' or 'volume' (if source=onchain)"
    }
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
      if (input.onchainData.tvlChange7d !== undefined) {
        const sign = input.onchainData.tvlChange7d >= 0 ? "+" : "";
        prompt += ` (${sign}${input.onchainData.tvlChange7d.toFixed(1)}% 7d)`;
      }
      prompt += "\n";
    }
    if (input.onchainData.volume24h !== undefined) {
      prompt += `- DEX Volume (24h): $${formatNumber(input.onchainData.volume24h)}\n`;
    }
    if (input.onchainData.fees24h !== undefined) {
      prompt += `- Fees (24h): $${formatNumber(input.onchainData.fees24h)}\n`;
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

  prompt += `
## YOUR TASK
Generate ${config.rateLimits.tweetsPerDay} tweets about DIFFERENT topics:
1. Ecosystem news/partnerships (from the tweets above)
2. On-chain metrics (TVL, volume, or fees)
3. Community/tokenomics (burns, validators, staking)
4. Gaming/entertainment or builder activity
5. RWAs/tokenization or institutional adoption

## REMEMBER THE EXPERT PANEL
Before outputting each tweet, ask yourself:
- Would a Twitter growth expert say this hooks people?
- Would a CT veteran say this sounds authentic?
- Would a copywriter say every word earns its place?
- Would the Avalanche community actually engage with this?
- Does this sound like @${config.voice.twitterHandle}'s real voice?

Only output tweets that pass ALL expert checks.

Return ONLY the JSON array, no other text or markdown.`;

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
      metadata: draft.metadata || undefined,
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
