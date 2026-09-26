import { useState } from "react";
import { filterReviews } from "../hooks/useWorkspace";

interface Props {
  messages: string[];
  notice: string;
  onOpen: (message: string) => void;
  onComplete: (message: string) => void;
  canUndo: boolean;
  onUndo: () => void;
}

export function ReviewQueue({ messages, notice, onOpen, onComplete, canUndo, onUndo }: Props) {
  const [query, setQuery] = useState("");
  const matches = filterReviews(messages, query);
  return <details className="review-queue workflow-section">
    <summary>Review queue <span>{messages.length}</span></summary>
    <p className="muted">Saved on this device. Open a ticket to check it, then mark it reviewed. Saving a correction also removes it from this queue.</p>
    {(messages.length > 0 || query) && <>
      <label className="input-label" htmlFor="queue-search">Search queued messages</label>
      <div className="history-search"><input id="queue-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a ticket in the queue" />{query && <button className="chip" onClick={() => setQuery("")}>Clear search</button>}</div>
      <p className="hint" role="status">{matches.length} of {messages.length} {messages.length === 1 ? "ticket" : "tickets"} waiting</p>
    </>}
    {matches.length > 0 && <button className="btn" onClick={() => onOpen(matches[0])}>Open next ticket</button>}
    {matches.length ? <ul>{matches.map((message) => <li key={message}><button className="queue-message" onClick={() => onOpen(message)}>{message}</button><button className="chip" onClick={() => onComplete(message)} aria-label={`Mark reviewed: ${message}`}>Mark reviewed</button></li>)}</ul> : <p className="muted">{messages.length ? "No queued tickets match this search." : "No tickets waiting for review."}</p>}
    {canUndo && <button className="chip" onClick={onUndo}>Undo last completion</button>}
    {notice && <p className="hint" role="status">{notice}</p>}
  </details>;
}
