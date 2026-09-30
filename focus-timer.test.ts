import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { FocusTimer } from "./src/components/FocusTimer";
import { createFocusTimer, formatFocusTime, pauseFocusTimer, refreshFocusTimer, resetFocusTimer, startFocusTimer } from "./src/focusTimer";

test("focus countdown uses elapsed time even when background updates are skipped", () => {
  const timer = startFocusTimer(createFocusTimer(5), 10_000);
  assert.equal(refreshFocusTimer(timer, 70_999).remainingMs, 239_001);
  assert.equal(formatFocusTime(refreshFocusTimer(timer, 70_999).remainingMs), "04:00");
  const finished = refreshFocusTimer(timer, 500_000);
  assert.equal(finished.status, "finished");
  assert.equal(finished.remainingMs, 0);
  assert.equal(finished.endsAt, null);
  assert.equal(refreshFocusTimer(finished, 510_000), finished);
  assert.equal(formatFocusTime(1), "00:01");
});

test("pausing captures exact remaining time and resuming excludes the pause", () => {
  const started = startFocusTimer(createFocusTimer(5), 10_000);
  const paused = pauseFocusTimer(started, 42_500);
  assert.equal(paused.remainingMs, 267_500);
  assert.equal(paused.status, "paused");
  assert.equal(paused.endsAt, null);
  assert.equal(refreshFocusTimer(paused, 1_000_000), paused);
  const resumed = startFocusTimer(paused, 1_000_000);
  assert.equal(resumed.endsAt, 1_267_500);
  assert.equal(refreshFocusTimer(resumed, 1_267_499).status, "running");
  assert.equal(refreshFocusTimer(resumed, 1_267_500).status, "finished");
});

test("reset restores the chosen duration and a finished session can start again", () => {
  const started = startFocusTimer(createFocusTimer(15), 0);
  assert.deepEqual(resetFocusTimer(pauseFocusTimer(started, 123_456)), createFocusTimer(15));
  const finished = pauseFocusTimer(started, 900_001);
  assert.equal(finished.status, "finished", "a late pause must not revive an expired timer");
  const restarted = startFocusTimer(finished, 1_000_000);
  assert.equal(restarted.status, "running");
  assert.equal(restarted.remainingMs, 900_000);
  assert.equal(restarted.endsAt, 1_900_000);
});

test("timer controls show pause, resume and completion without announcing every tick", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalNow = Date.now;
  let now = 100_000;
  let tick: (() => void) | undefined;
  let visibilityRefresh: (() => void) | undefined;
  let cleared = 0;
  const states: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setInterval: (callback: () => void) => { tick = callback; return 1; },
    clearInterval: () => { tick = undefined; cleared++; },
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    addEventListener: (_event: string, callback: () => void) => { visibilityRefresh = callback; },
    removeEventListener: () => { visibilityRefresh = undefined; },
  } });
  Date.now = () => now;
  let renderer: ReturnType<typeof create> | undefined;
  try {
    act(() => { renderer = create(createElement(FocusTimer, { onStateChange: (state) => states.push(state) })); });
    const root = renderer!.root;
    const button = (label: string) => root.findAllByType("button").find((item) => item.children.join("") === label)!;
    const display = () => root.findByProps({ role: "timer" });
    act(() => button("5 min").props.onClick());
    assert.equal(display().children[0], "05:00");
    assert.equal(button("5 min").props["aria-pressed"], true);
    act(() => button("Start timer").props.onClick());
    assert.equal(button("15 min").props.disabled, true);
    assert.equal(root.findByProps({ id: "timer-custom-minutes" }).props.disabled, true);
    assert.equal(button("Set timer").props.disabled, true);
    now += 65_000;
    act(() => tick!());
    assert.equal(display().children[0], "03:55");
    assert.equal(display().props["aria-live"], "off");
    assert.deepEqual(states, ["idle", "running"], "ordinary ticks do not report a new session state");
    act(() => button("Pause timer").props.onClick());
    assert.equal(tick, undefined);
    now += 120_000;
    act(() => button("Resume timer").props.onClick());
    assert.equal(display().children[0], "03:55");
    now += 235_000;
    act(() => visibilityRefresh!());
    assert.equal(display().children[0], "00:00");
    assert.equal(root.findByProps({ role: "status" }).children[0], "Session complete. Take a breather.");
    assert.equal(tick, undefined);
    assert.ok(button("Start again"));
    act(() => button("Reset timer").props.onClick());
    assert.equal(display().children[0], "05:00");
    assert.equal(button("Reset timer").props.disabled, true);
    act(() => button("Start timer").props.onClick());
    act(() => renderer!.unmount());
    renderer = undefined;
    assert.equal(tick, undefined);
    assert.equal(visibilityRefresh, undefined);
    assert.equal(cleared, 3);
    assert.deepEqual(states, ["idle", "running", "paused", "running", "finished", "idle", "running"]);
  } finally {
    if (renderer) act(() => renderer!.unmount());
    Date.now = originalNow;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("custom timer accepts whole minutes from 1 to 180 and rejects invalid lengths", () => {
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(FocusTimer)); });
  try {
    const input = () => renderer.root.findByProps({ id: "timer-custom-minutes" });
    const submit = () => act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    for (const value of ["", "0", "181", "1.5", "-5", "NaN"]) {
      act(() => input().props.onChange({ target: { value } }));
      submit();
      assert.equal(renderer!.root.findByProps({ role: "timer" }).children[0], "25:00");
    }
    for (const value of ["1", "42", "180"]) {
      act(() => input().props.onChange({ target: { value } }));
      submit();
      assert.equal(renderer!.root.findByProps({ role: "timer" }).children[0], `${value.padStart(2, "0")}:00`);
    }
  } finally { act(() => renderer!.unmount()); }
});
