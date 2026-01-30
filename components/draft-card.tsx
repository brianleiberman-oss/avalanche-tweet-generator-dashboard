"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourcePanel } from "@/components/source-panel";
import { DraftEditor } from "@/components/draft-editor";
import { ReviseDialog } from "@/components/revise-dialog";
import { updateDraft } from "@/lib/api";
import { Pencil, Sparkles, Newspaper, Twitter, BarChart3, Blend, AlertTriangle } from "lucide-react";
import type { TweetDraft, NewsItem, TwitterPost, OnchainData } from "@/src/types";

interface DraftCardProps {
  draft: TweetDraft;
  inputData?: {
    news?: NewsItem[];
    tweets?: TwitterPost[];
    onchainData?: OnchainData;
  };
  onUpdated: () => void;
}

const sourceIcons = {
  news: Newspaper,
  twitter: Twitter,
  onchain: BarChart3,
  mixed: Blend,
};

const sourceBadgeVariants = {
  news: "news" as const,
  twitter: "twitter" as const,
  onchain: "onchain" as const,
  mixed: "mixed" as const,
};

export function DraftCard({ draft, inputData, onUpdated }: DraftCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [localContent, setLocalContent] = useState(draft.content);

  const SourceIcon = sourceIcons[draft.source];

  const handleSave = async (content: string) => {
    await updateDraft(draft.id, content);
    setLocalContent(content);
    onUpdated();
  };

  const handleReviseAccept = async (newContent: string) => {
    await updateDraft(draft.id, newContent);
    setLocalContent(newContent);
    onUpdated();
  };

  const confidenceColor =
    draft.confidence >= 0.85
      ? "text-green-600"
      : draft.confidence >= 0.7
      ? "text-amber-600"
      : "text-red-600";

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Badge variant={sourceBadgeVariants[draft.source]} className="gap-1">
              <SourceIcon className="h-3 w-3" />
              {draft.source}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {localContent.length} / 280 chars
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Verification Warning */}
          {inputData && (inputData.news?.length || inputData.tweets?.length) && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Verify sources before posting. Click &quot;View Sources&quot; to check links.</span>
            </div>
          )}

          {/* Tweet Content */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{localContent}</p>
          </div>

          {/* Context */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Context:</p>
            <p className="text-sm text-muted-foreground">{draft.context}</p>
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">Confidence:</p>
            <span className={`text-sm font-mono ${confidenceColor}`}>
              {Math.round(draft.confidence * 100)}%
            </span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  draft.confidence >= 0.85
                    ? "bg-green-500"
                    : draft.confidence >= 0.7
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${draft.confidence * 100}%` }}
              />
            </div>
          </div>

          {/* Source Data Panel */}
          <SourcePanel
            news={inputData?.news}
            tweets={inputData?.tweets}
            onchainData={inputData?.onchainData}
          />
        </CardContent>

        <CardFooter className="gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReviseOpen(true)}>
            <Sparkles className="mr-1 h-3 w-3" />
            Ask AI to Revise
          </Button>
        </CardFooter>
      </Card>

      <DraftEditor
        open={editOpen}
        onOpenChange={setEditOpen}
        content={localContent}
        onSave={handleSave}
      />

      <ReviseDialog
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        draftId={draft.id}
        originalContent={localContent}
        onAccept={handleReviseAccept}
      />
    </>
  );
}
