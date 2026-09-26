import { useEffect, useState } from "react";

export const DRAFT_KEY = "orange-app:draft";
export const HISTORY_LIMIT = 20;

export function filterReviews(history: string[], query: string): string[] {
  const needle = query.trim().toLocaleLowerCase();
  return history.filter((message) => message.toLocaleLowerCase().includes(needle));
}

export function rememberReview(history: string[], message: string): string[] {
  const trimmed = message.trim();
  if (!trimmed) return history;
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, HISTORY_LIMIT);
}

export function useWorkspace(initialMessage: string, draftKey = DRAFT_KEY) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(draftKey) ?? initialMessage; }
    catch { return initialMessage; }
  });
  const [draftSaved, setDraftSaved] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, text);
      setDraftSaved(true);
    } catch { setDraftSaved(false); }
  }, [text, draftKey]);

  return { text, setText, draftSaved, recent, setRecent };
}
