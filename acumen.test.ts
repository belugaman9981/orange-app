import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { askAcumen } from "./src/acumen";
import { AskQuestion } from "./src/components/AskQuestion";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const signal = () => new AbortController().signal;

test("sends the exact question to Acumen with its pairing header and preserves sources", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/acumen/api/chat");
    assert.equal(options?.method, "POST");
    assert.equal((options?.headers as Record<string, string>)["X-Acumen-Token"], "test-token");
    assert.deepEqual(JSON.parse(String(options?.body)), { message: "Solve 2*x + 3 = 11" });
    return Response.json({ reply: "x = 4\n\nSources: local://sympy" });
  };
  assert.equal(await askAcumen(" Solve 2*x + 3 = 11 ", "test-token", signal()), "x = 4\n\nSources: local://sympy");
});

test("rejects authentication, oversized questions, malformed replies and unavailable bridges", async () => {
  for (const [response, expected] of [
    [new Response("", { status: 401 }), /Pairing token not accepted/],
    [new Response("", { status: 413 }), /too long/],
    [new Response("", { status: 500 }), /couldn't complete/],
    [new Response("<html>"), /Unexpected response/],
    [Response.json({ reply: "" }), /empty or invalid/],
  ] as const) {
    globalThis.fetch = async () => response;
    await assert.rejects(askAcumen("question", "token", signal()), expected);
  }
  globalThis.fetch = async () => { throw new TypeError("network"); };
  await assert.rejects(askAcumen("question", "token", signal()), /Couldn't reach/);
});

function mount() {
  const saved = new Map<string, string>([["orange-app:draft", "Customer draft"]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  } });
  let view: ReturnType<typeof create>;
  act(() => { view = create(createElement(AskQuestion)); });
  const button = (label: string) => view.root.findAllByType("button").find((item) => item.children.includes(label))!;
  const input = () => view.root.findByProps({ id: "question-input" });
  const token = () => view.root.findByProps({ id: "acumen-token" });
  const connect = async () => {
    act(() => token().props.onChange({ target: { value: "test-token" } }));
    await act(async () => button("Connect").props.onClick());
  };
  return { get view() { return view; }, saved, button, input, token, connect };
}

test("pair, ask, copyable answer, independent draft and retry after failed request", async () => {
  const seen: string[] = [];
  let fail = false;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("session")) return Response.json({ candidates: [] });
    seen.push(JSON.parse(String(options?.body)).message);
    return fail ? new Response("", { status: 500 }) : Response.json({ reply: "x = 4" });
  };
  const app = mount();
  assert.equal(app.button("Ask AcumenAI").props.disabled, true);
  await app.connect();
  act(() => app.input().props.onChange({ target: { value: "Solve 2*x + 3 = 11" } }));
  await act(async () => app.button("Ask AcumenAI").props.onClick());
  assert.deepEqual(seen, ["Solve 2*x + 3 = 11"]);
  assert.equal(app.input().props.value, "");
  assert.equal(app.view.root.findByProps({ className: "answer-text" }).children[0], "x = 4");
  assert.equal(app.saved.get("orange-app:draft"), "Customer draft");
  assert.equal([...app.saved.values()].includes("test-token"), false);
  fail = true;
  act(() => app.input().props.onChange({ target: { value: "Calculate 6*7" } }));
  await act(async () => app.button("Ask AcumenAI").props.onClick());
  assert.equal(app.input().props.value, "Calculate 6*7");
  assert.equal(app.view.root.findAllByProps({ role: "alert" }).length, 1);
  fail = false;
  await act(async () => app.button("Ask AcumenAI").props.onClick());
  assert.equal(app.view.root.findAllByProps({ className: "answer-text" }).length, 2);
  act(() => app.token().props.onChange({ target: { value: "replacement-token" } }));
  assert.equal(app.button("Ask AcumenAI").props.disabled, true);
  act(() => app.view.unmount());
});

test("stop waiting aborts the request and keeps the unsent draft available", async () => {
  let started = false;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("session")) return Response.json({ candidates: [] });
    started = true;
    return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
  };
  const app = mount();
  await app.connect();
  act(() => app.input().props.onChange({ target: { value: "Calculate 6*7" } }));
  act(() => app.button("Ask AcumenAI").props.onClick());
  assert.equal(started, true);
  assert.equal(app.input().props.disabled, true);
  await act(async () => app.button("Stop waiting").props.onClick());
  assert.equal(app.input().props.value, "Calculate 6*7");
  assert.equal(app.input().props.disabled, false);
  assert.equal(app.view.root.findAllByProps({ className: "answer-text" }).length, 0);
  act(() => app.view.unmount());
});
