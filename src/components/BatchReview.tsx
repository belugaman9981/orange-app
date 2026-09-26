import { useState } from "react";
import type { TicketDecision } from "../hooks/useJev";
import { minimumConfidence, needsHumanReview, parseBatch, sortBatch, type BatchResult, type BatchSort } from "../reviewWorkflow";

interface Props {
  ready: boolean;
  modelVersion: number;
  predict: (message: string) => TicketDecision | null;
  onReviewed: (rows: BatchResult[]) => void;
  onOpen: (message: string) => void;
}

export function BatchReview({ ready, modelVersion, predict, onReviewed, onOpen }: Props) {
  const [text, setText] = useState("");
  const [separator, setSeparator] = useState<"line" | "divider">("line");
  const [sort, setSort] = useState<BatchSort>("urgency");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ rows: BatchResult[]; version: number; source: string; separator: string } | null>(null);
  const current = result && result.version === modelVersion && result.source === text && result.separator === separator && ready;
  const rows = current ? sortBatch(result.rows, sort) : [];

  function review() {
    if (!ready) return;
    try {
      const messages = parseBatch(text, separator);
      if (!messages.length) throw new Error("Add at least one ticket to review.");
      const assessed = messages.map((message) => {
        const decision = predict(message);
        if (!decision) throw new Error("The model isn't ready. Train it, then try again.");
        return { message, decision };
      });
      setResult({ rows: assessed, version: modelVersion, source: text, separator });
      setError("");
      onReviewed(assessed);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Couldn't review this batch.");
    }
  }

  return <details className="batch-review workflow-section">
    <summary>Batch review <span>Up to 100 tickets</span></summary>
    <label className="input-label" htmlFor="batch-format">Separate tickets by</label>
    <select id="batch-format" value={separator} onChange={(event) => { setSeparator(event.target.value as typeof separator); setError(""); }}>
      <option value="line">One ticket per line</option><option value="divider">A line containing --- (for multiline tickets)</option>
    </select>
    <label className="input-label" htmlFor="batch-messages">Customer messages</label>
    <textarea id="batch-messages" rows={5} value={text} onChange={(event) => { setText(event.target.value); setError(""); }} placeholder={separator === "line" ? "Where is my refund?\nThanks for your help!" : "First ticket, including any line breaks.\n---\nSecond ticket."} />
    <p className="hint">Repeated messages are reviewed once. Tickets below 70% confidence on any score go into the review queue.</p>
    <button className="btn btn--primary" onClick={review} disabled={!ready || !text.trim()}>Review batch</button>
    {!ready && <p className="hint">Wait for training to finish, or train the model to start.</p>}
    {error && <p className="hint tone-bad" role="alert">{error}</p>}
    {result && !current && <p className="hint" role="status">The messages or model changed. Review the batch again for current results.</p>}
    {current && <>
      <div className="batch-toolbar"><p className="hint" role="status">{rows.length} {rows.length === 1 ? "ticket" : "tickets"} reviewed · {rows.filter((row) => needsHumanReview(row.decision)).length} need a human check</p>
        <label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value as BatchSort)}><option value="urgency">Urgency</option><option value="escalation">Escalation first</option><option value="confidence">Lowest confidence</option><option value="original">Input order</option></select></label>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Batch assessments"><table className="workflow-table batch-table">
        <thead><tr><th scope="col">Message</th><th scope="col">Sentiment</th><th scope="col">Urgency</th><th scope="col">Escalate</th><th scope="col">Lowest confidence</th></tr></thead>
        <tbody>{rows.map(({ message, decision }) => <tr key={message}><td><button className="batch-message" onClick={() => onOpen(message)}>{message}</button></td><td>{decision.sentiment.value}</td><td>{decision.urgency.value.toFixed(1)} / 10</td><td>{decision.needsEscalation.value ? "Yes" : "No"}</td><td>{Math.round(minimumConfidence(decision) * 100)}%{needsHumanReview(decision) && <span className="review-flag">Check</span>}</td></tr>)}</tbody>
      </table></div>
    </>}
  </details>;
}
