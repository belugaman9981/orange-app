import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { parseBatch, sortBatch, needsHumanReview, type BatchResult } from "./src/reviewWorkflow";
import { useReviewQueue, QUEUE_KEY } from "./src/hooks/useReviewQueue";
import { useJev, type TicketDecision } from "./src/hooks/useJev";
import { exportExamples, parseSavedExamples, mergeImportedExamples, EXAMPLES_KEY } from "./src/data/savedExamples";
import { BatchReview } from "./src/components/BatchReview";
import { LabelBackup } from "./src/components/LabelBackup";
import { ReviewQueue } from "./src/components/ReviewQueue";
import { ConfidenceGuide } from "./src/components/ConfidenceGuide";
import { AssessmentComparison } from "./src/components/AssessmentComparison";

function storage(blocked = false) {
  const values = new Map<string, string>();
  const check = () => { if (blocked) throw new Error("Storage unavailable"); };
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

function decision(urgency = 5, escalate = false, confidence = 0.8): TicketDecision {
  return { sentiment: { value: "neutral", confidence }, urgency: { value: urgency, confidence }, needsEscalation: { value: escalate, confidence } };
}
const labels = { sentiment: "neutral" as const, urgency: 4, needsEscalation: false };
const example = { state: "Refund question", labels, note: "Waiting on the payment processor." };
const button = (root: any, label: string) => root.findAllByType("button").find((item: any) => item.children.includes(label));

test("batch input supports lines and multiline dividers, deduplicates and rejects oversize batches", () => {
  assert.deepEqual(parseBatch(" A \r\nB\r\nA\n\n", "line"), ["A", "B"]);
  assert.deepEqual(parseBatch("First line\nSecond line\n---\nAnother message\n---\n", "divider"), ["First line\nSecond line", "Another message"]);
  assert.deepEqual(parseBatch(" \n ", "line"), []);
  assert.throws(() => parseBatch(Array.from({ length: 101 }, (_, i) => `Ticket ${i}`).join("\n"), "line"), /100 distinct/);
  assert.throws(() => parseBatch("a".repeat(100001), "line"), /100,000/);
});

test("batch sorting respects urgency, escalation and weakest confidence without mutating input", () => {
  const rows = [{ message: "urgent", decision: decision(9, false, 0.9) }, { message: "escalate", decision: decision(5, true, 0.8) }, { message: "uncertain", decision: decision(1, false, 0.4) }];
  assert.equal(sortBatch(rows, "urgency")[0].message, "urgent");
  assert.equal(sortBatch(rows, "escalation")[0].message, "escalate");
  assert.equal(sortBatch(rows, "confidence")[0].message, "uncertain");
  assert.equal(rows[0].message, "urgent");
  assert.deepEqual(sortBatch(rows, "original"), rows);
  assert.equal(needsHumanReview(decision(5, false, 0.7)), false);
  const lowUrgency = decision(); lowUrgency.urgency.confidence = 0.69;
  assert.equal(needsHumanReview(lowUrgency), true);
});

test("batch UI reviews, sorts, opens a result and invalidates stale assessments", () => {
  let reviewed: BatchResult[] = [];
  let opened = "";
  const props = { ready: true, modelVersion: 1, predict: (message: string) => message === "A" ? decision(2) : decision(9, true, 0.5), onReviewed: (rows: BatchResult[]) => { reviewed = rows; }, onOpen: (message: string) => { opened = message; } };
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(BatchReview, props)); });
  const root = renderer!.root;
  act(() => root.findByType("textarea").props.onChange({ target: { value: "A\nB\nA" } }));
  act(() => button(root, "Review batch").props.onClick());
  assert.equal(reviewed.length, 2);
  const resultButtons = () => root.findAllByProps({ className: "batch-message" });
  assert.equal(resultButtons()[0].children[0], "B");
  act(() => resultButtons()[0].props.onClick());
  assert.equal(opened, "B");
  act(() => root.findAllByType("select")[1].props.onChange({ target: { value: "original" } }));
  assert.equal(resultButtons()[0].children[0], "A");
  act(() => renderer!.update(createElement(BatchReview, { ...props, modelVersion: 2 })));
  assert.equal(resultButtons().length, 0);
  assert.match(JSON.stringify(renderer!.toJSON()), /Review the batch again/);
  act(() => button(root, "Review batch").props.onClick());
  act(() => root.findByType("textarea").props.onChange({ target: { value: "Changed" } }));
  assert.equal(resultButtons().length, 0);
  act(() => renderer!.unmount());
});

test("queue persists, deduplicates and supports completion with undo", () => {
  storage();
  const hook = mountHook(useReviewQueue);
  act(() => { hook.current.add([" A ", "B", "A"]); hook.current.add(["C"]); });
  assert.deepEqual(hook.current.messages, ["A", "B", "C"]);
  act(() => hook.current.complete("B"));
  assert.deepEqual(hook.current.messages, ["A", "C"]);
  act(() => hook.current.undo());
  assert.deepEqual(hook.current.messages, ["A", "C", "B"]);
  hook.unmount();
  const restored = mountHook(useReviewQueue);
  assert.deepEqual(restored.current.messages, ["A", "C", "B"]);
  restored.unmount();
});

test("queue handles corrupt data and unavailable storage without losing in-session changes", () => {
  const values = storage();
  values.set(QUEUE_KEY, '{"version":1,"messages":[null]}');
  const invalid = mountHook(useReviewQueue);
  assert.match(invalid.current.notice, /couldn't be loaded/);
  assert.deepEqual(invalid.current.messages, []);
  invalid.unmount();
  storage(true);
  const blocked = mountHook(useReviewQueue);
  act(() => blocked.current.add(["Keep this ticket"]));
  assert.deepEqual(blocked.current.messages, ["Keep this ticket"]);
  assert.match(blocked.current.notice, /couldn't be saved/);
  blocked.unmount();
});

test("queue controls open, complete, and undo without silently completing on open", () => {
  let opened = ""; let completed = ""; let undone = false;
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(ReviewQueue, { messages: ["Message"], notice: "", canUndo: true, onOpen: (message) => { opened = message; }, onComplete: (message) => { completed = message; }, onUndo: () => { undone = true; } })); });
  const root = renderer!.root;
  act(() => button(root, "Message").props.onClick());
  assert.equal(opened, "Message"); assert.equal(completed, "");
  act(() => button(root, "Mark reviewed").props.onClick());
  assert.equal(completed, "Message");
  act(() => button(root, "Undo last completion").props.onClick());
  assert.equal(undone, true);
  act(() => renderer!.unmount());
});

test("label backups round-trip notes, support legacy entries, and merge conflicts explicitly", () => {
  assert.deepEqual(parseSavedExamples(exportExamples([example])), [example]);
  assert.deepEqual(parseSavedExamples(exportExamples([{ state: "Legacy", labels }])), [{ state: "Legacy", labels }]);
  const incoming = { ...example, labels: { ...labels, urgency: 9 }, note: "Imported note" };
  assert.deepEqual(mergeImportedExamples([example], [incoming], false), [example]);
  assert.deepEqual(mergeImportedExamples([example], [incoming], true), [incoming]);
  assert.throws(() => parseSavedExamples(exportExamples([{ ...example, note: "x".repeat(2001) }])), /Invalid/);
});

test("bulk import validates atomically, trains the merged dataset, and restores notes", async () => {
  const values = storage();
  const hook = mountHook(useJev);
  act(() => { hook.current.addExample(example.state, labels, example.note); });
  const old = values.get(EXAMPLES_KEY);
  assert.throws(() => hook.current.importExamples([{ state: "Good", labels }, { state: "Bad", labels: { ...labels, urgency: 99 } }], true));
  assert.equal(values.get(EXAMPLES_KEY), old);
  assert.equal(hook.current.savedExamples.length, 1);
  await act(async () => {
    const dataset = hook.current.importExamples([{ ...example, note: "New note" }, { state: "New ticket", labels }], false);
    await hook.current.train({ dataset, epochs: 1 });
  });
  assert.equal(hook.current.savedExamples.length, 2);
  assert.equal(hook.current.savedExamples[0].note, example.note);
  assert.ok(hook.current.predict("New ticket"));
  hook.unmount();
  const restored = mountHook(useJev);
  assert.equal(restored.current.savedExamples[0].note, example.note);
  restored.unmount();
});

test("backup UI downloads notes, previews conflicts, imports only on apply, and rejects corrupt files", async () => {
  let imported: unknown = null;
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(LabelBackup, { examples: [example], disabled: false, onImport: async (items, replace) => { imported = { items, replace }; } })); });
  const root = renderer!.root;
  assert.deepEqual(parseSavedExamples(decodeURIComponent(root.findByType("a").props.href.split(",")[1])), [example]);
  const incoming = [{ ...example, note: "Imported" }, { state: "Second ticket", labels }];
  async function choose(raw: string, size = raw.length) {
    await act(async () => { root.findByType("input").props.onChange({ target: { files: [{ size, text: async () => raw }], value: "file.json" } }); await Promise.resolve(); });
  }
  await choose(exportExamples(incoming));
  assert.equal(imported, null);
  assert.match(JSON.stringify(renderer!.toJSON()), /already present/);
  assert.equal(root.findByType("select").props.value, "keep");
  act(() => root.findByType("select").props.onChange({ target: { value: "replace" } }));
  await act(async () => { await button(root, "Import & retrain").props.onClick(); });
  assert.deepEqual(imported, { items: incoming, replace: true });
  imported = null;
  await choose("{broken");
  assert.equal(button(root, "Import & retrain"), undefined);
  assert.equal(imported, null);
  await choose("{}", 3 * 1024 * 1024);
  assert.match(JSON.stringify(renderer!.toJSON()), /smaller than 2 MB/);
  act(() => renderer!.unmount());
});

test("predictions are available immediately after correction retraining for comparison", async () => {
  storage();
  const hook = mountHook(useJev);
  let before: TicketDecision | null = null; let after: TicketDecision | null = null;
  await act(async () => {
    await hook.current.train({ epochs: 1 });
    const predictor = hook.current.predict;
    before = predictor(example.state);
    const dataset = hook.current.addExample(example.state, { ...labels, urgency: 9 }, "Escalate after repeated failures.");
    assert.equal(predictor(example.state), null);
    await hook.current.train({ dataset, epochs: 1 });
    after = predictor(example.state);
  });
  assert.ok(before); assert.ok(after);
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(AssessmentComparison, { comparison: { message: example.state, before: before!, after: after! } })); });
  assert.equal(renderer!.root.findAllByType("tbody")[0].findAllByType("tr").length, 3);
  assert.match(JSON.stringify(renderer!.toJSON()), /After retraining/);
  act(() => renderer!.unmount());
  hook.unmount();
});

test("confidence guidance flags low confidence and avoids claiming measured accuracy", () => {
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(ConfidenceGuide, { decision: decision(4, false, 0.5) })); });
  assert.match(JSON.stringify(renderer!.toJSON()), /Needs a human check/);
  assert.match(JSON.stringify(renderer!.toJSON()), /not a measured chance/);
  act(() => renderer!.update(createElement(ConfidenceGuide, { decision: decision(4, false, 0.95) })));
  assert.equal(renderer!.root.findAllByProps({ className: "review-flag" }).length, 0);
  act(() => renderer!.unmount());
});
