/**
 * Centralized Type Definitions
 *
 * ALL types go here. Never export types from:
 * - Server action files
 * - Component files
 * - Service files
 */

// ===========================================
// ERROR HANDLING
// ===========================================

export enum ErrorCode {
  // AI/Generation errors
  AI_UNAVAILABLE = "AI_UNAVAILABLE",
  AI_RATE_LIMITED = "AI_RATE_LIMITED",
  AI_INVALID_RESPONSE = "AI_INVALID_RESPONSE",
  AI_MODEL_NOT_FOUND = "AI_MODEL_NOT_FOUND",

  // Scraper errors
  SCRAPER_FAILED = "SCRAPER_FAILED",
  SCRAPER_TIMEOUT = "SCRAPER_TIMEOUT",
  SCRAPER_RATE_LIMITED = "SCRAPER_RATE_LIMITED",

  // Data errors
  NO_DATA_AVAILABLE = "NO_DATA_AVAILABLE",
  INVALID_DATA_FORMAT = "INVALID_DATA_FORMAT",

  // Config errors
  MISSING_ENV_VAR = "MISSING_ENV_VAR",
  INVALID_CONFIG = "INVALID_CONFIG",

  // General
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

// ===========================================
// TWEET TYPES
// ===========================================

export type TweetSource = "news" | "twitter" | "onchain" | "mixed";

export interface TweetDraft {
  id: string;
  content: string;
  source: TweetSource;
  context: string;
  confidence: number;
  createdAt: string;
  metadata?: {
    newsTitle?: string;
    newsUrl?: string;
    twitterAuthor?: string;
    onchainMetric?: string;
  };
  sourceData?: {
    news?: NewsItem[];
    tweets?: TwitterPost[];
    onchainData?: OnchainData;
  };
}

export interface TweetDraftsOutput {
  date: string;
  generatedAt: string;
  drafts: TweetDraft[];
  input?: GenerationInput;
}

// ===========================================
// SCRAPER TYPES
// ===========================================

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  relevanceScore?: number;
  verified?: boolean;
  verifiedAt?: string;
}

export type VerificationStatus = "verified" | "unverified" | "broken" | "pending";

export interface TwitterPost {
  id: string;
  author: string;
  authorHandle: string;
  content: string;
  postedAt: string;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface OnchainData {
  chain: string;
  timestamp: string;
  tvl?: number;
  tvlChange24h?: number;
  tvlChange7d?: number;
  transactions24h?: number;
  activeAddresses24h?: number;
  volume24h?: number;
  fees24h?: number;
}

// ===========================================
// GENERATION TYPES
// ===========================================

export interface GenerationInput {
  news?: NewsItem[];
  tweets?: TwitterPost[];
  onchainData?: OnchainData;
}

export interface GenerationOutput {
  drafts: TweetDraft[];
  tokensUsed: number;
  modelUsed: string;
  generatedAt: string;
}

// ===========================================
// VOICE PROFILE TYPES
// ===========================================

export interface VoiceSample {
  text: string;
  topics?: string[];
  engagement?: {
    likes: number;
    retweets: number;
  };
}

export interface StyleGuidelines {
  usesEmojis: boolean;
  emojiFrequency: "none" | "light" | "moderate" | "heavy";
  usesThreads: boolean;
  averageLength: "short" | "medium" | "long";
  usesHashtags: boolean;
  dataFirst: boolean;
  includesHumor: boolean;
  asksQuestions: boolean;
  usesCTA: boolean;
  avoidWords: string[];
  preferredTerms: Record<string, string>;
}
