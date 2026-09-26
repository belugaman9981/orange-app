# orange-app

A simple LM inspired by [`jev`](jev.ts) — a small, dependency-free
multi-task neural net trained from scratch via manual backprop (no
ML libraries, no API calls once trained).

Orange has two tools: **Ask a question**, powered by your local AcumenAI project,
and **Ticket triage**, which predicts sentiment, urgency, and escalation using
the small built-in model.

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

Drafts use browser storage. Recent reviews are kept only in memory and disappear
when the page reloads. The editor shows when a draft cannot be saved. Custom labels
are stored separately from model weights; storage failures are shown beside the model
controls. Repeated corrections update one example rather than creating duplicates.
Removing a correction to a built-in ticket restores its original labels.

**Save** stores model weights and identifies the training dataset. When saved weights
don't match the current labels, the app retrains on startup. Older weight-only saves
also retrain once; use Save afterward to store the new format. **Reset** resets the
model weights and keeps your custom labels.

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

`npm test` also covers AcumenAI pairing, answers, retry, cancellation, and draft
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
