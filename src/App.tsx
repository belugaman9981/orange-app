import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { generateOrangeReply, validateOrangePrompt } from './lib/orangeDemo'

type ChatMessage =
  | { id: number; role: 'user'; content: string }
  | {
      id: number
      role: 'assistant'
      content: string
      meta: { mode: string; intent: string; confidence: string; focus: string[] }
    }

const SUGGESTED_PROMPTS = [
  'Plan a tiny TypeScript app for a local AI demo.',
  'Explain how Orange should respond to a bug report.',
  'Brainstorm a friendly welcome message for the playground.',
]

function App() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const nextIdRef = useRef(1)
  const latestMessageId = messages.at(-1)?.id

  const submitPrompt = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    if (isLoading) {
      return
    }

    let draft = ''

    try {
      draft = validateOrangePrompt(prompt)
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : 'Orange could not process that prompt.'
      setError(message)
      return
    }

    const userMessage: ChatMessage = { id: nextIdRef.current++, role: 'user', content: draft }

    setError(null)
    setIsLoading(true)
    setMessages((current) => [...current, userMessage])
    setPrompt('')

    try {
      const result = await generateOrangeReply(draft)
      setMessages((current) => [
        ...current,
        {
          id: nextIdRef.current++,
          role: 'assistant',
          content: result.response,
          meta: {
            mode: result.mode,
            intent: result.intent,
            confidence: result.confidence,
            focus: result.focus,
          },
        },
      ])
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : 'Orange could not process that prompt.'
      setError(message)
      setMessages((current) => [
        ...current,
        {
          id: nextIdRef.current++,
          role: 'assistant',
          content: `Orange hit a local demo error.\n\n${message}`,
          meta: {
            mode: 'Local deterministic demo',
            intent: 'Error',
            confidence: '0% deterministic match',
            focus: ['retry', 'validation'],
          },
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <div className="shell">
      <main className="app-layout">
        <section className="hero-panel" aria-labelledby="orange-title">
          <p className="eyebrow">Local LM-inspired playground</p>
          <h1 id="orange-title">Orange</h1>
          <p className="hero-copy">
            A focused browser demo inspired by small language-model workflows. It accepts a prompt and produces a
            deterministic local response with clear labels — no external APIs, no hidden training claims.
          </p>
          <dl className="hero-stats">
            <div>
              <dt>Mode</dt>
              <dd>Local-only</dd>
            </div>
            <div>
              <dt>Input</dt>
              <dd>Prompt-first</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>Deterministic demo</dd>
            </div>
          </dl>
        </section>

        <section className="playground-panel" aria-labelledby="playground-heading">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Playground</p>
              <h2 id="playground-heading">Try a prompt</h2>
            </div>
            <p className="hint">Press Enter to send. Use Shift+Enter for a new line.</p>
          </div>

          <div className="suggestion-row" aria-label="Suggested prompts">
            {SUGGESTED_PROMPTS.map((suggestion) => (
              <button key={suggestion} type="button" className="suggestion-chip" onClick={() => setPrompt(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>

          <form ref={formRef} className="prompt-form" onSubmit={submitPrompt}>
            <label className="field-label" htmlFor="prompt-input">
              Prompt
            </label>
            <textarea
              id="prompt-input"
              name="prompt"
              className="prompt-input"
              rows={5}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Ask Orange to explain, plan, or sketch a response..."
              aria-describedby="prompt-help"
              disabled={isLoading}
            />
            <div className="form-footer">
              <p id="prompt-help" className="hint">
                Orange runs locally and returns a deterministic demo response.
              </p>
              <button type="submit" className="submit-button" disabled={isLoading}>
                {isLoading ? 'Generating…' : 'Send prompt'}
              </button>
            </div>
          </form>

          {error ? (
            <div className="status-banner error" role="alert">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="loading-state" role="status" aria-atomic="true">
              <span className="loading-dot" aria-hidden="true" />
              Orange is composing a local deterministic reply…
            </div>
          ) : null}

          <section className="transcript" aria-label="Orange conversation transcript">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h3>No prompts yet</h3>
                <p>Start with a short request to see how the local Orange response engine labels and formats its reply.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`message ${message.role}`}
                  aria-live={message.id === latestMessageId ? "polite" : undefined}
                  aria-atomic={message.id === latestMessageId ? "true" : undefined}
                >
                  <div className="message-header">
                    <span>{message.role === 'user' ? 'You' : 'Orange'}</span>
                    {message.role === 'assistant' ? <span className="badge">{message.meta.mode}</span> : null}
                  </div>
                  <p className="message-body">{message.content}</p>
                  {message.role === 'assistant' ? (
                    <dl className="response-meta">
                      <div>
                        <dt>Intent</dt>
                        <dd>{message.meta.intent}</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{message.meta.confidence}</dd>
                      </div>
                      <div>
                        <dt>Focus</dt>
                        <dd>{message.meta.focus.join(', ')}</dd>
                      </div>
                    </dl>
                  ) : null}
                </article>
              ))
            )}

          </section>
        </section>
      </main>
    </div>
  )
}

export default App
