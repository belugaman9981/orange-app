import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { Checklist, CHECKLIST_KEY, parseChecklist } from "./src/components/Checklist";

test("checklist saves tasks and completion, restores removals, and survives remount", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(Checklist)); });
  const button = (text: string) => renderer.root.findAllByType("button").find((item) => item.children.includes(text))!;
  const add = (text: string) => {
    act(() => renderer.root.findByProps({ id: "checklist-new" }).props.onChange({ target: { value: text } }));
    act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
  };
  try {
    add("   ");
    assert.equal(renderer!.root.findAllByType("li").length, 0);
    add(" First task "); add("Second task");
    act(() => renderer.root.findAllByProps({ type: "checkbox" })[0].props.onChange());
    assert.equal(parseChecklist(values.get(CHECKLIST_KEY)!)[0].done, true);
    act(() => button("Clear completed").props.onClick());
    assert.deepEqual(parseChecklist(values.get(CHECKLIST_KEY)!).map((item) => item.text), ["Second task"]);
    act(() => button("Undo removal").props.onClick());
    assert.equal(renderer!.root.findAllByType("li").length, 2);
    act(() => renderer.unmount());
    act(() => { renderer = create(createElement(Checklist)); });
    assert.equal(renderer!.root.findAllByProps({ type: "checkbox" })[0].props.checked, true);
    act(() => renderer.root.findByProps({ "aria-label": "Remove task: First task" }).props.onClick());
    add("Third task");
    assert.equal(button("Undo removal"), undefined, "later edits must not be overwritten by an old undo");
    assert.equal(new Set(parseChecklist(values.get(CHECKLIST_KEY)!).map((item) => item.id)).size, 2);
  } finally { act(() => renderer!.unmount()); }
});

test("checklist rejects corrupt data without rewriting it on mount and remains usable when saves fail", () => {
  let writes = 0;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => "{broken",
    setItem: () => { writes++; throw new Error("Storage full"); },
  } });
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(Checklist)); });
  try {
    assert.equal(writes, 0);
    assert.match(renderer!.root.findByProps({ role: "status" }).children.join(""), /couldn't be loaded/);
    act(() => renderer.root.findByProps({ id: "checklist-new" }).props.onChange({ target: { value: "Keep in memory" } }));
    act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    assert.equal(renderer!.root.findAllByType("li").length, 1);
    assert.match(renderer!.root.findByProps({ role: "status" }).children.join(""), /couldn't be saved/);
  } finally { act(() => renderer!.unmount()); }
  const item = { id: 1, text: "A task", done: false };
  for (const items of [[item, item], [{ ...item, done: "yes" }], [{ ...item, text: " " }], Array(101).fill(item)]) {
    assert.throws(() => parseChecklist(JSON.stringify({ version: 1, items })));
  }
});
