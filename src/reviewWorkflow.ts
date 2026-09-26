import type { TicketDecision } from "./hooks/useJev";
import { formatAssessment } from "./assessment";

export const REVIEW_THRESHOLD = 0.7;
export interface BatchResult { message: string; decision: TicketDecision }
export type BatchSort = "original" | "urgency" | "escalation" | "confidence";
export type BatchFilter = "all" | "review" | "escalation" | "urgent";
export const batchFilterLabels: Record<BatchFilter, string> = {
  all: "All tickets", review: "Needs a human check", escalation: "Needs escalation", urgent: "High urgency (7+)",
};

export function filterBatch(rows: BatchResult[], query: string, filter: BatchFilter): BatchResult[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter(({ message, decision }) => {
    if (!message.toLocaleLowerCase().includes(needle)) return false;
    if (filter === "review") return needsHumanReview(decision);
    if (filter === "escalation") return decision.needsEscalation.value;
    if (filter === "urgent") return decision.urgency.value >= 7;
    return true;
  });
}

export function formatBatchReport(rows: BatchResult[], total: number, query: string, filter: BatchFilter, sort: BatchSort): string {
  const order = { original: "Input order", urgency: "Urgency", escalation: "Escalation first", confidence: "Lowest confidence" };
  return [
    "Orange batch assessment",
    `Showing ${rows.length} of ${total} tickets`,
    `Filter: ${batchFilterLabels[filter]}`,
    `Search: ${query.trim() || "None"}`,
    `Order: ${order[sort]}`,
    "Confidence is a model estimate, not a measured chance of being correct.",
    ...rows.map(({ message, decision }, index) => `\n--- ${index + 1} ---\n\n${formatAssessment(message, decision)}`),
  ].join("\n");
}

export function needsHumanReview(decision: TicketDecision): boolean {
  return minimumConfidence(decision) < REVIEW_THRESHOLD;
}

export function minimumConfidence(decision: TicketDecision): number {
  return Math.min(decision.sentiment.confidence, decision.urgency.confidence, decision.needsEscalation.confidence);
}

export function parseBatch(text: string, separator: "line" | "divider"): string[] {
  if (text.length > 100000) throw new Error("Keep a batch under 100,000 characters.");
  const parts = text.replace(/\r\n?/g, "\n").split(separator === "line" ? /\n/ : /^\s*---\s*$/m);
  const messages = [...new Set(parts.map((part) => part.trim()).filter(Boolean))];
  if (messages.length > 100) throw new Error("Review up to 100 distinct tickets at a time. Split this batch into smaller groups.");
  return messages;
}

export function sortBatch(rows: BatchResult[], sort: BatchSort): BatchResult[] {
  return [...rows].sort((a, b) => {
    if (sort === "urgency") return b.decision.urgency.value - a.decision.urgency.value;
    if (sort === "escalation") return Number(b.decision.needsEscalation.value) - Number(a.decision.needsEscalation.value) || b.decision.urgency.value - a.decision.urgency.value;
    if (sort === "confidence") return minimumConfidence(a.decision) - minimumConfidence(b.decision);
    return 0;
  });
}
