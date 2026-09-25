# orange-app

A simple LM inspired by [`jev`](jev.ts) — a small, dependency-free
multi-task neural net trained from scratch via manual backprop (no
ML libraries, no API calls once trained).

This repo includes a polished browser demo: a support-ticket triage
app. Type a ticket, and the model predicts **sentiment**, **urgency**,
and whether it **needs escalation**, each with a learned confidence
score.

## Features

- Train/retrain the model on an editable, built-in dataset
- Live predictions with model confidence bars
- Training-set accuracy / MAE / Brier-score metrics
- Active learning: surfaces which unlabeled tickets the model is least sure about
- Teach it new examples on the fly and retrain instantly
- Persist trained weights to `localStorage` (`jev.toJSON` / `Jev.fromJSON`)
- Everything runs client-side — no server, no API keys required
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

## The model

[`jev.ts`](jev.ts) is the standalone library: a shared hidden layer
with one head per question (choice / bool / score), trained via
manual backprop. See the file header for the full API
(`predict`, `train`, `evaluate`, `pickUncertain`, `bootstrap`,
`toJSON`/`fromJSON`).
