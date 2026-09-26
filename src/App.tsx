import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { ConfidenceBar } from "./components/ConfidenceBar";
import { Sparkline } from "./components/Sparkline";
import { Icon } from "./components/Icon";
import { RecentReviews } from "./components/RecentReviews";
import { SavedExamples } from "./components/SavedExamples";
import { AskQuestion } from "./components/AskQuestion";
import { useJev, type TicketDecision } from "./hooks/useJev";
import { sampleTickets, unlabeledPool } from "./data/tickets";
import type { TicketExample, TicketLabels } from "./data/tickets";
import { rememberReview, useWorkspace } from "./hooks/useWorkspace";
import { formatAssessment } from "./assessment";
import "./App.css";

function escalationTone(value: boolean): "good" | "bad" {
  return value ? "bad" : "good";
}

function sentimentTone(value: string): "good" | "bad" | "neutral" {
  if (value === "happy") return "good";
  if (value === "angry") return "bad";
  return "neutral";
}

function urgencyTone(value: number): "good" | "warn" | "bad" {
  if (value >= 7) return "bad";
  if (value >= 4) return "warn";
  return "good";
}

export default function App() {
  const [mode, setMode] = useState<"tickets" | "questions">("questions");
  const jev = useJev();
  const { text, setText, draftSaved, recent, setRecent } = useWorkspace(sampleTickets[0].state);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const copyRequest = useRef(0);
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [decision, setDecision] = useState<TicketDecision | null>(null);
  const [uncertain, setUncertain] = useState<{ state: unknown; minConfidence: number }[]>([]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [draftLabels, setDraftLabels] = useState<TicketLabels>({ sentiment: "neutral", urgency: 5, needsEscalation: false });
  const [status, setStatus] = useState<string>("");
  const [removedExample, setRemovedExample] = useState<TicketExample | null>(null);

  const updateText = (value: string) => {
    copyRequest.current += 1;
    setText(value);
    setDecision(null);
    setCopyStatus("");
    setManualCopy(false);
    setShowLabelForm(false);
    setDraftLabels({ sentiment: "neutral", urgency: 5, needsEscalation: false });
  };

  const replaceMessage = (value: string) => {
    setPreviousDraft(text);
    updateText(value);
    messageInput.current?.focus();
  };

  const handleCopy = async () => {
    if (!decision) return;
    const request = ++copyRequest.current;
    try {
      await navigator.clipboard.writeText(formatAssessment(text, decision));
      if (request === copyRequest.current) {
        setCopyStatus("Assessment copied.");
        setManualCopy(false);
      }
    } catch {
      if (request === copyRequest.current) {
        setCopyStatus("Select the assessment below and copy it manually.");
        setManualCopy(true);
      }
    }
  };

  const openLabels = () => {
    const savedLabels = jev.savedExamples.find((example) => example.state === text.trim());
    if (savedLabels) setDraftLabels({ ...savedLabels.labels });
    else if (decision) setDraftLabels({
      sentiment: decision.sentiment.value as TicketLabels["sentiment"],
      urgency: Math.max(0, Math.min(10, Math.round(decision.urgency.value))),
      needsEscalation: decision.needsEscalation.value,
    });
    setShowLabelForm((value) => !value);
  };

  const handleSurpriseMe = () => {
    const choices = sampleTickets.filter((sample) => sample.state !== text);
    const sample = choices[Math.floor(Math.random() * choices.length)];
    replaceMessage(sample.state);
  };

  useEffect(() => {
    setDecision(null);
    setUncertain([]);
    setCopyStatus("");
    setManualCopy(false);
    copyRequest.current += 1;
  }, [jev.modelVersion]);

  useEffect(() => {
    const loaded = jev.load();
    if (!loaded) void jev.train().catch(() => setStatus("Training failed. Select Train model to try again."));
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePredict = () => {
    const result = jev.predict(text);
    setDecision(result);
    setCopyStatus("");
    setManualCopy(false);
    copyRequest.current += 1;
    if (result) setRecent((items) => rememberReview(items, text));
  };

  const handleTrain = async () => {
    setStatus("Training…");
    try {
      await jev.train();
      setStatus("Model retrained on the full dataset.");
    } catch { setStatus("Training failed. Try training the model again."); }
  };

  const handleSuggest = () => {
    setUncertain(jev.pickUncertain(unlabeledPool, 5));
  };

  const handleSave = () => {
    try {
      jev.save();
      setStatus("Model weights saved to this browser.");
    } catch { setStatus("Couldn't save the model. Browser storage may be unavailable or full."); }
  };

  const handleReset = () => {
    jev.reset();
    setDecision(null);
    setUncertain([]);
    setStatus("Model reset. Your labels are kept. Train again to start fresh.");
  };

  const handleAddExample = async () => {
    if (!text.trim() || jev.isTraining) return;
    try {
      const dataset = jev.addExample(text, draftLabels);
      setRemovedExample(null);
      setStatus("Labels updated — retraining…");
      await jev.train({ dataset });
      setShowLabelForm(false);
      setStatus(`Labels updated. Dataset now has ${dataset.length} tickets.`);
    } catch { setStatus("Couldn't finish retraining. Your current labels are still available; try Train model again."); }
  };

  const handleRemoveExample = async (example: TicketExample) => {
    if (jev.isTraining) return;
    try {
      const dataset = jev.removeExample(example.state);
      setRemovedExample(example);
      setStatus("Label removed — retraining…");
      await jev.train({ dataset });
      setStatus("Label removed. Model retrained.");
    } catch { setStatus("Couldn't finish retraining. Try Train model again."); }
  };

  const handleUndoRemove = async () => {
    if (!removedExample || jev.isTraining) return;
    try {
      const dataset = jev.addExample(removedExample.state, removedExample.labels);
      setRemovedExample(null);
      setStatus("Label restored — retraining…");
      await jev.train({ dataset });
      setStatus("Label restored. Model retrained.");
    } catch { setStatus("Couldn't finish retraining. Try Train model again."); }
  };

  const existingLabels = jev.savedExamples.find((example) => example.state === text.trim());

  const perQuestion = jev.report?.perQuestion;
  const epochsTrained = jev.lossHistory.length;

  const decisionCards = useMemo(() => {
    if (!decision) return null;
    return (
      <div className="predict-results">
        <ConfidenceBar label="Sentiment" value={decision.sentiment.value} confidence={decision.sentiment.confidence} tone={sentimentTone(decision.sentiment.value)} />
        <ConfidenceBar label="Urgency" value={`${decision.urgency.value.toFixed(1)} / 10`} confidence={decision.urgency.confidence} tone={urgencyTone(decision.urgency.value)} />
        <ConfidenceBar
          label="Needs escalation"
          value={decision.needsEscalation.value ? "Yes" : "No"}
          confidence={decision.needsEscalation.confidence}
          tone={escalationTone(decision.needsEscalation.value)}
        />
      </div>
    );
  }, [decision]);

  return (
    <div className="app">
      <Header />
      <nav className="mode-nav" aria-label="Orange tools">
        <button aria-pressed={mode === "questions"} onClick={() => setMode("questions")}>Ask a question</button>
        <button aria-pressed={mode === "tickets"} onClick={() => setMode("tickets")}>Ticket triage</button>
      </nav>
      <div hidden={mode !== "questions"}><AskQuestion /></div>
      <div hidden={mode !== "tickets"}>
      <div className="page-heading">
        <div>
          <h1>Ticket triage</h1>
          <p className="page-description">Review a customer message before you reply.</p>
        </div>
        <span role="status" className={`model-state${jev.isTrained && !jev.isTraining ? " model-state--ready" : ""}`}>
          <span aria-hidden="true" />{jev.isTraining ? "Training model" : jev.isTrained ? "Ready to review" : "Model not trained"}
        </span>
      </div>

      <main className="layout">
        <section className="card card--main" aria-labelledby="review-heading">
          <div className="section-heading"><h2 id="review-heading">Message</h2><div className="message-tools">
            {previousDraft !== null && <button className="chip" onClick={() => { updateText(previousDraft); setPreviousDraft(null); messageInput.current?.focus(); }}>Undo replacement</button>}
            <button className="chip" onClick={() => replaceMessage("")} disabled={!text}>New ticket</button>
          </div></div>

          <label className="input-label" htmlFor="ticket-message">Customer message</label>
          <div className="message-editor">
          <textarea
            id="ticket-message"
            ref={messageInput}
            className="ticket-input"
            rows={4}
            value={text}
            onChange={(e) => updateText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && jev.isTrained && !jev.isTraining && text.trim()) {
                e.preventDefault();
                handlePredict();
              }
            }}
            placeholder="e.g. Still no refund after 2 weeks, this is ridiculous."
          />
          <div className="editor-footer"><span>{draftSaved ? "Draft saved on this device" : "Draft not saved — keep this tab open"}</span><span>{text.length} {text.length === 1 ? "character" : "characters"}</span></div>
          </div>

          <div className="sample-chips">
            <span>Examples</span>
            {sampleTickets.slice(0, 3).map((sample) => (
              <button key={sample.state} className={`chip${text === sample.state ? " chip--active" : ""}`} aria-pressed={text === sample.state} onClick={() => replaceMessage(sample.state)}>
                {sample.label}
              </button>
            ))}
            <button className="chip" onClick={handleSurpriseMe}>Surprise me</button>
          </div>

          <div className="button-row review-actions">
            <button className="btn btn--primary" onClick={handlePredict} disabled={!jev.isTrained || jev.isTraining || !text.trim()}>
              <Icon name="message" />
              Review ticket
            </button>
            <button className="btn btn--quiet" onClick={openLabels} aria-expanded={showLabelForm} aria-controls="ticket-label-form" disabled={!text.trim() || jev.isTraining}>
              <Icon name={showLabelForm ? "check" : "sliders"} />
              {showLabelForm ? "Cancel labeling" : decision ? "Correct assessment" : "Add training example"}
            </button>
          </div>
          <p className="keyboard-hint">Ctrl / ⌘ + Enter</p>

          {!jev.isTrained && <p className="hint">{jev.isTraining ? "Preparing the model. This takes a moment." : 'Select "Train model" to start reviewing tickets.'}</p>}

          <section className="review-section" aria-label="Ticket assessment" aria-live="polite">
            <div className="section-heading"><h2>Assessment</h2><span>{decision ? "Review complete" : "No review yet"}</span></div>
            {decisionCards ?? <div className="results-empty"><p>Review the message to check sentiment, urgency, and escalation.</p></div>}
            {decision && <div className="assessment-actions"><button className="btn" onClick={handleCopy}>Copy assessment</button><a className="btn" href={`data:text/plain;charset=utf-8,${encodeURIComponent(formatAssessment(text, decision))}`} download="ticket-assessment.txt">Download .txt</a><span role="status">{copyStatus}</span></div>}
            {decision && manualCopy && <textarea className="copy-fallback" aria-label="Assessment to copy" readOnly rows={8} value={formatAssessment(text, decision)} onFocus={(event) => event.target.select()} />}
          </section>

          {showLabelForm && (
            <div className="label-form" id="ticket-label-form">
              <h3>Label this ticket</h3>
              {existingLabels && <p className="hint label-update-hint">This message already has saved labels. Saving replaces them.</p>}
              <div className="label-form__row">
                <label>
                  Sentiment
                  <select value={draftLabels.sentiment} onChange={(e) => setDraftLabels((d) => ({ ...d, sentiment: e.target.value as TicketLabels["sentiment"] }))}>
                    <option value="angry">angry</option>
                    <option value="neutral">neutral</option>
                    <option value="happy">happy</option>
                  </select>
                </label>
                <label>
                  Urgency ({draftLabels.urgency})
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={draftLabels.urgency}
                    onChange={(e) => setDraftLabels((d) => ({ ...d, urgency: Number(e.target.value) }))}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draftLabels.needsEscalation}
                    onChange={(e) => setDraftLabels((d) => ({ ...d, needsEscalation: e.target.checked }))}
                  />
                  Needs escalation
                </label>
              </div>
              <button className="btn btn--primary" onClick={handleAddExample} disabled={jev.isTraining || !text.trim()}>
                {jev.isTraining ? "Training…" : existingLabels ? "Update labels & retrain" : "Add example & retrain"}
              </button>
            </div>
          )}

          {recent.length > 0 && <RecentReviews messages={recent} onOpen={replaceMessage} onClear={() => setRecent([])} />}
        </section>

        <aside className="sidebar" aria-label="Model tools">
          <section className="card training-card">
            <div className="section-heading"><h2>Model</h2><span>On this device</span></div>
            <dl className="training-stats"><div><dt>Labeled tickets</dt><dd>{jev.examples.length}</dd></div><div><dt>Training epochs</dt><dd>{epochsTrained || "—"}</dd></div></dl>
            <div className="training-chart">
              <div className="chart-label"><span>Training loss</span><span>{jev.lossHistory.length ? jev.lossHistory[jev.lossHistory.length - 1].toFixed(3) : "—"}</span></div>
              <Sparkline values={jev.lossHistory} />
              {epochsTrained > 0 && <div className="chart-axis"><span>Epoch 1</span><span>{epochsTrained}</span></div>}
            </div>
            <div className="button-row">
              <button className="btn" onClick={handleTrain} disabled={jev.isTraining}>
                <Icon name="sliders" />
                {jev.isTraining ? "Training…" : jev.isTrained ? "Retrain" : "Train model"}
              </button>
              <button className="btn" onClick={handleSave} disabled={!jev.isTrained || jev.isTraining}>
                Save
              </button>
              <button className="btn btn--danger" onClick={handleReset} disabled={jev.isTraining}>
                Reset
              </button>
            </div>
            {status && <p className="hint" role="status">{status}</p>}
            {jev.examplesNotice && <p className="hint" role="status">{jev.examplesNotice}</p>}
            {removedExample && <button className="chip undo-label" disabled={jev.isTraining} onClick={handleUndoRemove}>Undo label removal</button>}
          </section>

          <SavedExamples examples={jev.savedExamples} disabled={jev.isTraining} onRemove={handleRemoveExample} onEdit={(example) => {
            replaceMessage(example.state);
            setDraftLabels({ ...example.labels });
            setShowLabelForm(true);
          }} />

          <details className="card performance-panel">
            <summary>Model performance <span aria-hidden="true">+</span></summary>
            <p className="muted">Measured on the training tickets.</p>
            {perQuestion ? (
              <table className="metrics-table">
                <tbody>
                  <tr>
                    <td>Sentiment accuracy</td>
                    <td>{((perQuestion.sentiment?.accuracy ?? 0) * 100).toFixed(0)}%</td>
                  </tr>
                  <tr>
                    <td>Sentiment Brier</td>
                    <td>{(perQuestion.sentiment?.brier ?? 0).toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td>Urgency MAE</td>
                    <td>{(perQuestion.urgency?.mae ?? 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Escalation accuracy</td>
                    <td>{((perQuestion.needsEscalation?.accuracy ?? 0) * 100).toFixed(0)}%</td>
                  </tr>
                  <tr>
                    <td>Avg loss</td>
                    <td>{jev.report?.avgLoss.toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="muted">Train the model to see metrics.</p>
            )}
          </details>

          <section className="card learning-card">
            <h2>Tickets to label</h2>
            <p className="muted">Review low-confidence tickets to improve the model.</p>
            <button className="btn btn--text" onClick={handleSuggest} disabled={!jev.isTrained || jev.isTraining}>
              Find tickets <Icon name="arrow" />
            </button>
            {uncertain.length > 0 && (
              <ul className="uncertain-list">
                {uncertain.map(({ state, minConfidence }) => (
                  <li key={String(state)}>
                    <button className="uncertain-item" onClick={() => { replaceMessage(String(state)); setShowLabelForm(true); }}>
                      <span>{String(state)}</span>
                      <span className="uncertain-item__pct">{Math.round(minConfidence * 100)}%<span>confidence</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>

      <footer className="app-footer">
        <p><Icon name="lock" /> Messages are processed on this device.</p>
      </footer>
      </div>
    </div>
  );
}
