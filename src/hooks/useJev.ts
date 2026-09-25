import { useCallback, useMemo, useRef, useState } from "react";
import { Jev, type Decision } from "../../jev";
import { questions, type TicketExample, type TicketLabels } from "../data/tickets";
import { EXAMPLES_KEY, mergeExamples, parseSavedExamples } from "../data/savedExamples";

const STORAGE_KEY = "orange-app:model";

export type TicketDecision = Decision<typeof questions>;

export interface EvalReport {
  avgLoss: number;
  perQuestion: Record<string, { accuracy?: number; mae?: number; brier?: number }>;
}

/** Wraps a Jev model instance in React state: training, persistence, prediction. */
export function useJev() {
  const jevRef = useRef<Jev<typeof questions> | null>(null);
  const [saved, setSaved] = useState(() => {
    try {
      const raw = localStorage.getItem(EXAMPLES_KEY);
      return { items: raw ? parseSavedExamples(raw) : [], notice: "" };
    } catch { return { items: [] as TicketExample[], notice: "Saved labels couldn't be loaded. The built-in examples are available." }; }
  });
  const savedRef = useRef(saved.items);
  const examples = useMemo(() => mergeExamples(saved.items), [saved.items]);
  const trainedDataset = useRef("");
  const trainingTask = useRef<Promise<void> | null>(null);
  const [isTrained, setIsTrained] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [modelVersion, setModelVersion] = useState(0);

  const getModel = useCallback((): Jev<typeof questions> => {
    if (!jevRef.current) jevRef.current = new Jev(questions, { hidden: 24, lr: 0.08 });
    return jevRef.current;
  }, []);

  const train = useCallback(
    (opts: { epochs?: number; batchSize?: number; dataset?: TicketExample[] } = {}) => {
      if (trainingTask.current) return trainingTask.current;
      const model = getModel();
      setIsTraining(true);
      // Yield to the browser so the "training..." state can paint before the (synchronous) work runs.
      const task = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            const dataset = opts.dataset ?? examples;
            const history = model.train(dataset, { epochs: opts.epochs ?? 120, batchSize: opts.batchSize ?? 8 });
            const evalReport = model.evaluate(dataset);
            setLossHistory(history);
            setReport(evalReport);
            setIsTrained(true);
            trainedDataset.current = JSON.stringify(dataset);
            setModelVersion((v) => v + 1);
            resolve();
          } catch (error) {
            setIsTrained(false);
            setReport(null);
            setLossHistory([]);
            reject(error);
          } finally {
            setIsTraining(false);
            trainingTask.current = null;
          }
        }, 10);
      });
      trainingTask.current = task;
      return task;
    },
    [examples, getModel]
  );

  const predict = useCallback(
    (text: string): TicketDecision | null => {
      if (!isTrained || !text.trim()) return null;
      return getModel().predict(text);
    },
    [getModel, isTrained]
  );

  const commitExamples = useCallback((items: TicketExample[]) => {
    let notice = "Labels saved on this device.";
    try { localStorage.setItem(EXAMPLES_KEY, JSON.stringify({ version: 1, examples: items })); }
    catch { notice = "Labels are available for this session but couldn't be saved. Browser storage may be full or unavailable."; }
    savedRef.current = items;
    setSaved({ items, notice });
    setIsTrained(false);
    setReport(null);
    setLossHistory([]);
    setModelVersion((value) => value + 1);
    const dataset = mergeExamples(items);
    return dataset;
  }, []);

  const addExample = useCallback((state: string, labels: TicketLabels) => {
    if (trainingTask.current) throw new Error("Wait for training to finish.");
    const [example] = parseSavedExamples(JSON.stringify({ version: 1, examples: [{ state, labels }] }));
    const items = [...savedRef.current];
    const index = items.findIndex((item) => item.state === example.state);
    if (index === -1) items.push(example);
    else items[index] = example;
    return commitExamples(items);
  }, [commitExamples]);

  const removeExample = useCallback((state: string) => {
    if (trainingTask.current) throw new Error("Wait for training to finish.");
    return commitExamples(savedRef.current.filter((item) => item.state !== state));
  }, [commitExamples]);

  const pickUncertain = useCallback(
    (pool: string[], k = 5) => {
      if (!isTrained) return [];
      const labeled = new Set(savedRef.current.map((item) => item.state));
      return getModel().pickUncertain(pool.filter((item) => !labeled.has(item.trim())), k);
    },
    [getModel, isTrained]
  );

  const save = useCallback(() => {
    if (!jevRef.current || !isTrained || trainingTask.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, dataset: trainedDataset.current, model: jevRef.current.toJSON() }));
  }, [isTrained]);

  const load = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const snapshot = JSON.parse(raw);
      const dataset = JSON.stringify(examples);
      if (snapshot.version === 1) {
        if (snapshot.dataset !== dataset || typeof snapshot.model !== "string") return false;
        jevRef.current = Jev.fromJSON(snapshot.model);
      } else {
        // Older weight-only saves cannot identify the examples they were trained on.
        return false;
      }
      trainedDataset.current = dataset;
      setIsTrained(true);
      setModelVersion((v) => v + 1);
      return true;
    } catch {
      return false;
    }
  }, [examples]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Reset the in-memory model even if storage is blocked. */ }
    jevRef.current = new Jev(questions, { hidden: 24, lr: 0.08 });
    setIsTrained(false);
    setLossHistory([]);
    setReport(null);
    setModelVersion((v) => v + 1);
  }, []);

  return useMemo(
    () => ({
      questions,
      examples,
      savedExamples: saved.items,
      examplesNotice: saved.notice,
      isTrained,
      isTraining,
      lossHistory,
      report,
      modelVersion,
      train,
      predict,
      addExample,
      removeExample,
      pickUncertain,
      save,
      load,
      reset,
    }),
    [examples, saved, isTrained, isTraining, lossHistory, report, modelVersion, train, predict, addExample, removeExample, pickUncertain, save, load, reset]
  );
}
