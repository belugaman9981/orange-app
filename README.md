# Orange

Orange is a polished, minimal TypeScript starter app for a local language-model-inspired playground. It runs entirely in the browser, accepts a prompt, and returns a clearly labeled deterministic demo response.

> **Important:** Orange does **not** ship a real trained LLM and does **not** require API keys. The response engine is a local demo built from deterministic prompt rules.

## Prerequisites

- Node.js 22+ (Node.js 20+ should also work with current Vite releases)
- npm 10+

## Install and run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.

## Build and checks

```bash
npm run build
npm run lint
npm run typecheck
```

## Project structure

```text
.
├── src/
│   ├── App.tsx              # Orange UI and prompt handling
│   ├── index.css            # Responsive app styling
│   ├── main.tsx             # React entry point
│   └── lib/
│       └── orangeDemo.ts    # Local deterministic response engine
├── index.html               # Vite HTML entry
├── jev.ts                   # Original exploratory model implementation kept for inspiration
├── package.json             # Scripts and dependencies
└── tsconfig*.json           # TypeScript project configuration
```

## Available scripts

- `npm run dev` — start the local development server
- `npm run build` — type-check and create a production bundle in `dist/`
- `npm run lint` — run the baseline linter
- `npm run typecheck` — run TypeScript project checks without emitting files
- `npm run preview` — preview the production build locally

## Notes

- The playground is keyboard-friendly: press `Enter` to submit and `Shift+Enter` for a new line.
- Loading, empty, and validation error states are part of the demo UI.
- The generated response is intentionally deterministic so the app is useful as a starter without depending on outside services.
