export type FocusTimerStatus = "idle" | "running" | "paused" | "finished";

export interface FocusTimerState {
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  status: FocusTimerStatus;
}

export function createFocusTimer(minutes = 25): FocusTimerState {
  const durationMs = minutes * 60_000;
  return { durationMs, remainingMs: durationMs, endsAt: null, status: "idle" };
}

export function refreshFocusTimer(timer: FocusTimerState, now: number): FocusTimerState {
  if (timer.status !== "running" || timer.endsAt === null) return timer;
  const remainingMs = Math.max(0, timer.endsAt - now);
  return remainingMs > 0
    ? { ...timer, remainingMs }
    : { ...timer, remainingMs: 0, endsAt: null, status: "finished" };
}

export function startFocusTimer(timer: FocusTimerState, now: number): FocusTimerState {
  if (timer.status === "running") return refreshFocusTimer(timer, now);
  const remainingMs = timer.status === "finished" ? timer.durationMs : timer.remainingMs;
  return { ...timer, remainingMs, endsAt: now + remainingMs, status: "running" };
}

export function pauseFocusTimer(timer: FocusTimerState, now: number): FocusTimerState {
  const current = refreshFocusTimer(timer, now);
  if (current.status !== "running") return current;
  return { ...current, endsAt: null, status: "paused" };
}

export function resetFocusTimer(timer: FocusTimerState): FocusTimerState {
  return { ...timer, remainingMs: timer.durationMs, endsAt: null, status: "idle" };
}

export function formatFocusTime(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
