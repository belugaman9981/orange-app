// Ambient stub so the optional `jev.bootstrap()` LLM-distillation path
// type-checks without requiring @anthropic-ai/sdk to be installed.
// Only needed if you actually call `bootstrap()`.
declare module "@anthropic-ai/sdk" {
  const Anthropic: any;
  export default Anthropic;
}
