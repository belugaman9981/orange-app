import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { Scratchpad, SCRATCHPAD_KEY } from "./src/components/Scratchpad";

function storage(blocked = false) {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => { if (blocked) throw new Error("Blocked"); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (blocked) throw new Error("Blocked"); values.set(key, value); },
  } });
  return values;
}

function mount() {
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(Scratchpad)); });
  return {
    get root() { return renderer.root; },
    get input() { return renderer.root.findByProps({ id: "scratchpad-notes" }); },
    button: (label: string) => renderer.root.findAllByType("button").find((button) => button.children.includes(label))!,
    unmount: () => act(() => renderer.unmount()),
  };
}

test("scratchpad persists separately, exports exact text, and can undo clearing", () => {
  const values = storage();
  values.set("orange-app:draft", "Ticket draft");
  values.set("orange-app:question-draft", "Question draft");
  const first = mount();
  const note = "A rough idea\n\nKeep spacing & symbols: café ☀";
  act(() => first.input.props.onChange({ target: { value: note } }));
  assert.equal(values.get(SCRATCHPAD_KEY), note);
  const download = first.root.findByType("a");
  assert.equal(download.props.download, "orange-notes.txt");
  assert.equal(decodeURIComponent(download.props.href.split(",")[1]), note);
  act(() => first.button("Clear notes").props.onClick());
  assert.equal(first.input.props.value, "");
  assert.equal(values.get(SCRATCHPAD_KEY), "");
  act(() => first.button("Undo clear").props.onClick());
  assert.equal(first.input.props.value, note);
  first.unmount();
  const restored = mount();
  try {
    assert.equal(restored.input.props.value, note);
    assert.equal(values.get("orange-app:draft"), "Ticket draft");
    assert.equal(values.get("orange-app:question-draft"), "Question draft");
    act(() => restored.button("Clear notes").props.onClick());
    act(() => restored.input.props.onChange({ target: { value: "New notes" } }));
    assert.equal(restored.button("Undo clear"), undefined);
  } finally { restored.unmount(); }
});

test("scratchpad remains editable and downloadable when storage is blocked", () => {
  storage(true);
  const view = mount();
  try {
    act(() => view.input.props.onChange({ target: { value: "Unsaved but recoverable" } }));
    assert.equal(view.input.props.value, "Unsaved but recoverable");
    assert.match(view.root.findByProps({ id: "scratchpad-save-status" }).children.join(""), /couldn't be saved/);
    assert.equal(view.button("Copy notes").props.disabled, false);
    assert.match(view.root.findByType("a").props.href, /Unsaved%20but%20recoverable/);
  } finally { view.unmount(); }
});

test("malformed Unicode in saved notes cannot crash rendering or downloads", () => {
  const values = storage();
  const note = `Keep emoji 🍊 and recover ${String.fromCharCode(0xd800)} this ${String.fromCharCode(0xdc00)}`;
  values.set(SCRATCHPAD_KEY, note);
  const view = mount();
  try {
    assert.equal(view.input.props.value, note);
    assert.equal(values.get(SCRATCHPAD_KEY), note);
    assert.equal(decodeURIComponent(view.root.findByType("a").props.href.split(",")[1]), "Keep emoji 🍊 and recover \uFFFD this \uFFFD");
  } finally { view.unmount(); }
});

test("scratchpad handles denied clipboard access and ignores stale copy results", async () => {
  storage();
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    clipboard: { writeText: async () => { throw new Error("Denied"); } },
  } });
  const view = mount();
  try {
    act(() => view.input.props.onChange({ target: { value: "Copy this" } }));
    await act(async () => { view.button("Copy notes").props.onClick(); });
    assert.match(JSON.stringify(view.root.findAllByProps({ role: "status" }).map((status) => status.children)), /Couldn't copy automatically/);
    let finishCopy!: () => void;
    navigator.clipboard.writeText = () => new Promise<void>((resolve) => { finishCopy = resolve; });
    act(() => view.button("Copy notes").props.onClick());
    act(() => view.input.props.onChange({ target: { value: "Different notes" } }));
    await act(async () => { finishCopy(); });
    assert.doesNotMatch(JSON.stringify(view.root.findAllByProps({ role: "status" }).map((status) => status.children)), /Notes copied/);
  } finally {
    view.unmount();
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
