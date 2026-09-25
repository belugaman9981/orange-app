import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { DRAFT_KEY, HISTORY_LIMIT, filterReviews, rememberReview, useWorkspace } from "./src/hooks/useWorkspace";
import { formatAssessment } from "./src/assessment";
import { useJev } from "./src/hooks/useJev";
import { Jev } from "./jev";
import { EXAMPLES_KEY, mergeExamples, parseSavedExamples } from "./src/data/savedExamples";
import { trainingData } from "./src/data/tickets";
import { RecentReviews } from "./src/components/RecentReviews";
import { SavedExamples } from "./src/components/SavedExamples";

function storage(blocked = false) {
  const values = new Map<string, string>();
  const check = () => { if (blocked) throw new Error("Storage blocked"); };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => { check(); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { check(); values.set(key, value); },
    removeItem: (key: string) => { check(); values.delete(key); },
  } });
  return values;
}

function mountHook<T>(hook: () => T) {
  let value: T;
  function Harness() { value = hook(); return null; }
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(Harness)); });
  return { get current() { return value!; }, unmount: () => act(() => renderer.unmount()) };
}

test("drafts survive remounts, including an intentionally empty new ticket", () => {
  const values = storage();
  const first = mountHook(() => useWorkspace("Sample"));
  act(() => first.current.setText("Unfinished customer reply"));
  assert.equal(values.get(DRAFT_KEY), "Unfinished customer reply");
  assert.equal(first.current.draftSaved, true);
  first.unmount();
  const restored = mountHook(() => useWorkspace("Sample"));
  assert.equal(restored.current.text, "Unfinished customer reply");
  act(() => restored.current.setText(""));
  restored.unmount();
  const empty = mountHook(() => useWorkspace("Sample"));
  assert.equal(empty.current.text, "");
  empty.unmount();
});

test("blocked storage keeps drafts editable and reports unsaved status", () => {
  storage(true);
  const hook = mountHook(() => useWorkspace("Sample"));
  act(() => hook.current.setText("Keep this draft"));
  assert.equal(hook.current.text, "Keep this draft");
  assert.equal(hook.current.draftSaved, false);
  hook.unmount();
});

test("recent reviews are bounded, deduplicated and ordered by last review", () => {
  let history: string[] = [];
  for (let i = 1; i <= 23; i++) history = rememberReview(history, `Ticket ${i}`);
  assert.equal(history.length, HISTORY_LIMIT);
  assert.equal(history[0], "Ticket 23");
  assert.equal(history.at(-1), "Ticket 4");
  const repeated = rememberReview(history, " Ticket 5 ");
  assert.equal(repeated[0], "Ticket 5");
  assert.equal(repeated[1], "Ticket 23");
  assert.equal(repeated.filter((message) => message === "Ticket 5").length, 1);
  assert.equal(repeated.length, HISTORY_LIMIT);
  assert.deepEqual(rememberReview(history, "  "), history);
});

test("recent reviews stay in the current session while drafts persist", () => {
  storage();
  const hook = mountHook(() => useWorkspace("Sample"));
  act(() => hook.current.setRecent(["Previously reviewed"]));
  hook.unmount();
  const fresh = mountHook(() => useWorkspace("Sample"));
  assert.deepEqual(fresh.current.recent, []);
  fresh.unmount();
});

test("copy text includes the message, all assessments and their confidence", () => {
  const summary = formatAssessment("  Where is my order?  ", {
    sentiment: { value: "neutral", confidence: 0.8 },
    urgency: { value: 4.25, confidence: 0.65 },
    needsEscalation: { value: false, confidence: 0.9 },
  });
  assert.equal(summary, "Ticket assessment\n\nWhere is my order?\n\nSentiment: neutral (80% confidence)\nUrgency: 4.3 / 10 (65% confidence)\nNeeds escalation: No (90% confidence)");
});

test("a new label reaches the immediate retrain and does not share mutable labels", async () => {
  storage();
  const hook = mountHook(useJev);
  const count = hook.current.examples.length;
  const labels = { sentiment: "angry" as const, urgency: 9, needsEscalation: true };
  const originalTrain = Jev.prototype.train;
  let trainedMessage = "";
  Jev.prototype.train = function (dataset, options) {
    trainedMessage = String(dataset[dataset.length - 1].state);
    return originalTrain.call(this, dataset, options);
  };
  try {
    await act(async () => {
      const dataset = hook.current.addExample("New urgent refund ticket", labels);
      labels.urgency = 1;
      assert.equal(dataset.length, count + 1);
      assert.equal(dataset[dataset.length - 1].labels.urgency, 9);
      await hook.current.train({ dataset, epochs: 2 });
    });
    assert.equal(trainedMessage, "New urgent refund ticket");
    assert.equal(hook.current.examples.length, count + 1);
    assert.equal(hook.current.isTrained, true);
    assert.equal(hook.current.isTraining, false);
    assert.ok(hook.current.predict("New urgent refund ticket"));
  } finally {
    Jev.prototype.train = originalTrain;
    hook.unmount();
  }
});

test("unavailable model storage does not prevent startup or in-memory reset", () => {
  storage(true);
  const hook = mountHook(useJev);
  assert.equal(hook.current.load(), false);
  act(() => hook.current.reset());
  assert.equal(hook.current.isTrained, false);
  hook.unmount();
});

test("saved corrections survive remount and replace built-in labels without duplicates", () => {
  storage();
  const hook = mountHook(useJev);
  const message = trainingData[0].state;
  act(() => { hook.current.addExample(` ${message} `, { sentiment: "happy", urgency: 2, needsEscalation: false }); });
  act(() => { hook.current.addExample(message, { sentiment: "neutral", urgency: 3, needsEscalation: true }); });
  assert.equal(hook.current.examples.length, trainingData.length);
  assert.equal(hook.current.savedExamples.length, 1);
  hook.unmount();
  const restored = mountHook(useJev);
  assert.equal(restored.current.examples.find((item) => item.state === message)?.labels.urgency, 3);
  assert.equal(restored.current.savedExamples.length, 1);
  act(() => { restored.current.removeExample(message); });
  assert.deepEqual(restored.current.examples.find((item) => item.state === message), trainingData[0]);
  restored.unmount();
  const removed = mountHook(useJev);
  assert.equal(removed.current.savedExamples.length, 0);
  removed.unmount();
});

test("a removed custom example can be restored with its previous labels", () => {
  storage();
  const hook = mountHook(useJev);
  const labels = { sentiment: "angry" as const, urgency: 7, needsEscalation: true };
  act(() => { hook.current.addExample("A custom ticket", labels); });
  const backup = hook.current.savedExamples[0];
  act(() => { hook.current.removeExample(backup.state); });
  assert.equal(hook.current.examples.length, trainingData.length);
  act(() => { hook.current.addExample(backup.state, backup.labels); });
  assert.deepEqual(hook.current.savedExamples[0], backup);
  assert.equal(hook.current.examples.length, trainingData.length + 1);
  hook.unmount();
});

test("invalid stored labels fall back without rewriting the damaged source", () => {
  const values = storage();
  values.set(EXAMPLES_KEY, "{broken");
  const hook = mountHook(useJev);
  assert.equal(hook.current.examples.length, trainingData.length);
  assert.match(hook.current.examplesNotice, /couldn't be loaded/);
  assert.equal(values.get(EXAMPLES_KEY), "{broken");
  hook.unmount();
  for (const labels of [null, { sentiment: "other", urgency: 3, needsEscalation: true }, { sentiment: "happy", urgency: 11, needsEscalation: false }, { sentiment: "happy", urgency: 2, needsEscalation: "false" }]) {
    assert.throws(() => parseSavedExamples(JSON.stringify({ version: 1, examples: [{ state: "Message", labels }] })));
  }
  assert.throws(() => parseSavedExamples('{"version":2,"examples":[]}'));
  assert.equal(mergeExamples([]).length, trainingData.length);
});

test("unavailable storage keeps custom examples in memory with an explicit notice", () => {
  storage(true);
  const hook = mountHook(useJev);
  act(() => { hook.current.addExample("Unsaved custom ticket", { sentiment: "neutral", urgency: 4, needsEscalation: false }); });
  assert.equal(hook.current.savedExamples.length, 1);
  assert.match(hook.current.examplesNotice, /couldn't be saved/);
  hook.unmount();
});

test("model snapshots load only when the saved labels still match", async () => {
  storage();
  const hook = mountHook(useJev);
  await act(async () => { await hook.current.train({ epochs: 2 }); });
  hook.current.save();
  hook.unmount();
  const restored = mountHook(useJev);
  let loaded = false;
  act(() => { loaded = restored.current.load(); });
  assert.equal(loaded, true);
  const sample = "New label after saving weights";
  act(() => { restored.current.addExample(sample, { sentiment: "neutral", urgency: 5, needsEscalation: false }); });
  assert.equal(restored.current.isTrained, false);
  restored.unmount();
  const stale = mountHook(useJev);
  assert.equal(stale.current.load(), false);
  assert.equal(stale.current.savedExamples[0].state, sample);
  stale.unmount();
});

test("training failures release the busy state and allow a retry", async () => {
  storage();
  const hook = mountHook(useJev);
  const originalTrain = Jev.prototype.train;
  try {
    Jev.prototype.train = function () { throw new Error("Test failure"); };
    await act(async () => { await assert.rejects(hook.current.train({ epochs: 1 }), /Test failure/); });
    assert.equal(hook.current.isTraining, false);
    assert.equal(hook.current.isTrained, false);
    Jev.prototype.train = originalTrain;
    await act(async () => { await hook.current.train({ epochs: 1 }); });
    assert.equal(hook.current.isTrained, true);
  } finally { Jev.prototype.train = originalTrain; hook.unmount(); }
});

test("overlapping startup calls share a single training run", async () => {
  storage();
  const hook = mountHook(useJev);
  await act(async () => {
    const first = hook.current.train({ epochs: 1 });
    const second = hook.current.train({ epochs: 1 });
    assert.equal(first, second);
    await first;
  });
  assert.equal(hook.current.lossHistory.length, 1);
  hook.unmount();
});

test("recent review search filters visibly, opens results, and can be cleared", () => {
  const messages = ["Refund pending", "Delivery question", "Another REFUND"];
  assert.deepEqual(filterReviews(messages, " refund "), [messages[0], messages[2]]);
  let opened = "";
  let cleared = false;
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(RecentReviews, { messages, onOpen: (message) => { opened = message; }, onClear: () => { cleared = true; } })); });
  const root = renderer!.root;
  act(() => { root.findByType("input").props.onChange({ target: { value: "refund" } }); });
  assert.equal(root.findAllByType("li").length, 2);
  act(() => { root.findAllByType("li")[0].findByType("button").props.onClick(); });
  assert.equal(opened, messages[0]);
  act(() => { root.findByType("input").props.onChange({ target: { value: "absent" } }); });
  assert.equal(root.findAllByType("li").length, 0);
  assert.ok(JSON.stringify(renderer!.toJSON()).includes("No messages match this search."));
  act(() => { root.findAllByType("button").find((button) => button.children.includes("Clear search"))!.props.onClick(); });
  assert.equal(root.findAllByType("li").length, 3);
  act(() => { root.findAllByType("button").find((button) => button.children.includes("Clear history"))!.props.onClick(); });
  assert.equal(cleared, true);
  act(() => renderer!.unmount());
});

test("saved label controls expose the exact example for editing and removal", () => {
  const example = { state: "Saved message", labels: { sentiment: "neutral" as const, urgency: 6, needsEscalation: true } };
  let edited: unknown;
  let removed: unknown;
  let renderer: ReturnType<typeof create>;
  const props = { examples: [example], disabled: false, onEdit: (item: unknown) => { edited = item; }, onRemove: (item: unknown) => { removed = item; } };
  act(() => { renderer = create(createElement(SavedExamples, props)); });
  const buttons = renderer!.root.findAllByType("button");
  act(() => { buttons[0].props.onClick(); buttons[1].props.onClick(); });
  assert.deepEqual(edited, example);
  assert.deepEqual(removed, example);
  act(() => renderer!.update(createElement(SavedExamples, { ...props, disabled: true })));
  assert.ok(renderer!.root.findAllByType("button").every((button) => button.props.disabled));
  act(() => renderer!.unmount());
});
