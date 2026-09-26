import { trainingData, type TicketExample } from "./tickets";

export const EXAMPLES_KEY = "orange-app:examples";

export function parseSavedExamples(raw: string): TicketExample[] {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1 || !("examples" in data) || !Array.isArray(data.examples)) {
    throw new Error("Invalid saved examples");
  }
  const result: TicketExample[] = [];
  for (const item of data.examples) {
    if (!item || typeof item.state !== "string" || !item.state.trim() || !item.labels ||
        !["angry", "neutral", "happy"].includes(item.labels.sentiment) ||
        typeof item.labels.urgency !== "number" || !Number.isFinite(item.labels.urgency) ||
        item.labels.urgency < 0 || item.labels.urgency > 10 || typeof item.labels.needsEscalation !== "boolean" ||
        (item.note !== undefined && (typeof item.note !== "string" || item.note.length > 2000))) {
      throw new Error("Invalid saved label");
    }
    const example: TicketExample = { state: item.state.trim(), labels: { sentiment: item.labels.sentiment, urgency: item.labels.urgency, needsEscalation: item.labels.needsEscalation } };
    if (item.note?.trim()) example.note = item.note.trim();
    const existing = result.findIndex((entry) => entry.state === example.state);
    if (existing === -1) result.push(example);
    else result[existing] = example;
  }
  return result;
}

export function mergeImportedExamples(existing: TicketExample[], incoming: TicketExample[], replace: boolean): TicketExample[] {
  const merged = new Map(existing.map((example) => [example.state, example]));
  for (const example of incoming) {
    if (replace || !merged.has(example.state)) merged.set(example.state, example);
  }
  return [...merged.values()];
}

export function exportExamples(examples: TicketExample[]): string {
  return JSON.stringify({ version: 1, examples }, null, 2);
}

export function mergeExamples(saved: TicketExample[]): TicketExample[] {
  const merged = new Map(trainingData.map((example) => [example.state.trim(), example]));
  for (const example of saved) merged.set(example.state.trim(), example);
  return [...merged.values()];
}
