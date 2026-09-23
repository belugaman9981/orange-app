
/**
 * jev.ts — a small, self-contained "System One" model.
 *
 * Unlike a thin LLM wrapper, this is an actual learning model: a
 * multi-task neural net (shared hidden layer, one head per question)
 * trained from scratch via manual backprop. No ML dependencies.
 *
 * It answers typed questions about arbitrary state — choice, bool,
 * or score — and every answer carries a *learned* confidence: choice
 * and bool heads report their softmax/sigmoid probability; the score
 * head is heteroscedastic (it predicts its own variance), so
 * confidence reflects how uncertain the model actually is, not a
 * fixed heuristic.
 *
 * Included:
 *  - predict / predictBatch      — typed, calibrated inference
 *  - trainStep / trainBatch / train — SGD, mini-batch SGD (with L2), multi-epoch loop
 *  - evaluate                    — accuracy / MAE / Brier score on held-out data
 *  - pickUncertain                — active-learning: which states most need a label next
 *  - bootstrap                    — one-time LLM distillation into local weights
 *  - toJSON / fromJSON            — persistence
 *  - selfTest                     — trains on a synthetic task and asserts it actually learns
 */

// ---------- Question / decision types ----------

type ChoiceSpec = { type: "choice"; options: readonly string[] };
type ScoreSpec = { type: "score"; min: number; max: number };
type BoolSpec = { type: "bool" };
export type QuestionSpec = ChoiceSpec | ScoreSpec | BoolSpec;
export type Questions = Record<string, QuestionSpec>;

type ValueFor<S extends QuestionSpec> = S extends ChoiceSpec
  ? S["options"][number]
  : S extends ScoreSpec
  ? number
  : boolean;

export type Labels<Q extends Questions> = { [K in keyof Q]: ValueFor<Q[K]> };
export type Decision<Q extends Questions> = {
  [K in keyof Q]: { value: ValueFor<Q[K]>; confidence: number };
};

// ---------- Math helpers ----------

const relu = (x: number) => (x > 0 ? x : 0);
const reluGrad = (x: number) => (x > 0 ? 1 : 0);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function zeros1d(n: number): number[] {
  return new Array(n).fill(0);
}

function zeros2d(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => zeros1d(cols));
}

function randInit2d(rows: number, cols: number, scale: number): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
  );
}

// ---------- Feature hashing (turns arbitrary state into a fixed vector) ----------

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

function featurize(state: unknown, dim: number): number[] {
  const text = typeof state === "string" ? state : JSON.stringify(state ?? {});
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const x = zeros1d(dim);
  for (const tok of tokens) x[hash(tok) % dim] += 1;
  for (let i = 0; i < dim; i++) x[i] = Math.log1p(x[i]); // dampen frequent tokens
  return x;
}

// ---------- Per-question head ----------

type HeadKind = "choice" | "bool" | "score";

interface Head {
  kind: HeadKind;
  outDim: number; // choice: |options|, bool: 1, score: 2 (mu_raw, logvar_raw)
  W: number[][]; // hidden -> outDim
  b: number[];
}

function makeHead(spec: QuestionSpec, hidden: number): Head {
  if (spec.type === "choice") {
    return { kind: "choice", outDim: spec.options.length, W: randInit2d(hidden, spec.options.length, 0.1), b: zeros1d(spec.options.length) };
  }
  if (spec.type === "bool") {
    return { kind: "bool", outDim: 1, W: randInit2d(hidden, 1, 0.1), b: [0] };
  }
  return { kind: "score", outDim: 2, W: randInit2d(hidden, 2, 0.1), b: [0, 0] };
}

interface Grad {
  W1: number[][];
  b1: number[];
  heads: Record<string, { W: number[][]; b: number[] }>;
}

// ---------- The model ----------

export interface JevOptions {
  featureDim?: number; // hashing width, default 256
  hidden?: number; // hidden layer size, default 32
  lr?: number; // learning rate, default 0.05
  l2?: number; // weight decay, default 1e-4
}

export class Jev<Q extends Questions> {
  private questions: Q;
  private dim: number;
  private hidden: number;
  private lr: number;
  private l2: number;
  private W1: number[][]; // dim -> hidden
  private b1: number[];
  private heads: Record<string, Head>;

  constructor(questions: Q, opts: JevOptions = {}) {
    this.questions = questions;
    this.dim = opts.featureDim ?? 256;
    this.hidden = opts.hidden ?? 32;
    this.lr = opts.lr ?? 0.05;
    this.l2 = opts.l2 ?? 1e-4;
    this.W1 = randInit2d(this.dim, this.hidden, 0.1);
    this.b1 = zeros1d(this.hidden);
    this.heads = {};
    for (const [key, spec] of Object.entries(questions)) this.heads[key] = makeHead(spec, this.hidden);
  }

  private forwardHidden(x: number[]): { z1: number[]; a1: number[] } {
    const z1 = zeros1d(this.hidden);
    for (let j = 0; j < this.hidden; j++) {
      let s = this.b1[j];
      for (let i = 0; i < this.dim; i++) s += x[i] * this.W1[i][j];
      z1[j] = s;
    }
    return { z1, a1: z1.map(relu) };
  }

  private headForward(head: Head, a1: number[]): number[] {
    const out = zeros1d(head.outDim);
    for (let k = 0; k < head.outDim; k++) {
      let s = head.b[k];
      for (let j = 0; j < this.hidden; j++) s += a1[j] * head.W[j][k];
      out[k] = s;
    }
    return out;
  }

  /** One forward pass: typed values + learned confidence. No API calls. */
  predict(state: unknown): Decision<Q> {
    const x = featurize(state, this.dim);
    const { a1 } = this.forwardHidden(x);
    const out = {} as Decision<Q>;

    for (const [key, spec] of Object.entries(this.questions)) {
      const raw = this.headForward(this.heads[key], a1);

      if (spec.type === "choice") {
        const probs = softmax(raw);
        let best = 0;
        for (let k = 1; k < probs.length; k++) if (probs[k] > probs[best]) best = k;
        (out as any)[key] = { value: spec.options[best], confidence: probs[best] };
      } else if (spec.type === "bool") {
        const p = sigmoid(raw[0]);
        (out as any)[key] = { value: p >= 0.5, confidence: Math.max(p, 1 - p) };
      } else {
        const [muRaw, logVarRaw] = raw;
        const mu = spec.min + (spec.max - spec.min) * sigmoid(muRaw);
        const variance = Math.exp(Math.max(-8, Math.min(8, logVarRaw)));
        (out as any)[key] = { value: mu, confidence: 1 / (1 + variance) }; // lower variance -> higher confidence
      }
    }
    return out;
  }

  /** predict() over many states at once. */
  predictBatch(states: unknown[]): Decision<Q>[] {
    return states.map((s) => this.predict(s));
  }

  private zeroGrad(): Grad {
    const heads: Grad["heads"] = {};
    for (const [key, head] of Object.entries(this.heads)) {
      heads[key] = { W: zeros2d(this.hidden, head.outDim), b: zeros1d(head.outDim) };
    }
    return { W1: zeros2d(this.dim, this.hidden), b1: zeros1d(this.hidden), heads };
  }

  /** Forward + backward for one example, accumulated into a Grad (weights untouched). */
  private computeGradients(state: unknown, labels: Labels<Q>): { loss: number; grad: Grad } {
    const x = featurize(state, this.dim);
    const { z1, a1 } = this.forwardHidden(x);
    const grad = this.zeroGrad();
    let totalLoss = 0;
    const dA1 = zeros1d(this.hidden);

    for (const [key, spec] of Object.entries(this.questions)) {
      const head = this.heads[key];
      const raw = this.headForward(head, a1);
      const dOut = zeros1d(head.outDim);
      const label = (labels as any)[key];

      if (spec.type === "choice") {
        const probs = softmax(raw);
        const target = spec.options.indexOf(label);
        totalLoss += -Math.log(Math.max(probs[target] ?? 1e-9, 1e-9));
        for (let k = 0; k < probs.length; k++) dOut[k] = probs[k] - (k === target ? 1 : 0);
      } else if (spec.type === "bool") {
        const p = sigmoid(raw[0]);
        const y = label ? 1 : 0;
        totalLoss += -(y * Math.log(Math.max(p, 1e-9)) + (1 - y) * Math.log(Math.max(1 - p, 1e-9)));
        dOut[0] = p - y;
      } else {
        const [muRaw, logVarRaw] = raw;
        const clippedLogVar = Math.max(-8, Math.min(8, logVarRaw));
        const s = sigmoid(muRaw);
        const mu = spec.min + (spec.max - spec.min) * s;
        const variance = Math.exp(clippedLogVar);
        const y = label as number;
        totalLoss += 0.5 * clippedLogVar + (0.5 * (y - mu) ** 2) / variance;

        const dMu = -(y - mu) / variance;
        dOut[0] = dMu * (spec.max - spec.min) * s * (1 - s); // chain through sigmoid + rescale
        dOut[1] = 0.5 - (0.5 * (y - mu) ** 2) / variance; // dL/d(logvar_raw)
      }

      for (let j = 0; j < this.hidden; j++) {
        let g = 0;
        for (let k = 0; k < head.outDim; k++) g += head.W[j][k] * dOut[k];
        dA1[j] += g;
      }
      for (let k = 0; k < head.outDim; k++) {
        for (let j = 0; j < this.hidden; j++) grad.heads[key].W[j][k] += dOut[k] * a1[j];
        grad.heads[key].b[k] += dOut[k];
      }
    }

    const dZ1 = dA1.map((g, j) => g * reluGrad(z1[j]));
    for (let j = 0; j < this.hidden; j++) {
      for (let i = 0; i < this.dim; i++) grad.W1[i][j] += dZ1[j] * x[i];
      grad.b1[j] += dZ1[j];
    }

    return { loss: totalLoss, grad };
  }

  /** Applies an accumulated gradient (averaged over `count` examples), with L2 decay on weights. */
  private applyGradients(grad: Grad, count: number): void {
    const lr = this.lr;
    for (let i = 0; i < this.dim; i++) {
      for (let j = 0; j < this.hidden; j++) {
        this.W1[i][j] -= lr * (grad.W1[i][j] / count + this.l2 * this.W1[i][j]);
      }
    }
    for (let j = 0; j < this.hidden; j++) this.b1[j] -= lr * (grad.b1[j] / count);

    for (const [key, head] of Object.entries(this.heads)) {
      const g = grad.heads[key];
      for (let k = 0; k < head.outDim; k++) {
        for (let j = 0; j < this.hidden; j++) head.W[j][k] -= lr * (g.W[j][k] / count + this.l2 * head.W[j][k]);
        head.b[k] -= lr * (g.b[k] / count);
      }
    }
  }

  /** One SGD step on a single labeled example. Returns the scalar loss. */
  trainStep(state: unknown, labels: Labels<Q>): number {
    const { loss, grad } = this.computeGradients(state, labels);
    this.applyGradients(grad, 1);
    return loss;
  }

  /** One mini-batch SGD step: gradients from every example are averaged before the update is applied. */
  trainBatch(examples: { state: unknown; labels: Labels<Q> }[]): number {
    const total = this.zeroGrad();
    let sumLoss = 0;

    for (const { state, labels } of examples) {
      const { loss, grad } = this.computeGradients(state, labels);
      sumLoss += loss;
      for (let i = 0; i < this.dim; i++) for (let j = 0; j < this.hidden; j++) total.W1[i][j] += grad.W1[i][j];
      for (let j = 0; j < this.hidden; j++) total.b1[j] += grad.b1[j];
      for (const key of Object.keys(this.heads)) {
        const outDim = this.heads[key].outDim;
        for (let k = 0; k < outDim; k++) {
          for (let j = 0; j < this.hidden; j++) total.heads[key].W[j][k] += grad.heads[key].W[j][k];
          total.heads[key].b[k] += grad.heads[key].b[k];
        }
      }
    }

    this.applyGradients(total, Math.max(1, examples.length));
    return sumLoss / Math.max(1, examples.length);
  }

  /** Train over a labeled dataset for several epochs, in mini-batches. Returns avg loss per epoch. */
  train(examples: { state: unknown; labels: Labels<Q> }[], opts: { epochs?: number; batchSize?: number } = {}): number[] {
    const epochs = opts.epochs ?? 50;
    const batchSize = Math.max(1, opts.batchSize ?? 1);
    const history: number[] = [];

    for (let e = 0; e < epochs; e++) {
      const shuffled = [...examples].sort(() => Math.random() - 0.5);
      let sum = 0;
      let batches = 0;
      for (let i = 0; i < shuffled.length; i += batchSize) {
        sum += this.trainBatch(shuffled.slice(i, i + batchSize));
        batches++;
      }
      history.push(sum / Math.max(1, batches));
    }
    return history;
  }

  /**
   * Accuracy / MAE / Brier score on held-out labeled data. Brier score
   * (lower is better) checks calibration: it penalizes a confident
   * answer that turns out wrong more than an unsure one.
   */
  evaluate(examples: { state: unknown; labels: Labels<Q> }[]): {
    avgLoss: number;
    perQuestion: Record<string, { accuracy?: number; mae?: number; brier?: number }>;
  } {
    const perQuestion: Record<string, { accuracy?: number; mae?: number; brier?: number }> = {};
    const correct: Record<string, number> = {};
    const absErr: Record<string, number> = {};
    const brier: Record<string, number> = {};
    let totalLoss = 0;

    for (const { state, labels } of examples) {
      totalLoss += this.computeGradients(state, labels).loss;
      const pred = this.predict(state);

      for (const [key, spec] of Object.entries(this.questions)) {
        const p: any = (pred as any)[key];
        const y = (labels as any)[key];
        if (spec.type === "score") {
          absErr[key] = (absErr[key] ?? 0) + Math.abs(p.value - y);
        } else {
          const isCorrect = spec.type === "bool" ? p.value === !!y : p.value === y;
          correct[key] = (correct[key] ?? 0) + (isCorrect ? 1 : 0);
          const probOfTrueOutcome = isCorrect ? p.confidence : 1 - p.confidence;
          brier[key] = (brier[key] ?? 0) + (1 - probOfTrueOutcome) ** 2;
        }
      }
    }

    const n = Math.max(1, examples.length);
    for (const [key, spec] of Object.entries(this.questions)) {
      perQuestion[key] =
        spec.type === "score"
          ? { mae: (absErr[key] ?? 0) / n }
          : { accuracy: (correct[key] ?? 0) / n, brier: (brier[key] ?? 0) / n };
    }

    return { avgLoss: totalLoss / n, perQuestion };
  }

  /**
   * Active learning: ranks unlabeled states by the model's own
   * lowest per-state confidence (weakest-link across questions), so
   * you spend labeling budget on what the model is least sure about
   * instead of on random or already-easy examples.
   */
  pickUncertain(states: unknown[], k = 10): { state: unknown; minConfidence: number }[] {
    const scored = states.map((state) => {
      const pred = this.predict(state);
      const minConfidence = Math.min(...Object.values(pred).map((d: any) => d.confidence));
      return { state, minConfidence };
    });
    scored.sort((a, b) => a.minConfidence - b.minConfidence);
    return scored.slice(0, k);
  }

  /**
   * Bootstrap a training set by distilling labels from an LLM once,
   * then train the local net on them. After this, `predict` needs no
   * API calls. Requires @anthropic-ai/sdk to be installed.
   */
  async bootstrap(states: unknown[], epochs = 50, model = "claude-sonnet-4-6") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const properties: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(this.questions)) {
      properties[key] =
        spec.type === "choice"
          ? { type: "string", enum: [...spec.options] }
          : spec.type === "score"
          ? { type: "number", minimum: spec.min, maximum: spec.max }
          : { type: "boolean" };
    }
    const tool = {
      name: "answer",
      description: "Answer every question about the given state.",
      input_schema: { type: "object", properties, required: Object.keys(this.questions), additionalProperties: false },
    } as const;

    const examples: { state: unknown; labels: Labels<Q> }[] = [];
    for (const state of states) {
      const res = await client.messages.create({
        model,
        max_tokens: 256,
        tools: [tool],
        tool_choice: { type: "tool", name: "answer" },
        messages: [{ role: "user", content: `State:\n${JSON.stringify(state)}` }],
      });
      const call = res.content.find((b) => b.type === "tool_use");
      if (call && call.type === "tool_use") examples.push({ state, labels: call.input as Labels<Q> });
    }

    const history = this.train(examples, { epochs, batchSize: 8 });
    return { examples, history };
  }

  toJSON(): string {
    return JSON.stringify({ dim: this.dim, hidden: this.hidden, lr: this.lr, l2: this.l2, questions: this.questions, W1: this.W1, b1: this.b1, heads: this.heads });
  }

  static fromJSON<Q extends Questions>(json: string): Jev<Q> {
    const data = JSON.parse(json);
    const model = new Jev<Q>(data.questions, { featureDim: data.dim, hidden: data.hidden, lr: data.lr, l2: data.l2 });
    (model as any).W1 = data.W1;
    (model as any).b1 = data.b1;
    (model as any).heads = data.heads;
    return model;
  }
}

/**
 * Trains on a tiny synthetic task (parity / magnitude / value of a
 * number) and asserts the model actually learns it, and that every
 * prediction stays within its declared type and range. Throws on
 * failure. Call this in CI or after changing the training math.
 */
export function selfTest(): void {
  const jev = new Jev(
    {
      parity: { type: "choice", options: ["even", "odd"] as const },
      big: { type: "bool" },
      value: { type: "score", min: 0, max: 20 },
    },
    { hidden: 16, lr: 0.1 }
  );

  const examples = Array.from({ length: 200 }, () => {
    const n = Math.floor(Math.random() * 20);
    return {
      state: `number ${n}`,
      labels: { parity: (n % 2 === 0 ? "even" : "odd") as "even" | "odd", big: n >= 10, value: n },
    };
  });

  jev.train(examples, { epochs: 80, batchSize: 8 });
  const { avgLoss, perQuestion } = jev.evaluate(examples);

  if ((perQuestion.parity?.accuracy ?? 0) < 0.8) throw new Error("selfTest: parity accuracy too low — model isn't learning");
  if ((perQuestion.big?.accuracy ?? 0) < 0.8) throw new Error("selfTest: big accuracy too low — model isn't learning");
  if ((perQuestion.value?.mae ?? 99) > 4) throw new Error("selfTest: value MAE too high — model isn't learning");

  for (const { state } of examples.slice(0, 20)) {
    const d = jev.predict(state);
    if (!["even", "odd"].includes(d.parity.value)) throw new Error("selfTest: invalid parity value");
    if (typeof d.big.value !== "boolean") throw new Error("selfTest: invalid bool value");
    if (d.value.value < 0 || d.value.value > 20) throw new Error("selfTest: score out of declared range");
  }

  console.log("jev selfTest passed:", { avgLoss, perQuestion });
}

/* --- Example ---

const jev = new Jev(
  {
    sentiment: { type: "choice", options: ["angry", "neutral", "happy"] },
    urgency: { type: "score", min: 0, max: 10 },
    needsEscalation: { type: "bool" },
  },
  { hidden: 24 }
);

// Train directly if you already have labels (mini-batches of 8, 100 epochs):
jev.train(
  [
    { state: "Still no refund after 2 weeks, this is ridiculous.",
      labels: { sentiment: "angry", urgency: 9, needsEscalation: true } },
    { state: "Thanks, that answers my question!",
      labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  ],
  { epochs: 100, batchSize: 8 }
);

// ...or bootstrap a dataset from an LLM once, then run locally forever after:
// const { history } = await jev.bootstrap(rawTickets);

// Check quality on a held-out set:
// const report = jev.evaluate(heldOutExamples);

// Find which unlabeled states are worth labeling next:
// const toLabel = jev.pickUncertain(unlabeledTickets, 20);

const result = jev.predict("Where is my order, it's been a month!");
const many = jev.predictBatch(["ticket A text", "ticket B text"]);

const saved = jev.toJSON();           // persist weights
const reloaded = Jev.fromJSON(saved); // restore later, no retraining needed

// selfTest(); // sanity-check the training math on a synthetic task
*/
