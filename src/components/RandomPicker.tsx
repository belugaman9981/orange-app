import { useMemo, useState } from "react";
import { MAX_RANDOM_INPUT_LENGTH, parseRandomChoices, pickRandomChoice } from "../randomPicker";

export function RandomPicker() {
  const [text, setText] = useState("");
  const [noRepeats, setNoRepeats] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawCount, setDrawCount] = useState(0);
  const { choices, error } = useMemo(() => parseRandomChoices(text), [text]);
  const remaining = noRepeats ? choices.filter((choice) => !picked.includes(choice)) : choices;
  const exhausted = noRepeats && choices.length > 0 && remaining.length === 0;

  function resetDraw() {
    setPicked([]);
    setSelected(null);
    setDrawCount(0);
  }

  function pick() {
    if (error) return;
    const choice = pickRandomChoice(remaining);
    if (choice === null) return;
    setSelected(choice);
    setDrawCount((count) => count + 1);
    if (noRepeats) setPicked((previous) => [...previous, choice]);
  }

  return <section className="card random-picker" aria-labelledby="random-picker-heading">
    <div className="section-heading"><h2 id="random-picker-heading">Random picker</h2></div>
    <p className="muted">Give a small decision to chance.</p>
    <label className="input-label" htmlFor="random-picker-choices">Your choices</label>
    <textarea
      id="random-picker-choices"
      rows={5}
      value={text}
      maxLength={MAX_RANDOM_INPUT_LENGTH}
      aria-describedby={`random-picker-help${error ? " random-picker-error" : ""}`}
      aria-invalid={Boolean(error)}
      onChange={(event) => { setText(event.target.value); resetDraw(); }}
    />
    <p className="muted random-picker-help" id="random-picker-help">One choice per line, up to 100 choices and 10,000 characters. Blank lines and duplicates are ignored, including case differences.</p>
    {error && <p id="random-picker-error" className="hint tone-bad" role="alert">{error}</p>}
    <div className="random-picker-controls">
      <label className="random-picker-toggle" htmlFor="random-picker-no-repeats">
        <input
          id="random-picker-no-repeats"
          type="checkbox"
          checked={noRepeats}
          onChange={(event) => { setNoRepeats(event.target.checked); resetDraw(); }}
        />
        No repeats
      </label>
      <span className="muted random-picker-count">{noRepeats ? `${remaining.length} of ${choices.length} remaining` : `${choices.length} ${choices.length === 1 ? "choice" : "choices"}`}</span>
    </div>
    <div className="button-row">
      <button type="button" className="btn btn--primary" disabled={Boolean(error) || remaining.length === 0} onClick={pick}>{drawCount > 0 ? "Pick again" : "Pick a choice"}</button>
      <button type="button" className="btn" disabled={drawCount === 0} onClick={resetDraw}>Reset draw</button>
    </div>
    <div className="random-picker-result" role="status" aria-live="polite" aria-atomic="true">
      {selected !== null ? <>
        <span className="muted">Pick {drawCount}</span>
        <p className="random-picker-selection">{selected}</p>
        <p className="muted">{exhausted ? "Every choice has been picked. Reset the draw to start again." : noRepeats ? `${remaining.length} ${remaining.length === 1 ? "choice" : "choices"} left in this draw.` : "All choices stay in the draw. The same choice can come up again."}</p>
      </> : <p className="muted">{choices.length > 0 ? "Ready when you are." : "Add your choices to get started."}</p>}
    </div>
    <p className="muted">Choices and draws stay in this tab until you reload or close Orange.</p>
  </section>;
}
