import { useRef, useState } from "react";
import type { TicketExample } from "../data/tickets";
import { exportExamples, parseSavedExamples } from "../data/savedExamples";

interface Props { examples: TicketExample[]; disabled: boolean; onImport: (examples: TicketExample[], replace: boolean) => Promise<void> }

export function LabelBackup({ examples, disabled, onImport }: Props) {
  const [incoming, setIncoming] = useState<TicketExample[] | null>(null);
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRequest = useRef(0);
  const existing = new Set(examples.map((example) => example.state));
  const conflicts = incoming?.filter((example) => existing.has(example.state)).length ?? 0;

  async function readFile(file?: File) {
    const request = ++fileRequest.current;
    setIncoming(null);
    setStatus("");
    setReplace(false);
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Choose a backup smaller than 2 MB.");
      const parsed = parseSavedExamples(await file.text());
      if (!parsed.length) throw new Error("This backup has no saved labels.");
      if (request === fileRequest.current) setIncoming(parsed);
    } catch (error) {
      if (request === fileRequest.current) setStatus(error instanceof Error ? error.message : "Couldn't read this backup.");
    } finally { if (request === fileRequest.current) setBusy(false); }
  }

  async function apply() {
    if (!incoming || busy || disabled) return;
    setBusy(true);
    try {
      await onImport(incoming, replace);
      setIncoming(null);
      setStatus("Labels imported and model retrained. Check the model's save status for storage availability.");
    } catch { setStatus("Couldn't finish importing and retraining. Check the model status, then try again."); }
    finally { setBusy(false); }
  }

  return <details className="label-backup workflow-section">
    <summary>Label backup</summary>
    <p className="muted">Back up your custom messages, labels, and notes. Import merges them with your current labels.</p>
    {examples.length > 0 ? <a className="btn" href={`data:application/json;charset=utf-8,${encodeURIComponent(exportExamples(examples))}`} download="orange-labels.json">Download backup</a> : <p className="hint">Add a label to create a backup.</p>}
    <label className="input-label" htmlFor="label-backup-file">Choose a backup to import</label>
    <input id="label-backup-file" type="file" accept=".json,application/json" disabled={disabled || busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void readFile(file); }} />
    {incoming && <div className="import-preview">
      <p className="hint">{incoming.length} {incoming.length === 1 ? "label" : "labels"} found · {incoming.length - conflicts} new · {conflicts} already present</p>
      {conflicts > 0 && <label className="input-label">For matching messages<select value={replace ? "replace" : "keep"} disabled={busy || disabled} onChange={(event) => setReplace(event.target.value === "replace")}><option value="keep">Keep my current labels and notes</option><option value="replace">Use imported labels and notes</option></select></label>}
      <div className="button-row"><button className="btn" disabled={disabled || busy} onClick={apply}>{busy ? "Importing…" : "Import & retrain"}</button><button className="btn btn--quiet" disabled={busy} onClick={() => { setIncoming(null); setStatus(""); }}>Cancel</button></div>
    </div>}
    {status && <p className="hint" role="status">{status}</p>}
  </details>;
}
