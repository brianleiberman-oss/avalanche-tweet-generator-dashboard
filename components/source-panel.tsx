"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Newspaper, Twitter, BarChart3, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NewsItem, TwitterPost, OnchainData } from "@/src/types";

interface SourcePanelProps {
  news?: NewsItem[];
  tweets?: TwitterPost[];
  onchainData?: OnchainData;
}

export function SourcePanel({ news, tweets, onchainData }: SourcePanelProps) {
  const [expanded, setExpanded] = useState(false);

  const hasData = (news && news.length > 0) || (tweets && tweets.length > 0) || onchainData;

  if (!hasData) {
    return (
      <p className="text-sm text-muted-foreground italic">No source data available</p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          View Sources
        </span>
        <span className="text-xs text-muted-foreground">
          {[
            news && news.length > 0 ? `${news.length} news` : null,
            tweets && tweets.length > 0 ? `${tweets.length} tweets` : null,
            onchainData ? "on-chain" : null,
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
      </Button>

      {expanded && (
        <div className="border rounded-md p-4 space-y-4 bg-muted/50">
          {/* News Sources */}
          {news && news.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
                <Newspaper className="h-4 w-4 text-blue-600" />
                News Articles
              </h4>
              <ul className="space-y-2">
                {news.map((item, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 hover:text-blue-600"
                    >
                      <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.source} &middot; {new Date(item.publishedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Twitter Sources */}
          {tweets && tweets.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
                <Twitter className="h-4 w-4 text-sky-500" />
                Referenced Tweets
              </h4>
              <ul className="space-y-2">
                {tweets.map((tweet, i) => (
                  <li key={i} className="text-sm border-l-2 border-sky-200 pl-3">
                    <p className="font-medium">@{tweet.authorHandle}</p>
                    <p className="text-muted-foreground">{tweet.content}</p>
                    {tweet.engagement && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tweet.engagement.likes} likes &middot; {tweet.engagement.retweets} RTs
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* On-Chain Data */}
          {onchainData && (
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                On-Chain Metrics ({onchainData.chain})
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {onchainData.tvl !== undefined && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">TVL</p>
                    <p className="font-mono">${formatNumber(onchainData.tvl)}</p>
                    {onchainData.tvlChange24h !== undefined && (
                      <p className={`text-xs ${onchainData.tvlChange24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {onchainData.tvlChange24h >= 0 ? "+" : ""}{onchainData.tvlChange24h.toFixed(1)}% (24h)
                      </p>
                    )}
                  </div>
                )}
                {onchainData.transactions24h !== undefined && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">24h Transactions</p>
                    <p className="font-mono">{onchainData.transactions24h.toLocaleString()}</p>
                  </div>
                )}
                {onchainData.activeAddresses24h !== undefined && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">Active Addresses</p>
                    <p className="font-mono">{onchainData.activeAddresses24h.toLocaleString()}</p>
                  </div>
                )}
                {onchainData.volume24h !== undefined && (
                  <div className="bg-background rounded p-2">
                    <p className="text-xs text-muted-foreground">24h Volume</p>
                    <p className="font-mono">${formatNumber(onchainData.volume24h)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}
