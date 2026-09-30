import { useRef, useState } from "react";

export const CHECKLIST_KEY = "orange-app:checklist";
type Task = { id: number; text: string; done: boolean };

export function parseChecklist(raw: string | null): Task[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !Array.isArray(data.items) || data.items.length > 100) throw new Error("Invalid checklist");
  const ids = new Set<number>();
  return data.items.map((item: Task) => {
    if (!item || !Number.isSafeInteger(item.id) || item.id < 1 || ids.has(item.id) || typeof item.text !== "string" || !item.text.trim() || item.text.length > 240 || typeof item.done !== "boolean") throw new Error("Invalid task");
    ids.add(item.id);
    return { id: item.id, text: item.text, done: item.done };
  });
}

export function Checklist() {
  const [state, setState] = useState(() => {
    try { return { items: parseChecklist(localStorage.getItem(CHECKLIST_KEY)), notice: "Saved on this device." }; }
    catch { return { items: [] as Task[], notice: "Saved tasks couldn't be loaded. New tasks will start a fresh list." }; }
  });
  const [draft, setDraft] = useState("");
  const [undo, setUndo] = useState<Task[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const completed = state.items.filter((item) => item.done).length;

  function commit(items: Task[], undoItems: Task[] | null = null) {
    let notice = "Saved on this device.";
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify({ version: 1, items })); }
    catch { notice = "Tasks couldn't be saved. Keep this tab open."; }
    setState({ items, notice });
    setUndo(undoItems);
  }

  return <section className="card checklist" aria-labelledby="checklist-heading">
    <div className="section-heading"><h2 id="checklist-heading">Checklist</h2><span>{completed} / {state.items.length} done</span></div>
    <form className="checklist-add" onSubmit={(event) => {
      event.preventDefault();
      if (!draft.trim() || draft.length > 240 || state.items.length >= 100) return;
      let id = 1;
      while (state.items.some((item) => item.id === id)) id++;
      commit([...state.items, { id, text: draft.trim(), done: false }]);
      setDraft("");
      input.current?.focus();
    }}>
      <label className="input-label" htmlFor="checklist-new">Add a task</label>
      <div className="checklist-entry"><input id="checklist-new" ref={input} value={draft} maxLength={240} onChange={(event) => setDraft(event.target.value)} placeholder="One small thing to do" /><button className="btn" type="submit" disabled={!draft.trim() || state.items.length >= 100}>Add task</button></div>
    </form>
    {state.items.length === 100 && <p className="hint">Your list is full. Remove a task to add another.</p>}
    {!state.items.length && <p className="muted">Nothing on the list yet.</p>}
    <ul className="checklist-items">{state.items.map((item) => <li key={item.id}>
      <label className={item.done ? "checklist-done" : ""}><input type="checkbox" checked={item.done} onChange={() => commit(state.items.map((task) => task.id === item.id ? { ...task, done: !task.done } : task))} /><span>{item.text}</span></label>
      <button className="chip" aria-label={`Remove task: ${item.text}`} onClick={() => commit(state.items.filter((task) => task.id !== item.id), state.items)}>Remove</button>
    </li>)}</ul>
    <div className="button-row"><button className="chip" disabled={!completed} onClick={() => commit(state.items.filter((item) => !item.done), state.items)}>Clear completed</button>{undo && <button className="chip" onClick={() => commit(undo)}>Undo removal</button>}</div>
    <p className="hint" role="status">{state.notice}</p>
  </section>;
}
