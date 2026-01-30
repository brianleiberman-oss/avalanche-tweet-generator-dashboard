"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { reviseDraft } from "@/lib/api";
import { ArrowRight, Sparkles } from "lucide-react";

interface ReviseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  originalContent: string;
  onAccept: (newContent: string) => Promise<void>;
}

export function ReviseDialog({
  open,
  onOpenChange,
  draftId,
  originalContent,
  onAccept,
}: ReviseDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [revisedContent, setRevisedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRevise = async () => {
    if (!feedback.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await reviseDraft(draftId, feedback, originalContent);
      setRevisedContent(result.revisedContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revise");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!revisedContent) return;
    setAccepting(true);
    try {
      await onAccept(revisedContent);
      onOpenChange(false);
      resetState();
    } finally {
      setAccepting(false);
    }
  };

  const resetState = () => {
    setFeedback("");
    setRevisedContent(null);
    setError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Ask AI to Revise
          </DialogTitle>
          <DialogDescription>
            Provide feedback on how you&apos;d like the draft revised
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Original Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Original:</label>
            <div className="border rounded-md p-3 bg-muted/50 text-sm">
              {originalContent}
            </div>
          </div>

          {/* Feedback Input */}
          {!revisedContent && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Your feedback:</label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g., Make it shorter, add more data, sound more casual..."
                className="min-h-[80px]"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Revised Content */}
          {revisedContent && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-green-600">Revised:</label>
              <div className="border rounded-md p-3 bg-green-50 text-sm border-green-200">
                {revisedContent}
              </div>
              <p className="text-xs text-muted-foreground">
                {revisedContent.length} / 280 characters
              </p>
            </div>
          )}

          {/* Comparison View */}
          {revisedContent && (
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-md">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Original</p>
                <p className="text-sm font-mono">{originalContent.length} chars</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Revised</p>
                <p className="text-sm font-mono">{revisedContent.length} chars</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!revisedContent ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleRevise} disabled={loading || !feedback.trim()}>
                {loading ? "Revising..." : "Revise with AI"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setRevisedContent(null);
                  setFeedback("");
                }}
              >
                Try Again
              </Button>
              <Button onClick={handleAccept} disabled={accepting}>
                {accepting ? "Accepting..." : "Accept Revision"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
