export function findNoteMatches(text: string, query: string) {
  if (!query) return [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...text.matchAll(new RegExp(escaped, "giu"))].map((match) => ({ start: match.index!, end: match.index! + match[0].length }));
}
