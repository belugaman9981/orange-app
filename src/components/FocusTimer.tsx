import { useEffect, useState } from "react";
import { createFocusTimer, formatFocusTime, pauseFocusTimer, refreshFocusTimer, resetFocusTimer, startFocusTimer } from "../focusTimer";
import type { FocusTimerStatus } from "../focusTimer";

interface Props {
  onStateChange?: (state: FocusTimerStatus) => void;
}

export function FocusTimer({ onStateChange }: Props) {
  const [timer, setTimer] = useState(() => createFocusTimer());
  const [customMinutes, setCustomMinutes] = useState("25");
  const minutes = Number(customMinutes);
  const validMinutes = customMinutes.trim() !== "" && Number.isInteger(minutes) && minutes >= 1 && minutes <= 180;

  useEffect(() => { onStateChange?.(timer.status); }, [onStateChange, timer.status]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const refresh = () => setTimer((current) => refreshFocusTimer(current, Date.now()));
    const interval = window.setInterval(refresh, 250);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [timer.status]);

  const statusText = timer.status === "finished"
    ? "Session complete. Take a breather."
    : timer.status === "running"
      ? "Focus session running. One thing at a time."
      : timer.status === "paused"
        ? "Paused. Pick up when you're ready."
        : "Choose a little time for one thing.";

  return <section className="card focus-timer" aria-labelledby="focus-timer-heading">
    <div className="section-heading"><h2 id="focus-timer-heading">Focus timer</h2><span>One task at a time</span></div>
    <div className="button-row focus-timer__presets" role="group" aria-label="Focus session length">
      {[5, 15, 25].map((minutes) => <button
        key={minutes}
        className={`chip${timer.durationMs === minutes * 60_000 ? " chip--active" : ""}`}
        aria-pressed={timer.durationMs === minutes * 60_000}
        disabled={timer.status === "running"}
        onClick={() => { setTimer(createFocusTimer(minutes)); setCustomMinutes(String(minutes)); }}
      >{minutes} min</button>)}
    </div>
    <form className="timer-custom" onSubmit={(event) => {
      event.preventDefault();
      if (timer.status !== "running" && validMinutes) setTimer(createFocusTimer(minutes));
    }}>
      <label htmlFor="timer-custom-minutes">Custom minutes</label>
      <div className="timer-custom-entry"><input id="timer-custom-minutes" type="number" min={1} max={180} step={1} value={customMinutes} disabled={timer.status === "running"} aria-describedby="timer-custom-hint" onChange={(event) => setCustomMinutes(event.target.value)} /><button className="btn" type="submit" disabled={timer.status === "running" || !validMinutes}>Set timer</button></div>
      <p className="muted" id="timer-custom-hint">1–180 minutes. Setting a length resets the session.</p>
    </form>
    <div className="focus-timer__display" role="timer" aria-live="off" aria-label="Time remaining">{formatFocusTime(timer.remainingMs)}</div>
    <progress className="focus-timer__progress" max={timer.durationMs} value={timer.durationMs - timer.remainingMs} aria-label="Focus session progress" />
    <p className="focus-timer__status" role="status" aria-atomic="true">{statusText}</p>
    <div className="button-row">
      {timer.status === "running"
        ? <button className="btn btn--primary" onClick={() => setTimer((current) => pauseFocusTimer(current, Date.now()))}>Pause timer</button>
        : <button className="btn btn--primary" onClick={() => setTimer((current) => startFocusTimer(current, Date.now()))}>{timer.status === "paused" ? "Resume timer" : timer.status === "finished" ? "Start again" : "Start timer"}</button>}
      <button className="btn" disabled={timer.status === "idle"} onClick={() => setTimer((current) => resetFocusTimer(current))}>Reset timer</button>
    </div>
    <p className="muted">Keeps running while you use other tabs. This session resets if you reload or close Orange.</p>
  </section>;
}
