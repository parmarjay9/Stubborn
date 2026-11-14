import { useEffect, useState } from 'react'
import { clockTime } from '../lib/format'
import { ZERO_HASH, hashEntry, type EntryCore } from '../lib/hashchain'

// A hands-on explainer. These four sample entries are hashed in the browser
// with the same code the real log uses, so the break you see is a real one.

const SAMPLE: Omit<EntryCore, 'prevHash'>[] = [
  { deviceId: 'sample', seq: 0, type: 'IN', clientTs: '2026-11-09T08:02:00-07:00', lat: null, lng: null, accuracyM: null },
  { deviceId: 'sample', seq: 1, type: 'OUT', clientTs: '2026-11-09T17:02:00-07:00', lat: null, lng: null, accuracyM: null },
  { deviceId: 'sample', seq: 2, type: 'IN', clientTs: '2026-11-10T08:00:00-07:00', lat: null, lng: null, accuracyM: null },
  { deviceId: 'sample', seq: 3, type: 'OUT', clientTs: '2026-11-10T17:30:00-07:00', lat: null, lng: null, accuracyM: null },
]
const EDITED_SEQ = 1
const EDITED_TS = '2026-11-09T19:02:00-07:00' // two hours later than what was recorded

interface Block {
  entry: EntryCore
  stored: string
  actual: string
}

async function build(tampered: boolean): Promise<Block[]> {
  const blocks: Block[] = []
  let prev = ZERO_HASH
  for (const sample of SAMPLE) {
    const original: EntryCore = { ...sample, prevHash: prev }
    const stored = await hashEntry(original)
    const edited = tampered && sample.seq === EDITED_SEQ
    const entry = edited ? { ...original, clientTs: EDITED_TS } : original
    blocks.push({ entry, stored, actual: edited ? await hashEntry(entry) : stored })
    prev = stored
  }
  return blocks
}

export default function ChainDemo() {
  const [tampered, setTampered] = useState(false)
  const [blocks, setBlocks] = useState<Block[]>([])

  useEffect(() => {
    let live = true
    build(tampered).then((result) => live && setBlocks(result))
    return () => {
      live = false
    }
  }, [tampered])

  const brokenAt = blocks.findIndex((block) => block.stored !== block.actual)

  return (
    <div className="card grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tag text-muted">Try it</p>
          <h3 className="text-xl font-extrabold">Go on, try to fudge an entry</h3>
        </div>
        {blocks.length > 0 && (
          <span key={String(tampered)} className={`stamp thunk shrink-0 ${brokenAt === -1 ? 'border-accent text-accent' : 'border-bad text-bad'}`}>
            {brokenAt === -1 ? 'Verified' : 'Changed'}
          </span>
        )}
      </div>

      <ol className="grid gap-0">
        {blocks.map((block, index) => {
          const broken = brokenAt !== -1 && index >= brokenAt
          const edited = index === brokenAt
          return (
            <li key={block.entry.seq}>
              {index > 0 && (
                <div className={`ml-5 h-4 w-0.5 ${broken ? 'bg-bad' : 'bg-ink'}`} style={broken ? { backgroundImage: 'linear-gradient(var(--color-card) 50%, transparent 50%)', backgroundSize: '2px 6px' } : undefined} />
              )}
              <div className={`flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2 font-mono text-sm ${broken ? 'border-bad bg-bad-soft text-bad' : 'border-ink bg-white'}`}>
                <span>
                  <span className="font-bold">{block.entry.type === 'IN' ? 'IN ' : 'OUT'}</span>{' '}
                  <span className={edited ? 'font-bold underline decoration-wavy' : ''}>{clockTime(block.entry.clientTs)}</span>
                </span>
                <span className="text-xs">
                  {edited ? (
                    <>
                      <s>{block.stored.slice(0, 6)}</s> {block.actual.slice(0, 6)}
                    </>
                  ) : (
                    <>#{block.stored.slice(0, 6)}</>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="min-h-10 text-sm text-muted" aria-live="polite">
        {brokenAt === -1
          ? 'Each entry gets a fingerprint (the # code) made from its own details plus the fingerprint before it.'
          : `Entry ${brokenAt} now says 7:02 PM, so its fingerprint no longer matches the one the server saved. Everything after it is in doubt too.`}
      </p>

      <button type="button" className="btn btn-secondary !min-h-12 !text-base" onClick={() => setTampered(!tampered)}>
        {tampered ? 'Put it back' : 'Add 2 hours to Monday'}
      </button>
    </div>
  )
}
