"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Newspaper,
  Twitter,
  BarChart3,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NewsItem, TwitterPost, OnchainData, VerificationStatus } from "@/src/types";

interface SourcePanelProps {
  news?: NewsItem[];
  tweets?: TwitterPost[];
  onchainData?: OnchainData;
  metadata?: {
    newsTitle?: string;
    newsUrl?: string;
    twitterAuthor?: string;
    onchainMetric?: string;
  };
}

interface UrlVerification {
  url: string;
  status: VerificationStatus;
  error?: string;
  verifiedAt?: string;
}

export function SourcePanel({ news, tweets, onchainData, metadata }: SourcePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [verifications, setVerifications] = useState<Record<string, UrlVerification>>({});
  const [verifying, setVerifying] = useState<string | null>(null);

  // Filter to specific sources if metadata is provided
  const filteredNews = metadata?.newsTitle
    ? news?.filter(n => n.title.toLowerCase().includes(metadata.newsTitle!.toLowerCase().slice(0, 30)))
    : news;

  const filteredTweets = metadata?.twitterAuthor
    ? tweets?.filter(t => t.authorHandle.toLowerCase() === metadata.twitterAuthor!.replace('@', '').toLowerCase())
    : tweets;

  const hasData = (filteredNews && filteredNews.length > 0) || (filteredTweets && filteredTweets.length > 0) || onchainData;

  const verifyUrl = useCallback(async (url: string) => {
    setVerifying(url);
    try {
      const response = await fetch("/api/verify-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = await response.json();
      setVerifications(prev => ({
        ...prev,
        [url]: {
          url,
          status: result.status as VerificationStatus,
          error: result.error,
          verifiedAt: result.verifiedAt,
        },
      }));
    } catch {
      setVerifications(prev => ({
        ...prev,
        [url]: { url, status: "broken", error: "Verification failed" },
      }));
    } finally {
      setVerifying(null);
    }
  }, []);

  const verifyAllUrls = useCallback(async () => {
    const urls = filteredNews?.map(n => n.url) || [];
    for (const url of urls) {
      await verifyUrl(url);
    }
  }, [filteredNews, verifyUrl]);

  const getStatusIcon = (url: string) => {
    const verification = verifications[url];
    if (verifying === url) {
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    }
    if (!verification) {
      return (
        <span title="Not verified">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        </span>
      );
    }
    switch (verification.status) {
      case "verified":
        return (
          <span title="Verified">
            <CheckCircle className="h-3 w-3 text-green-500" />
          </span>
        );
      case "broken":
        return (
          <span title={verification.error || "Broken link"}>
            <XCircle className="h-3 w-3 text-red-500" />
          </span>
        );
      default:
        return (
          <span title="Unverified">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          </span>
        );
    }
  };

  if (!hasData) {
    return (
      <p className="text-sm text-muted-foreground italic">No source data available</p>
    );
  }

  const hasUnverifiedSources = filteredNews?.some(n => !verifications[n.url] || verifications[n.url].status !== "verified");
  const hasBrokenSources = filteredNews?.some(n => verifications[n.url]?.status === "broken");

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
          {hasBrokenSources && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">
              Broken Links
            </Badge>
          )}
          {!hasBrokenSources && hasUnverifiedSources && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-300">
              Unverified
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {[
            filteredNews && filteredNews.length > 0 ? `${filteredNews.length} news` : null,
            filteredTweets && filteredTweets.length > 0 ? `${filteredTweets.length} tweets` : null,
            onchainData ? "on-chain" : null,
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
      </Button>

      {expanded && (
        <div className="border rounded-md p-4 space-y-4 bg-muted/50">
          {/* Verification Warning */}
          {hasUnverifiedSources && (
            <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded text-xs">
              <span className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Some sources haven&apos;t been verified. Always verify before sharing.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={verifyAllUrls}
                disabled={verifying !== null}
                className="h-6 text-xs"
              >
                {verifying ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Verify All
              </Button>
            </div>
          )}

          {/* News Sources */}
          {filteredNews && filteredNews.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
                <Newspaper className="h-4 w-4 text-blue-600" />
                News Article{filteredNews.length > 1 ? 's' : ''} Used
              </h4>
              <ul className="space-y-2">
                {filteredNews.map((item, i) => {
                  const verification = verifications[item.url];
                  const isBroken = verification?.status === "broken";

                  return (
                    <li key={i} className={`text-sm ${isBroken ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => verifyUrl(item.url)}
                          className="mt-1 flex-shrink-0 hover:scale-110 transition-transform"
                          title="Click to verify"
                        >
                          {getStatusIcon(item.url)}
                        </button>
                        <div className="flex-1">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-start gap-2 ${isBroken ? "line-through text-muted-foreground" : "hover:text-blue-600"}`}
                          >
                            <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" />
                            <div>
                              <p className="font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.source} &middot; {new Date(item.publishedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </a>
                          {isBroken && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {verification.error || "Link is broken"} - Do not use this source
                            </p>
                          )}
                          {verification?.status === "verified" && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Verified {verification.verifiedAt && `at ${new Date(verification.verifiedAt).toLocaleTimeString()}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Twitter Sources */}
          {filteredTweets && filteredTweets.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
                <Twitter className="h-4 w-4 text-sky-500" />
                Tweet{filteredTweets.length > 1 ? 's' : ''} Referenced
              </h4>
              <p className="text-xs text-amber-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Tweet data is from scraping - verify on X/Twitter before citing
              </p>
              <ul className="space-y-2">
                {filteredTweets.map((tweet, i) => (
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
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Data from DeFiLlama API - {new Date(onchainData.timestamp).toLocaleString()}
              </p>
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
