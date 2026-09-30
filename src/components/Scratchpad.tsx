import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../hooks/useWorkspace";

export const SCRATCHPAD_KEY = "orange-app:scratchpad";

export function Scratchpad() {
  const { text, setText, draftSaved } = useWorkspace("", SCRATCHPAD_KEY);
  const [clearedNote, setClearedNote] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const copyRequest = useRef(0);
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  // Replace unpaired UTF-16 surrogates for a valid UTF-8 export; keep valid emoji intact.
  const downloadText = text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (character) => character.length === 2 ? character : "\uFFFD");

  useEffect(() => () => { copyRequest.current += 1; }, []);

  const update = (value: string) => {
    copyRequest.current += 1;
    setCopyStatus("");
    setText(value);
  };

  const copy = async () => {
    const request = ++copyRequest.current;
    try {
      await navigator.clipboard.writeText(text);
      if (request === copyRequest.current) setCopyStatus("Notes copied.");
    } catch {
      if (request !== copyRequest.current) return;
      input.current?.focus();
      input.current?.select();
      setCopyStatus("Couldn't copy automatically. Your notes are selected; press Ctrl / Command + C.");
    }
  };

  return <section className="card scratchpad" aria-labelledby="scratchpad-heading">
    <div className="section-heading">
      <h2 id="scratchpad-heading">Scratchpad</h2>
      <span>Room for a rough idea</span>
    </div>
    <label className="input-label" htmlFor="scratchpad-notes">Your notes</label>
    <div className="message-editor">
      <textarea
        id="scratchpad-notes"
        ref={input}
        className="ticket-input scratchpad__input"
        rows={16}
        maxLength={100000}
        value={text}
        onChange={(event) => { setClearedNote(null); update(event.target.value); }}
        placeholder="Ideas, a rough reply, things to remember…"
        aria-describedby="scratchpad-save-status"
      />
      <div className="editor-footer">
        <span>{words.toLocaleString()} {words === 1 ? "word" : "words"}</span>
        <span>{text.length.toLocaleString()} / 100,000 characters</span>
      </div>
    </div>
    <p className={`hint${draftSaved ? "" : " scratchpad__unsaved"}`} id="scratchpad-save-status" role="status">
      {draftSaved ? "Saved on this device." : "Notes couldn't be saved. Copy or download them before closing this tab."}
    </p>
    <div className="button-row scratchpad__actions">
      <button className="btn" disabled={!text} onClick={() => void copy()}>Copy notes</button>
      {text && <a className="btn" href={`data:text/plain;charset=utf-8,${encodeURIComponent(downloadText)}`} download="orange-notes.txt">Download .txt</a>}
      <button className="btn btn--quiet" disabled={!text} onClick={() => { setClearedNote(text); update(""); input.current?.focus(); }}>Clear notes</button>
      {clearedNote !== null && <button className="chip" onClick={() => { update(clearedNote); setClearedNote(null); input.current?.focus(); }}>Undo clear</button>}
    </div>
    <p className="hint" role="status">{copyStatus}</p>
  </section>;
}
