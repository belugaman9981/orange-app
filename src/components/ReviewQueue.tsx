interface Props {
  messages: string[];
  notice: string;
  onOpen: (message: string) => void;
  onComplete: (message: string) => void;
  canUndo: boolean;
  onUndo: () => void;
}

export function ReviewQueue({ messages, notice, onOpen, onComplete, canUndo, onUndo }: Props) {
  return <details className="review-queue workflow-section">
    <summary>Review queue <span>{messages.length}</span></summary>
    <p className="muted">Saved on this device. Open a ticket to check it, then mark it reviewed. Saving a correction also removes it from this queue.</p>
    {messages.length ? <ul>{messages.map((message) => <li key={message}><button className="queue-message" onClick={() => onOpen(message)}>{message}</button><button className="chip" onClick={() => onComplete(message)} aria-label={`Mark reviewed: ${message}`}>Mark reviewed</button></li>)}</ul> : <p className="muted">No tickets waiting for review.</p>}
    {canUndo && <button className="chip" onClick={onUndo}>Undo last completion</button>}
    {notice && <p className="hint" role="status">{notice}</p>}
  </details>;
}
