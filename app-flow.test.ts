import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { createServer } from "vite";

test("ticket workflow connects review, queue, notes, comparison and backup while preserving the question draft", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: {}, style: {} }, querySelector: () => null } });
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  let renderer: ReturnType<typeof create> | undefined;
  try {
    const { default: App } = await server.ssrLoadModule("/src/App.tsx");
    await act(async () => {
      renderer = create(createElement(App));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const root = renderer!.root;
    const button = (label: string) => root.findAllByType("button").find((item) => item.children.some((child) => typeof child === "string" && child.trim() === label))!;
    const input = (id: string) => root.findByProps({ id });
    act(() => input("question-input").props.onChange({ target: { value: "Keep my separate question" } }));
    act(() => button("Ticket triage").props.onClick());
    assert.equal(button("Review ticket").props.disabled, false);
    const message = "My account is locked and I need access today.";
    act(() => input("ticket-message").props.onChange({ target: { value: message } }));
    act(() => button("Review ticket").props.onClick());
    const addQueue = button("Add to review queue");
    if (addQueue) act(() => addQueue.props.onClick());
    assert.ok(JSON.parse(values.get("orange-app:review-queue")!).messages.includes(message));
    act(() => button("Correct assessment").props.onClick());
    act(() => input("label-note").props.onChange({ target: { value: "Access blocked before a customer meeting." } }));
    await act(async () => { await button("Add example & retrain").props.onClick(); });
    assert.equal(root.findByProps({ id: "comparison-heading" }).children[0], "Last correction");
    assert.equal(JSON.parse(values.get("orange-app:examples")!).examples[0].note, "Access blocked before a customer meeting.");
    assert.equal(JSON.parse(values.get("orange-app:review-queue")!).messages.includes(message), false);
    const backup = root.findAllByType("a").find((link) => link.props.download === "orange-labels.json")!;
    assert.equal(JSON.parse(decodeURIComponent(backup.props.href.split(",")[1])).examples[0].state, message);
    act(() => input("batch-messages").props.onChange({ target: { value: "Where is my refund?\nThank you for fixing it!" } }));
    act(() => button("Review batch").props.onClick());
    assert.equal(root.findAllByProps({ className: "batch-message" }).length, 2);
    const firstResult = root.findAllByProps({ className: "batch-message" })[0];
    const resultMessage = firstResult.children[0];
    act(() => firstResult.props.onClick());
    assert.equal(input("ticket-message").props.value, resultMessage);
    assert.equal(root.findAllByProps({ id: "comparison-heading" }).length, 0);
    act(() => button("Ask a question").props.onClick());
    assert.equal(input("question-input").props.value, "Keep my separate question");
  } finally {
    if (renderer) act(() => renderer!.unmount());
    await server.close();
  }
});
