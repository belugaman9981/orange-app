export async function acumenRequest(path: "/api/session" | "/api/chat", token: string, signal: AbortSignal, message?: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/acumen${path}`, {
      method: message === undefined ? "GET" : "POST",
      headers: { "X-Acumen-Token": token, "Content-Type": "application/json" },
      body: message === undefined ? undefined : JSON.stringify({ message }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Couldn't reach AcumenAI. Start its bridge, then try again.");
  }
  if (response.status === 401) throw new Error("Pairing token not accepted. Paste the token from the AcumenAI terminal and reconnect.");
  if (response.status === 413) throw new Error("This question is too long. Shorten it and try again.");
  if (!response.ok) throw new Error("AcumenAI couldn't complete the request. Check its terminal and try again.");
  try { return await response.json(); }
  catch { throw new Error("Unexpected response. Run Orange with npm run dev or npm run preview so its AcumenAI connection is available."); }
}

export async function askAcumen(question: string, token: string, signal: AbortSignal): Promise<string> {
  const result = await acumenRequest("/api/chat", token, signal, question.trim());
  if (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string" || !result.reply.trim()) {
    throw new Error("AcumenAI returned an empty or invalid answer. Try again.");
  }
  return result.reply;
}
