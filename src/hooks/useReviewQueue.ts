import { useRef, useState } from "react";

export const QUEUE_KEY = "orange-app:review-queue";

export function useReviewQueue() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return { messages: [] as string[], notice: "" };
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.messages) || data.messages.some((message: unknown) => typeof message !== "string" || !message.trim())) throw new Error("Invalid queue");
      return { messages: [...new Set<string>(data.messages.map((message: string) => message.trim()))], notice: "" };
    } catch { return { messages: [] as string[], notice: "The saved queue couldn't be loaded." }; }
  });
  const current = useRef(state.messages);
  const [lastRemoved, setLastRemoved] = useState<string | null>(null);

  function commit(messages: string[]) {
    let notice = "Queue saved on this device.";
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify({ version: 1, messages })); }
    catch { notice = "Queue changes couldn't be saved. Keep this tab open."; }
    current.current = messages;
    setState({ messages, notice });
  }
  function add(messages: string[]) {
    const next = [...new Set([...current.current, ...messages.map((message) => message.trim()).filter(Boolean)])];
    if (next.length !== current.current.length) commit(next);
  }
  function complete(message: string) {
    const normalized = message.trim();
    if (!current.current.includes(normalized)) return;
    setLastRemoved(normalized);
    commit(current.current.filter((item) => item !== normalized));
  }
  function undo() {
    if (lastRemoved) add([lastRemoved]);
    setLastRemoved(null);
  }
  return { ...state, add, complete, undo, canUndo: lastRemoved !== null };
}
