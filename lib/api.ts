import type { TweetDraft, TweetDraftsOutput, GenerationInput } from "@/src/types";

export interface DraftsResponse {
  drafts: TweetDraftsOutput[];
  dates: string[];
}

export interface GenerateResponse {
  drafts: TweetDraft[];
  tokensUsed: number;
  modelUsed: string;
}

export interface ReviseResponse {
  revisedContent: string;
  tokensUsed: number;
}

export interface UpdateDraftResponse {
  draft: TweetDraft;
}

export async function fetchDrafts(): Promise<DraftsResponse> {
  const response = await fetch("/api/drafts");
  if (!response.ok) {
    throw new Error("Failed to fetch drafts");
  }
  return response.json();
}

export async function generateDrafts(input: GenerationInput): Promise<GenerateResponse> {
  const response = await fetch("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to generate drafts");
  }
  return response.json();
}

export async function updateDraft(id: string, content: string): Promise<UpdateDraftResponse> {
  const response = await fetch(`/api/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update draft");
  }
  return response.json();
}

export async function reviseDraft(
  draftId: string,
  feedback: string,
  originalContent: string
): Promise<ReviseResponse> {
  const response = await fetch("/api/revise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftId, feedback, originalContent }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revise draft");
  }
  return response.json();
}
