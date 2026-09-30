# orange-app

A simple LM inspired by [`jev`](jev.ts) — a small, dependency-free
multi-task neural net trained from scratch via manual backprop (no
ML libraries, no API calls once trained).

Orange has three tabs: **Ask a question**, powered by your local AcumenAI project;
**Ticket triage**, which predicts sentiment, urgency, and escalation using the
small built-in model; and **Desk tools** for notes, a timer, and random picks.

## Ask questions with AcumenAI

1. Open a terminal in your `AcumenAI-2.0` folder and start its bridge:

   ```powershell
   .\.worker-venv\Scripts\python.exe bridge.py
   ```

   If that environment is missing, follow AcumenAI's README to install
   `requirements-local.txt` in a virtual environment, then run `python bridge.py`.

2. Keep the AcumenAI terminal open. In a second terminal in `orange-app`, run
   `npm install` (first time) and `npm run dev`.
3. Open Orange's printed URL, select **Ask a question**, paste the pairing token
   printed by AcumenAI, and click **Connect**.
4. Try `Solve 2*x + 3 = 11`, `Calculate 0.15 * 240`, or a research question.
   Click **Ask AcumenAI** (or Ctrl/Command + Enter). Answers include any sources
   AcumenAI returns and can be copied or downloaded.

The token stays in tab memory; reconnect after reloading Orange or restarting
AcumenAI. Question drafts save separately from ticket drafts on this device.
The latest 30 answers stay in memory while switching tools, until reload.
**Clear conversation view** only clears Orange's view, not AcumenAI's shared
session or learning. Include the full problem in each question: this integration
uses AcumenAI's existing single-message API rather than adding chat memory.
Review pending learning in AcumenAI's own interface before saving it.

Orange sends questions through its local Vite server to
`http://127.0.0.1:8765`; the pairing token is still required. For another local
port, create `.env.local` containing `ACUMEN_BRIDGE_URL=http://127.0.0.1:8888`
and restart Orange. Only local HTTP origins are accepted. Both `npm run dev`
and `npm run preview` provide the proxy; a static-only deployment of `dist/`
needs an equivalent `/acumen/api/` reverse proxy. Keep the app bound to localhost.

If connection fails, check that the bridge is running on the configured port.
For a rejected token, copy the current terminal token and reconnect. Failed or
timed-out requests keep the question for retry. **Stop waiting** stops Orange
waiting for the answer; AcumenAI may still finish processing it. No request is
automatically retried. AcumenAI may access external websites for research;
its supported question types and answer quality determine the results.

## Features

- Train/retrain the model on an editable, built-in dataset
- Live predictions with model confidence bars
- Training-set accuracy / MAE / Brier-score metrics
- Active learning: surfaces which unlabeled tickets the model is least sure about
- Teach it new examples on the fly and retrain instantly
- Persist trained weights to `localStorage` (`jev.toJSON` / `Jev.fromJSON`)
- Ticket triage runs client-side — no server or API keys required
- Automatically save the current message draft on this device, including across reloads
- Start a new ticket or replace a message, with one-step undo
- Search and reopen the last 20 distinct reviews from this session; clear the list at any time
- Copy a message and its assessment, with selectable text if clipboard access is unavailable
- Correct an assessment using prefilled labels and include it in the immediate retrain
- Automatically save custom training labels across reloads; edit or remove them under **Your labels**, with undo for the last removal
- Download an assessment as a plain text file
- Batch review up to 100 distinct messages, sorted by urgency, escalation, confidence, or input order
- Persistent human-review queue with completion and undo
- Export/import custom labels and notes, with a preview and a choice for matching messages
- Notes on training examples and a before/after comparison when you correct a trained model
- Confidence explanations and a visible flag below the 70% review threshold
- Desk tools: a saved scratchpad with copy, text download, and undo after clearing
- A 5 / 15 / 25-minute focus timer with pause, resume, reset, and a status in the tab bar
- Random choice picker with optional no-repeat draws and a resettable pool

## Desk tools

The **Checklist** saves up to 100 tasks on this device. Add tasks with Enter,
check them off, and clear completed items. Removing tasks has one-step undo until
your next checklist change or reload. Unsaved changes are clearly marked if
browser storage is unavailable.

Use **Find in notes** to search the scratchpad without changing its text. Search
ignores case, treats punctuation literally, and lets you step forward or backward
through matches, with a highlighted excerpt for each result.

The focus timer also accepts **Custom minutes** from 1 to 180. Select **Set timer**
to apply the duration, then start the timer. Pause a running session before changing
its length; setting a new duration resets the session.

Open **Desk tools** to use the scratchpad, checklist, focus timer, and random choice picker.
Scratchpad notes save on this device separately from question and ticket drafts.
Use **Copy notes** or **Download .txt** to take them elsewhere. **Clear notes** has
an undo until you start typing again or reload. If browser storage is blocked or
full, the scratchpad stays editable and shows an unsaved notice.

The timer offers 5, 15, and 25-minute sessions. Pause and resume at any point;
reset returns to the full selected duration, ready to start. It keeps time while switching Orange
tabs, and its status appears beside **Desk tools**. It uses the elapsed clock
time, so returning from a background tab updates the countdown. There are no
sounds or system notifications. Reloading the page resets the timer.

For random picks, enter one choice per line (up to 100 distinct choices and
10,000 characters). Blank lines and duplicates ignoring case are skipped.
**No repeats** draws each choice once; **Reset draw** restores the full pool.
Turn off **No repeats** to allow the same choice on successive draws. Editing the
list or changing this option starts a fresh draw. Choices and draws remain when
switching Orange tabs but reset when the page reloads. All Desk tools run locally.

## Local storage

Drafts use browser storage. Recent reviews are kept only in memory and disappear
when the page reloads. The editor shows when a draft cannot be saved. Custom labels
are stored separately from model weights; storage failures are shown beside the model
controls. Repeated corrections update one example rather than creating duplicates.
Removing a correction to a built-in ticket restores its original labels.

**Save** stores model weights and identifies the training dataset. When saved weights
don't match the current labels, the app retrains on startup. Older weight-only saves
also retrain once; use Save afterward to store the new format. **Reset** resets the
model weights and keeps your custom labels.

## Batch review and saved work

In **Ticket triage**, expand **Batch review** below the message editor. Paste one
ticket per line, or choose the divider format and put `---` on its own line between
multiline tickets. Each batch accepts up to 100 distinct messages and 100,000
characters. Duplicate messages are reviewed once. Select a result to open it in the
single-ticket editor. Results become unavailable when the messages or model change;
review the batch again to refresh them.

Search the batch and use **Show** to focus on tickets needing a human check,
escalation, or high urgency (7 or above). Search and the selected filter work
together. **Download shown results** exports just the visible assessments in the
current sort order, including full messages, confidence scores, and filter details.
Use **Clear filters** to return to the full batch. Downloads are unavailable for
empty filters or stale results.

Single and batch reviews add messages to **Review queue** when any confidence score
is below 70%. You can also queue a message manually or use **Find tickets** to add
uncertain sample tickets. The queue stays on this device across reloads. Opening a
ticket does not complete it: use **Mark reviewed** or save a correction. The most
recent completion can be undone during the session. Confidence is a model estimate,
not a calibrated accuracy measure; the threshold is simply a rule for human review.

Search queued messages to narrow the list. **Open next ticket** opens the first
matching item without marking it reviewed. Complete it after checking, then open
the next match. Clearing the search restores the full queue.

Add optional notes when labeling a ticket (up to 2,000 characters). Notes are saved
with the labels but are not used to train the model. **Last correction** shows the
same message before and after retraining when both predictions are available. This
comparison is a session-only snapshot, not a measurement of general accuracy.

Expand **Label backup** beside the editor to download `orange-labels.json`. It
contains your custom ticket messages, labels, and notes; it does not include model
weights, drafts, or the review queue. Choose a JSON backup under 2 MB to preview an
import. By default, existing labels and notes win when messages match. Select
**Use imported labels and notes** to replace those matches, then **Import & retrain**.
Imports merge instead of deleting unrelated labels. Invalid files make no changes.

If browser storage is unavailable or full, labels and queue changes remain in the
current tab and show an unsaved notice. Download a label backup before closing the
tab. Recent-review history, batch input/results, comparison snapshots, and undo
history last only for the current session.

## Getting started

```sh
npm install
npm run dev
```

Then open the printed local URL in your browser.

```sh
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
npm test         # draft recovery, search, saved labels and training regressions
```

`npm test` also covers scratchpad recovery and exports, timer controls and elapsed
time, random draws, AcumenAI pairing, answers, retry, cancellation, and draft
separation. To check the real AcumenAI bridge through both dev and preview proxies
using temporary test data (after building), run from Orange:

```powershell
..\AcumenAI-2.0\.worker-venv\Scripts\python.exe scripts/check-acumen.py
```

This integration check needs the sibling AcumenAI checkout, its Python dependencies,
and port 5189 free. It does not use your existing AcumenAI knowledge store.

## The model

[`jev.ts`](jev.ts) is the standalone library: a shared hidden layer
with one head per question (choice / bool / score), trained via
manual backprop. See the file header for the full API
(`predict`, `train`, `evaluate`, `pickUncertain`, `bootstrap`,
`toJSON`/`fromJSON`).
