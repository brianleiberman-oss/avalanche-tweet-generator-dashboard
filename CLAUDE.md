# Avalanche Tweet Generator

## What This Project Is
A tool to generate daily tweet drafts about Avalanche by scraping news, Twitter accounts, and on-chain data - written in the voice/style of @brianman1.

## Goals
1. Scrape relevant news and data sources
2. Learn and mimic Brian's casual, data-driven, humorous voice
3. Generate tweet drafts for manual review (NOT auto-posting)

## Voice Profile
- **Twitter**: https://x.com/brianman1
- **Style**: Casual, data-driven, likes humor
- **Tone**: Informative but not dry, occasional jokes, uses data to make points

## Data Sources
### News
- Avalanche blog/announcements
- General crypto news (CoinDesk, The Block, Decrypt, etc.)
- RSS feeds

### Twitter Accounts to Monitor
(Configured in .env: TWITTER_ACCOUNTS)
- @avalaboratory
- @avaxfoundation
- (Add more via env var)

### On-Chain Data
- TVL (DeFiLlama API)
- Daily transactions
- Active addresses

## Tech Stack
- **Runtime**: Node.js + TypeScript
- **AI**: Anthropic Claude API
- **Data**: DeFiLlama API, RSS feeds, Twitter scraping

## Project Structure
```
src/
├── lib/
│   ├── config.ts      # Centralized configuration (ALL settings here)
│   └── errors.ts      # Error handling with codes
├── types/
│   └── index.ts       # ALL type definitions (never export from other files)
├── scrapers/
│   ├── news.ts        # RSS news scraping
│   ├── twitter.ts     # Twitter account monitoring
│   └── onchain.ts     # DeFiLlama blockchain data
├── voice/
│   └── samples.ts     # Voice samples & style guidelines
├── generator/
│   └── tweet-generator.ts  # AI tweet generation
├── data/              # Output directory (gitignored)
│   ├── drafts/        # Generated tweet drafts
│   └── cache/         # Cached scraped data
└── index.ts           # Main entry point
```

## Coding Standards
1. **Config**: ALL configurable values in `src/lib/config.ts`
2. **Types**: ALL types in `src/types/index.ts` - never export from other files
3. **Errors**: Use `ErrorCode` enum, not generic messages
4. **Environment**: Use env vars with defaults: `process.env.X || "default"`
5. **No hardcoding**: Model names, URLs, limits all come from config

## Environment Variables
See `.env.example` for full list. Key ones:
- `ANTHROPIC_API_KEY` - Required for AI
- `TWITTER_ACCOUNTS` - Comma-separated handles to monitor
- `TWEETS_PER_DAY` - How many drafts to generate

## Commands
```bash
npm run generate      # Generate tweet drafts
npm run scrape:news   # Fetch latest news
npm run scrape:onchain # Fetch blockchain data
npm run scrape:all    # Run all scrapers
```

## Error Codes
Located in `src/types/index.ts`:
- `AI_UNAVAILABLE` - API key issues
- `AI_RATE_LIMITED` - Too many requests
- `AI_INVALID_RESPONSE` - Couldn't parse AI response
- `SCRAPER_FAILED` - Scraper error
- `NO_DATA_AVAILABLE` - No input data

## Output Format
Drafts saved to `src/data/drafts/YYYY-MM-DD.json`:
```json
{
  "date": "2024-01-30",
  "generatedAt": "ISO timestamp",
  "drafts": [
    {
      "id": "unique-id",
      "content": "Tweet text...",
      "source": "news|twitter|onchain|mixed",
      "context": "What inspired this",
      "confidence": 0.85,
      "createdAt": "ISO timestamp"
    }
  ]
}
```
