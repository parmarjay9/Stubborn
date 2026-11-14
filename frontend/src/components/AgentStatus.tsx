import { useEffect, useRef, useState } from 'react'
import fallbackRun from '../../../demo/fallback/run.json'
import { api, type AgentStep, type Claim } from '../lib/api'
import { getDeviceId } from '../lib/device'

const POLL_MS = 2000
const GIVE_UP_MS = 90_000

type Phase = 'idle' | 'live' | 'replay' | 'done' | 'done-replay'

function reviewUrl(claim: Claim): string {
  return `/demo-claim-form?${new URLSearchParams(claim).toString()}`
}

export default function AgentStatus({ claim, ready }: { claim: Claim; ready: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  /** Plays the saved steps. Works with the network off. */
  async function replay() {
    setPhase('replay')
    setStreamingUrl(null)
    setSteps([])
    for (const step of fallbackRun.steps) {
      await wait(step.delayMs)
      if (cancelled.current) return
      setSteps((current) => [...current, { step: step.step, message: step.message }])
    }
    setPhase('done-replay')
  }

  async function start() {
    setPhase('live')
    setSteps([])
    setStreamingUrl(null)
    try {
      const { runId } = await api.agentStart(getDeviceId(), claim)
      const deadline = Date.now() + GIVE_UP_MS
      while (Date.now() < deadline) {
        await wait(POLL_MS)
        if (cancelled.current) return
        const run = await api.agentStatus(runId)
        setSteps(run.steps)
        setStreamingUrl(run.streamingUrl)
        if (run.status === 'COMPLETED') return setPhase('done')
        if (run.status !== 'RUNNING') break
      }
    } catch {
      // Network trouble: fall through to the saved run.
    }
    if (!cancelled.current) await replay()
  }

  const running = phase === 'live' || phase === 'replay'
  const finished = phase === 'done' || phase === 'done-replay'
  const replayed = phase === 'replay' || phase === 'done-replay'

  return (
    <div className="grid gap-3">
      {phase === 'idle' && (
        <>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={start}>
            Fill in the claim form for me
          </button>
          {!ready && <p className="text-sm text-muted">Add your name and your employer's name above first.</p>}
        </>
      )}

      {replayed && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-medium text-warn">
          {fallbackRun.source === 'recorded'
            ? 'Showing a recorded run.'
            : 'Showing a sample run. The live agent is not connected right now.'}
        </p>
      )}

      {phase !== 'idle' && (
        <ol className="grid gap-2" aria-live="polite">
          {steps.map((step, index) => {
            const current = running && index === steps.length - 1
            return (
              <li key={step.step} className="pop flex items-start gap-3 rounded-xl bg-paper px-3 py-2.5 text-[0.95rem]">
                {current ? (
                  <span className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : (
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
                <span>{step.message}</span>
              </li>
            )
          })}
          {running && steps.length === 0 && (
            <li className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5 text-[0.95rem] text-muted">
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Starting the agent...
            </li>
          )}
        </ol>
      )}

      {phase === 'live' && streamingUrl && (
        <iframe title="Live view of the agent's browser" src={streamingUrl} className="aspect-video w-full rounded-2xl border border-line bg-white" />
      )}

      {finished && (
        <div className="pop grid gap-3 rounded-2xl bg-accent-soft p-4 text-accent-dark">
          <p className="font-bold">Stopped before submit. Nothing was sent.</p>
          <p className="text-sm">Read every box yourself. You decide whether to send it.</p>
          <a href={reviewUrl(claim)} target="_blank" rel="noreferrer" className="btn btn-primary !min-h-12 !text-base">
            Review the filled form
          </a>
          <button type="button" className="text-sm font-semibold underline" onClick={start}>
            Run it again
          </button>
        </div>
      )}
    </div>
  )
}
