import { useEffect, useRef, useState } from "react";
import { acumenRequest, askAcumen } from "../acumen";
import { useWorkspace } from "../hooks/useWorkspace";

type Exchange = { question: string; answer: string };

export function AskQuestion() {
  const { text, setText, draftSaved } = useWorkspace("", "orange-app:question-draft");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState<"connect" | "answer" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => request.current?.abort(), []);

  const run = async (kind: "connect" | "answer") => {
    if (request.current || !token.trim() || (kind === "answer" && (!connected || !text.trim()))) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(kind); setError(""); setNotice("");
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, kind === "connect" ? 10000 : 120000);
    const question = text.trim();
    try {
      if (kind === "connect") {
        const result = await acumenRequest("/api/session", token.trim(), controller.signal);
        if (!result || typeof result !== "object" || !("candidates" in result) || !Array.isArray(result.candidates)) throw new Error("Unexpected AcumenAI session response.");
        if (!controller.signal.aborted) { setConnected(true); setNotice("Connected to AcumenAI."); }
      } else {
        const answer = await askAcumen(question, token.trim(), controller.signal);
        if (!controller.signal.aborted) {
          setExchanges((items) => [...items, { question, answer }].slice(-30));
          setText(""); setNotice("Answer ready.");
          input.current?.focus();
        }
      }
    } catch (cause) {
      if (controller.signal.aborted) setNotice(timedOut ? "AcumenAI took too long. Your question is kept; you can try again. The server may still finish the request." : "Stopped waiting. Your question is kept. AcumenAI may still finish the request.");
      else {
        const message = cause instanceof Error ? cause.message : "Couldn't get an answer. Try again.";
        setError(message);
        if (kind === "connect" || message.startsWith("Pairing token")) setConnected(false);
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setBusy(null); }
    }
  };

  return <>
    <div className="page-heading"><div><h1>Ask a question</h1><p className="page-description">Solve a problem, work through homework, or look something up with AcumenAI.</p></div><span className={`model-state${connected ? " model-state--ready" : ""}`}><span aria-hidden="true" />{connected ? "AcumenAI connected" : "Connect AcumenAI"}</span></div>
    <main className="layout question-layout">
      <section className="card card--main" aria-label="Questions and answers">
        <div className="section-heading"><h2>Your question</h2><button className="chip" disabled={!!busy || !exchanges.length} onClick={() => { setExchanges([]); setNotice("Conversation view cleared. AcumenAI's session is unchanged."); }}>Clear conversation view</button></div>
        <label className="input-label" htmlFor="question-input">What would you like to solve?</label>
        <div className="message-editor"><textarea id="question-input" ref={input} className="ticket-input" rows={5} value={text} disabled={busy === "answer"} maxLength={12000} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void run("answer"); } }} placeholder="e.g. Solve 2*x + 3 = 11" /><div className="editor-footer"><span>{draftSaved ? "Draft saved on this device" : "Draft not saved — keep this tab open"}</span><span>{text.length} / 12,000</span></div></div>
        <div className="button-row review-actions"><button className="btn btn--primary" disabled={!!busy || !connected || !text.trim()} onClick={() => void run("answer")}>{busy === "answer" ? "Asking AcumenAI…" : "Ask AcumenAI"}</button>{busy && <button className="btn" onClick={() => request.current?.abort()}>Stop waiting</button>}</div>
        <p className="keyboard-hint">Ctrl / ⌘ + Enter · Include the full problem in each question.</p>
        {error && <p className="question-error" role="alert">{error} Your question is kept.</p>}
        <p className="hint" role="status">{busy === "answer" ? "AcumenAI is working. Research can take a little longer." : notice}</p>
        <section className="review-section" aria-label="Answers" aria-busy={busy === "answer"}>
          <div className="section-heading"><h2>Answers</h2><span>{exchanges.length ? `${exchanges.length} answered` : "No answers yet"}</span></div>
          {!exchanges.length && <div className="results-empty"><p>Your answer will appear here, including any sources AcumenAI provides.</p></div>}
          {[...exchanges].reverse().map((exchange, index) => <article className="question-answer" key={exchanges.length - index}><h3>{exchange.question}</h3><p className="answer-author">AcumenAI</p><div className="answer-text">{exchange.answer}</div><div className="assessment-actions"><button className="chip" onClick={async () => { try { await navigator.clipboard.writeText(exchange.answer); setNotice("Answer copied."); } catch { setNotice("Couldn't copy automatically. Select the answer text and copy it."); } }}>Copy answer</button><a className="chip" href={`data:text/plain;charset=utf-8,${encodeURIComponent(`${exchange.question}\n\n${exchange.answer}`)}`} download="acumen-answer.txt">Download .txt</a></div></article>)}
        </section>
      </section>
      <aside className="sidebar" aria-label="AcumenAI connection"><section className="card training-card"><div className="section-heading"><h2>Connect AcumenAI</h2><span>Local bridge</span></div><p className="muted">Start AcumenAI, then paste the pairing token printed in its terminal. The token stays in this tab's memory.</p><label className="input-label" htmlFor="acumen-token">Pairing token</label><input id="acumen-token" className="pairing-input" type="password" autoComplete="off" value={token} disabled={!!busy} onChange={(event) => { setToken(event.target.value); setConnected(false); setError(""); setNotice(""); }} /><div className="button-row"><button className="btn" disabled={!!busy || !token.trim()} onClick={() => void run("connect")}>{busy === "connect" ? "Connecting…" : connected ? "Check connection" : "Connect"}</button></div><details className="question-setup"><summary>Setup instructions</summary><p className="muted">In a terminal opened in your AcumenAI-2.0 folder, run:</p><pre>.\.worker-venv\Scripts\python.exe bridge.py</pre><p className="muted">Keep that terminal open. After restarting AcumenAI, paste its new token and reconnect. Orange connects to port 8765 by default.</p></details></section><section className="card learning-card"><h2>About answers</h2><p className="muted">AcumenAI handles supported math, homework, research, weather, and time questions. Answer quality depends on AcumenAI and its sources.</p><p className="muted">Questions go to your local AcumenAI bridge. Research may contact external websites. The last 30 answers stay in this view until you reload.</p><p className="muted">Learning remains in AcumenAI. Open its own interface to review and save new learning.</p></section></aside>
    </main>
  </>;
}
