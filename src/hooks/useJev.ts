import { useCallback, useMemo, useRef, useState } from "react";
import { Jev, type Decision } from "../../jev";
import { questions, trainingData, type TicketExample, type TicketLabels } from "../data/tickets";

const STORAGE_KEY = "orange-app:model";

export type TicketDecision = Decision<typeof questions>;

export interface EvalReport {
  avgLoss: number;
  perQuestion: Record<string, { accuracy?: number; mae?: number; brier?: number }>;
}

/** Wraps a Jev model instance in React state: training, persistence, prediction. */
export function useJev() {
  const jevRef = useRef<Jev<typeof questions> | null>(null);
  const [examples, setExamples] = useState<TicketExample[]>(trainingData);
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
      const model = getModel();
      setIsTraining(true);
      // Yield to the browser so the "training..." state can paint before the (synchronous) work runs.
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const dataset = opts.dataset ?? examples;
          const history = model.train(dataset, { epochs: opts.epochs ?? 120, batchSize: opts.batchSize ?? 8 });
          const evalReport = model.evaluate(dataset);
          setLossHistory(history);
          setReport(evalReport);
          setIsTrained(true);
          setIsTraining(false);
          setModelVersion((v) => v + 1);
          resolve();
        }, 10);
      });
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

  const addExample = useCallback((state: string, labels: TicketLabels) => {
    setExamples((prev) => [...prev, { state, labels }]);
  }, []);

  const pickUncertain = useCallback(
    (pool: string[], k = 5) => {
      if (!isTrained) return [];
      return getModel().pickUncertain(pool, k);
    },
    [getModel, isTrained]
  );

  const save = useCallback(() => {
    if (!jevRef.current) return;
    localStorage.setItem(STORAGE_KEY, jevRef.current.toJSON());
  }, []);

  const load = useCallback((): boolean => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      jevRef.current = Jev.fromJSON(raw);
      setIsTrained(true);
      setModelVersion((v) => v + 1);
      return true;
    } catch {
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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
      isTrained,
      isTraining,
      lossHistory,
      report,
      modelVersion,
      train,
      predict,
      addExample,
      pickUncertain,
      save,
      load,
      reset,
    }),
    [examples, isTrained, isTraining, lossHistory, report, modelVersion, train, predict, addExample, pickUncertain, save, load, reset]
  );
}
