"use client";

import { useEffect, useState, useCallback } from "react";
import { Mountain, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftCard } from "@/components/draft-card";
import { GenerateButton } from "@/components/generate-button";
import { fetchDrafts, DraftsResponse, GenerateResponse } from "@/lib/api";
import type { TweetDraftsOutput } from "@/src/types";

const STORAGE_KEY = "avalanche-tweet-drafts";

export default function Dashboard() {
  const [data, setData] = useState<DraftsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage first, then try API
  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try localStorage first (has latest generated data)
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as DraftsResponse;
        // Check if cache is from today
        const today = new Date().toISOString().split("T")[0];
        if (parsed.drafts?.some(d => d.date === today)) {
          setData(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {
      // localStorage not available or invalid
    }

    // Fallback to API (bundled files)
    try {
      const result = await fetchDrafts();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  // Save to localStorage whenever data changes
  const saveToStorage = useCallback((newData: DraftsResponse) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch {
      // localStorage not available
    }
  }, []);

  // Clear cached data
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setData({ drafts: [], dates: [] });
    } catch {
      // localStorage not available
    }
  }, []);

  // Handle newly generated drafts - add them to the UI and save to localStorage
  const handleGenerated = useCallback((result: GenerateResponse) => {
    const today = new Date().toISOString().split("T")[0];
    const newDraftOutput: TweetDraftsOutput = {
      date: today,
      generatedAt: new Date().toISOString(),
      drafts: result.drafts,
      input: result.input as TweetDraftsOutput["input"],
    };

    setData(prev => {
      let newData: DraftsResponse;
      if (!prev) {
        newData = { drafts: [newDraftOutput], dates: [today] };
      } else {
        // Replace today's drafts or add new
        const existingIndex = prev.drafts.findIndex(d => d.date === today);
        if (existingIndex >= 0) {
          const newDrafts = [...prev.drafts];
          newDrafts[existingIndex] = newDraftOutput;
          newData = { drafts: newDrafts, dates: prev.dates };
        } else {
          newData = {
            drafts: [newDraftOutput, ...prev.drafts],
            dates: [today, ...prev.dates],
          };
        }
      }
      // Save to localStorage for persistence
      saveToStorage(newData);
      return newData;
    });
  }, [saveToStorage]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mountain className="h-8 w-8 text-red-500" />
              <div>
                <h1 className="text-xl font-bold">Avalanche Tweet Generator</h1>
                <p className="text-sm text-muted-foreground">
                  Generate and manage tweet drafts with AI
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearCache} title="Clear cached drafts">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={loadDrafts} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <GenerateButton onGenerated={handleGenerated} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading drafts...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && data && data.drafts.length === 0 && (
          <div className="text-center py-20">
            <Mountain className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No drafts yet</h2>
            <p className="text-muted-foreground mb-6">
              Generate your first batch of tweet drafts to get started
            </p>
            <GenerateButton onGenerated={handleGenerated} />
          </div>
        )}

        {/* Drafts List */}
        {data && data.drafts.length > 0 && (
          <div className="space-y-8">
            {data.drafts.map((dayData) => (
              <section key={dayData.date}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-semibold">{formatDate(dayData.date)}</h2>
                  <span className="text-sm text-muted-foreground">
                    {dayData.drafts.length} draft{dayData.drafts.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Generated at {new Date(dayData.generatedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {dayData.drafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      inputData={dayData.input}
                      onUpdated={loadDrafts}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Avalanche Tweet Generator &middot; Powered by Claude AI
        </div>
      </footer>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split("T")[0]) {
    return "Today";
  }
  if (dateStr === yesterday.toISOString().split("T")[0]) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
