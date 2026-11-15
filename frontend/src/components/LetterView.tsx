import { useState } from 'react'
import type { Letters } from '../lib/api'
import { t } from '../lib/i18n'

type Tab = 'managerMessage' | 'complaintSummary'

const TABS: { id: Tab; label: string }[] = [
  { id: 'managerMessage', label: 'Note to manager' },
  { id: 'complaintSummary', label: 'Claim summary' },
]

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers and plain http: fall back to a hidden textarea.
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export default function LetterView({ letters }: { letters: Letters }) {
  const [tab, setTab] = useState<Tab>('managerMessage')
  const [copied, setCopied] = useState(false)
  const text = letters[tab]

  return (
    <div className="pop grid gap-3">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border-2 border-ink bg-paper p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => {
              setTab(item.id)
              setCopied(false)
            }}
            className={`min-h-11 rounded-lg text-sm font-bold ${tab === item.id ? 'bg-hi text-ink' : 'text-muted'}`}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <p className="whitespace-pre-wrap rounded-xl border-2 border-ink/70 bg-white p-4 text-[0.95rem] leading-relaxed">{text}</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn btn-secondary !min-h-12 !text-base"
          onClick={async () => setCopied(await copyText(text))}
        >
          {copied ? t('Copied') : t('Copy')}
        </button>
        <button
          type="button"
          className="btn btn-secondary !min-h-12 !text-base"
          disabled={!navigator.share}
          onClick={() => navigator.share?.({ text }).catch(() => {})}
        >
          {t('Share')}
        </button>
      </div>

      <p className="text-xs text-muted">
        {letters.source === 'bedrock'
          ? t('Drafted by Claude on Amazon Bedrock. Every dollar amount was checked against the rules engine.')
          : t('Written from a template using the numbers from your result.')}{' '}
        {t('Read it over and change anything before you send it.')}
      </p>
    </div>
  )
}
