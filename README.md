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
- Live predictions with calibrated confidence bars
- Held-out accuracy / MAE / Brier-score metrics
- Active learning: surfaces which unlabeled tickets the model is least sure about
- Teach it new examples on the fly and retrain instantly
- Persist trained weights to `localStorage` (`jev.toJSON` / `Jev.fromJSON`)
- Everything runs client-side — no server, no API keys required

## Getting started

```sh
npm install
npm run dev
```

Then open the printed local URL in your browser.

```sh
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## The model

[`jev.ts`](jev.ts) is the standalone library: a shared hidden layer
with one head per question (choice / bool / score), trained via
manual backprop. See the file header for the full API
(`predict`, `train`, `evaluate`, `pickUncertain`, `bootstrap`,
`toJSON`/`fromJSON`).
