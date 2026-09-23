const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'for',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'please',
  'the',
  'to',
  'what',
  'with',
  'you',
])

const INTENT_RULES = [
  {
    label: 'Builder',
    matches: ['build', 'debug', 'fix', 'react', 'ship', 'test', 'typescript'],
    summary: 'Turn the prompt into a concrete implementation or verification plan.',
    nextStep: 'Start with the smallest working slice, then verify it before polishing.',
  },
  {
    label: 'Explainer',
    matches: ['compare', 'explain', 'summary', 'why'],
    summary: 'Clarify the idea, trade-offs, or concept behind the prompt.',
    nextStep: 'Lead with the main idea, then add the two most useful details.',
  },
  {
    label: 'Planner',
    matches: ['plan', 'roadmap', 'steps', 'workflow'],
    summary: 'Break the request into an ordered sequence of manageable actions.',
    nextStep: 'List the first action, the success check, and the likely follow-up.',
  },
  {
    label: 'Creative',
    matches: ['brainstorm', 'idea', 'name', 'story'],
    summary: 'Offer a few focused creative directions anchored to the prompt.',
    nextStep: 'Generate 3 options, keep 1, then sharpen it into a clear response.',
  },
] as const

export type OrangeResult = {
  mode: string
  intent: string
  confidence: string
  focus: string[]
  response: string
}

const delay = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms))

function summarizePrompt(prompt: string): string {
  const collapsed = prompt.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= 110) {
    return collapsed
  }

  return `${collapsed.slice(0, 107)}...`
}

function extractFocus(prompt: string): string[] {
  const words: string[] = prompt.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const focus = words.filter((word, index) => !STOP_WORDS.has(word) && words.indexOf(word) === index)
  return focus.slice(0, 4)
}

function chooseIntent(prompt: string) {
  const lower = prompt.toLowerCase()
  return (
    INTENT_RULES.find((rule) => rule.matches.some((keyword) => lower.includes(keyword))) ?? {
      label: 'Responder',
      summary: 'Reflect the prompt back clearly and keep the answer grounded and concise.',
      nextStep: 'Restate the task in plain language and answer the most direct need first.',
    }
  )
}

function confidenceFromPrompt(prompt: string): string {
  const strength = Math.min(96, 62 + Math.floor(prompt.trim().length / 6))
  return `${strength}% deterministic match`
}

export async function generateOrangeReply(rawPrompt: string): Promise<OrangeResult> {
  const prompt = rawPrompt.trim()

  if (!prompt) {
    throw new Error('Enter a prompt before submitting to Orange.')
  }

  if (prompt.length > 600) {
    throw new Error('Orange keeps this demo intentionally small: please use 600 characters or fewer.')
  }

  const intent = chooseIntent(prompt)
  const focus = extractFocus(prompt)
  const focusList = focus.length > 0 ? focus : ['general request', 'local demo']
  const summary = summarizePrompt(prompt)

  await delay(420)

  return {
    mode: 'Local deterministic demo',
    intent: intent.label,
    confidence: confidenceFromPrompt(prompt),
    focus: focusList,
    response: [
      `Prompt read: “${summary}”`,
      `${intent.summary}`,
      `Suggested next move: ${intent.nextStep}`,
      'Orange is not calling an API here — this output is generated locally from simple prompt rules.',
    ].join('\n\n'),
  }
}
