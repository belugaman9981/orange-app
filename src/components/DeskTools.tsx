import { Scratchpad } from "./Scratchpad";
import { FocusTimer } from "./FocusTimer";
import { RandomPicker } from "./RandomPicker";
import { Checklist } from "./Checklist";
import "./DeskTools.css";

export function DeskTools({ onTimerStateChange }: { onTimerStateChange: (state: "idle" | "running" | "paused" | "finished") => void }) {
  return <>
    <div className="page-heading">
      <div><h1>Desk tools</h1><p className="page-description">Keep notes, run a timer, or let chance pick.</p></div>
      <span className="model-state">A little of everything</span>
    </div>
    <main className="desk-layout">
      <div className="desk-notes"><Scratchpad /><Checklist /></div>
      <div className="desk-utilities">
        <FocusTimer onStateChange={onTimerStateChange} />
        <RandomPicker />
      </div>
    </main>
    <footer className="app-footer"><p>These tools run in your browser. Notes stay separate from your questions and tickets.</p></footer>
  </>;
}
