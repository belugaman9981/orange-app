import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { ConfidenceBar } from "./components/ConfidenceBar";
import { Sparkline } from "./components/Sparkline";
import { useJev, type TicketDecision } from "./hooks/useJev";
import { unlabeledPool } from "./data/tickets";
import type { TicketLabels } from "./data/tickets";
import "./App.css";

const SAMPLE_TICKETS = [
  "Still no refund after 2 weeks, this is ridiculous.",
  "Thanks, that answers my question!",
  "Could you tell me when my package will arrive?",
];
const SAMPLE_LABELS = ["Refund request", "Thank-you note", "Delivery question"];

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
  const jev = useJev();
  const [text, setText] = useState(SAMPLE_TICKETS[0]);
  const [decision, setDecision] = useState<TicketDecision | null>(null);
  const [uncertain, setUncertain] = useState<{ state: unknown; minConfidence: number }[]>([]);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [draftLabels, setDraftLabels] = useState<TicketLabels>({ sentiment: "neutral", urgency: 5, needsEscalation: false });
  const [status, setStatus] = useState<string>("");

  const updateText = (value: string) => {
    setText(value);
    setDecision(null);
  };

  useEffect(() => {
    const loaded = jev.load();
    if (!loaded) void jev.train();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePredict = () => {
    const result = jev.predict(text);
    setDecision(result);
  };

  const handleTrain = async () => {
    setStatus("Training…");
    await jev.train();
    setStatus("Model retrained on the full dataset.");
  };

  const handleSuggest = () => {
    setUncertain(jev.pickUncertain(unlabeledPool, 5));
  };

  const handleSave = () => {
    jev.save();
    setStatus("Model weights saved to this browser.");
  };

  const handleReset = () => {
    jev.reset();
    setDecision(null);
    setUncertain([]);
    setStatus("Model reset. Train again to start fresh.");
  };

  const handleAddExample = async () => {
    jev.addExample(text, draftLabels);
    setStatus("Example added — retraining…");
    await jev.train();
    setShowLabelForm(false);
    setStatus(`Example added. Dataset now has ${jev.examples.length} tickets.`);
  };

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

      <div className="page-heading">
        <div>
          <p className="eyebrow">Inbox essentials</p>
          <h1>Ticket triage</h1>
          <p className="page-description">A second look before the next reply.</p>
        </div>
        <span className={`model-state${jev.isTrained ? " model-state--ready" : ""}`}>
          <span aria-hidden="true" />{jev.isTraining ? "Training model" : jev.isTrained ? "Ready to review" : "Model not trained"}
        </span>
      </div>

      <main className="layout">
        <section className="card card--main">
          <div className="section-heading"><h2>Review a ticket</h2><span>01 / Message</span></div>
          <p className="muted">Check sentiment, urgency, and whether a message needs escalation.</p>

          <label className="input-label" htmlFor="ticket-message">Customer message</label>
          <textarea
            id="ticket-message"
            className="ticket-input"
            rows={4}
            value={text}
            onChange={(e) => updateText(e.target.value)}
            placeholder="e.g. Still no refund after 2 weeks, this is ridiculous."
          />

          <div className="sample-chips">
            <span>Try an example:</span>
            {SAMPLE_TICKETS.map((sample, index) => (
              <button key={sample} className={`chip${text === sample ? " chip--active" : ""}`} aria-pressed={text === sample} onClick={() => updateText(sample)}>
                {SAMPLE_LABELS[index]}
              </button>
            ))}
          </div>

          <div className="button-row">
            <button className="btn btn--primary" onClick={handlePredict} disabled={!jev.isTrained || jev.isTraining || !text.trim()}>
              Review ticket <span aria-hidden="true">→</span>
            </button>
            <button className="btn" onClick={() => setShowLabelForm((v) => !v)} aria-expanded={showLabelForm} aria-controls="ticket-label-form" disabled={!text.trim()}>
              {showLabelForm ? "Cancel labeling" : "Add training example"}
            </button>
          </div>

          {!jev.isTrained && <p className="hint">{jev.isTraining ? "Preparing the model. This takes a moment." : 'Select "Train model" to start reviewing tickets.'}</p>}

          <section className="review-section" aria-label="Ticket assessment" aria-live="polite">
            <div className="section-heading"><h2>Assessment</h2><span>02 / Results</span></div>
            {decisionCards ?? <div className="results-empty"><span className="results-empty__mark" aria-hidden="true">—</span><p>Your assessment will appear here.</p><span>Review a message to see its labels and confidence scores.</span></div>}
          </section>

          {showLabelForm && (
            <div className="label-form" id="ticket-label-form">
              <h3>Label this ticket</h3>
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
              <button className="btn btn--primary" onClick={handleAddExample} disabled={jev.isTraining}>
                {jev.isTraining ? "Training…" : "Add example & retrain"}
              </button>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <section className="card">
            <h2>Training</h2>
            <p className="muted">
              {jev.examples.length} labeled tickets · {epochsTrained} epochs trained
            </p>
            <div className="button-row">
              <button className="btn" onClick={handleTrain} disabled={jev.isTraining}>
                {jev.isTraining ? "Training…" : jev.isTrained ? "Retrain" : "Train model"}
              </button>
              <button className="btn" onClick={handleSave} disabled={!jev.isTrained}>
                Save
              </button>
              <button className="btn btn--danger" onClick={handleReset} disabled={jev.isTraining}>
                Reset
              </button>
            </div>
            {status && <p className="hint" role="status">{status}</p>}
            <p className="chart-label">Training loss</p>
            <Sparkline values={jev.lossHistory} />
          </section>

          <section className="card">
            <h2>Model performance</h2>
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
          </section>

          <section className="card">
            <h2>Needs a human read</h2>
            <p className="muted">Find tickets the model is least sure about and add your own labels.</p>
            <button className="btn" onClick={handleSuggest} disabled={!jev.isTrained}>
              Find tickets to label
            </button>
            {uncertain.length > 0 && (
              <ul className="uncertain-list">
                {uncertain.map(({ state, minConfidence }) => (
                  <li key={String(state)}>
                    <button className="uncertain-item" onClick={() => updateText(String(state))}>
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
        <span>Orange / Support tools</span><p>Messages are processed on this device.</p>
      </footer>
    </div>
  );
}
