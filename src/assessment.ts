import type { TicketDecision } from "./hooks/useJev";

export function formatAssessment(message: string, decision: TicketDecision): string {
  const confidence = (value: number) => `${Math.round(value * 100)}% confidence`;
  return [
    "Ticket assessment",
    "",
    message.trim(),
    "",
    `Sentiment: ${decision.sentiment.value} (${confidence(decision.sentiment.confidence)})`,
    `Urgency: ${decision.urgency.value.toFixed(1)} / 10 (${confidence(decision.urgency.confidence)})`,
    `Needs escalation: ${decision.needsEscalation.value ? "Yes" : "No"} (${confidence(decision.needsEscalation.confidence)})`,
  ].join("\n");
}
