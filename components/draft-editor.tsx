"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DraftEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onSave: (content: string) => Promise<void>;
}

const MAX_LENGTH = 280;

export function DraftEditor({ open, onOpenChange, content, onSave }: DraftEditorProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [saving, setSaving] = useState(false);

  const charCount = editedContent.length;
  const isOverLimit = charCount > MAX_LENGTH;

  const handleSave = async () => {
    if (isOverLimit) return;
    setSaving(true);
    try {
      await onSave(editedContent);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Draft</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[150px] font-mono"
            placeholder="Enter your tweet..."
          />
          <div className="flex justify-between items-center text-sm">
            <span className={isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"}>
              {charCount} / {MAX_LENGTH}
            </span>
            {isOverLimit && (
              <span className="text-destructive text-xs">
                {charCount - MAX_LENGTH} characters over limit
              </span>
            )}
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Preview:</p>
            <p className="whitespace-pre-wrap">{editedContent}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isOverLimit}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
