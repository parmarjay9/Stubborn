import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

const STEPS = [
  { to: '/log', label: 'Record' },
  { to: '/check', label: 'Catch' },
  { to: '/act', label: 'Act' },
]

/** Shows where this screen sits in the three-part process. */
export default function StepTrail({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label={t('Where you are in the process')}>
      {STEPS.map((step, index) => {
        const number = index + 1
        const active = number === current
        return (
          <li key={step.to} className="flex items-center gap-1.5">
            {index > 0 && <span className="h-0.5 w-4 bg-ink/30" aria-hidden="true" />}
            <Link
              to={step.to}
              aria-current={active ? 'step' : undefined}
              className={`tag flex items-center gap-1.5 rounded-md border-2 px-2 py-1 ${
                active ? 'border-ink bg-hi text-ink' : number < current ? 'border-ink/40 text-ink' : 'border-ink/20 text-muted'
              }`}
            >
              <span>{number}</span>
              {t(step.label)}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
