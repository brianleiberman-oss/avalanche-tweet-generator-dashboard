"use client";

import { useEffect, useState, useCallback } from "react";
import { Mountain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftCard } from "@/components/draft-card";
import { GenerateButton } from "@/components/generate-button";
import { fetchDrafts, DraftsResponse } from "@/lib/api";

export default function Dashboard() {
  const [data, setData] = useState<DraftsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDrafts();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

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
              <Button variant="outline" size="sm" onClick={loadDrafts} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <GenerateButton onGenerated={loadDrafts} />
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
            <GenerateButton onGenerated={loadDrafts} />
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
