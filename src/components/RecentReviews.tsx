import { useState } from "react";
import { filterReviews } from "../hooks/useWorkspace";
import { Icon } from "./Icon";

interface Props {
  messages: string[];
  onOpen: (message: string) => void;
  onClear: () => void;
}

export function RecentReviews({ messages, onOpen, onClear }: Props) {
  const [query, setQuery] = useState("");
  const matches = filterReviews(messages, query);

  return <section className="recent-reviews" aria-labelledby="recent-heading">
    <div className="section-heading"><h2 id="recent-heading">Recent reviews</h2><button className="chip" onClick={onClear}>Clear history</button></div>
    <p className="muted">Last 20 messages from this session. Reopen one to review it again.</p>
    <label className="input-label" htmlFor="review-search">Search messages</label>
    <div className="history-search">
      <input id="review-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by words in the message" />
      {query && <button className="chip" onClick={() => setQuery("")}>Clear search</button>}
    </div>
    <p className="hint" role="status">{matches.length} of {messages.length} {messages.length === 1 ? "review" : "reviews"}</p>
    {matches.length ? <ul>{matches.map((message) => <li key={message}><button onClick={() => onOpen(message)} title={message}><span>{message}</span><Icon name="arrow" /></button></li>)}</ul> : <p className="muted">No messages match this search.</p>}
  </section>;
}
