import type { TicketDecision } from "../hooks/useJev";
import { needsHumanReview } from "../reviewWorkflow";

export function ConfidenceGuide({ decision }: { decision: TicketDecision }) {
  return <div className="confidence-guide">
    {needsHumanReview(decision) && <p className="review-flag">Needs a human check: at least one confidence score is below 70%.</p>}
    <details><summary>What do these scores mean?</summary>
      <p>Sentiment estimates the tone. Urgency runs from 0 (low) to 10 (high). Escalation estimates whether the message needs extra attention.</p>
      <p>Confidence is the model’s estimate, not a measured chance of being correct. The 70% cutoff is a review rule, not a validated accuracy threshold. Check the message before acting, even when confidence is high.</p>
    </details>
  </div>;
}
