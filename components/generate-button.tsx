"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { generateDrafts, GenerateResponse } from "@/lib/api";

interface GenerateButtonProps {
  onGenerated: (data: GenerateResponse) => void;
}

export function GenerateButton({ onGenerated }: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Generate with scrapeFirst to get real data
      const result = await generateDrafts({ scrapeFirst: true });
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Drafts
          </>
        )}
      </Button>
    </div>
  );
}
