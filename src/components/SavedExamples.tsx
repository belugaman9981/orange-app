import type { TicketExample } from "../data/tickets";

interface Props {
  examples: TicketExample[];
  disabled: boolean;
  onEdit: (example: TicketExample) => void;
  onRemove: (example: TicketExample) => void;
}

export function SavedExamples({ examples, disabled, onEdit, onRemove }: Props) {
  return <details className="saved-examples">
    <summary>Your labels <span>{examples.length}</span></summary>
    <p className="muted">Labels are saved automatically. Removing a correction restores the built-in label, if one exists.</p>
    {examples.length ? <ul>{examples.map((example) => <li key={example.state}>
      <p>{example.state}</p>
      <span className="saved-labels">{example.labels.sentiment} · Urgency {example.labels.urgency}/10 · {example.labels.needsEscalation ? "Escalate" : "No escalation"}</span>
      <div className="button-row">
        <button className="chip" disabled={disabled} onClick={() => onEdit(example)}>Edit labels</button>
        <button className="chip" disabled={disabled} onClick={() => onRemove(example)}>Remove</button>
      </div>
    </li>)}</ul> : <p className="muted">Label a message or correct an assessment to add your first example.</p>}
  </details>;
}
