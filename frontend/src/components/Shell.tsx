import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { SAMPLE_WORKER, isDemo, setDemo } from '../lib/device'
import { LangSwitch, t } from '../lib/i18n'
import Logo from './Logo'

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)

const TABS = [
  { to: '/', label: 'Home', icon: icon(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>) },
  { to: '/log', label: 'Hours', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
  { to: '/check', label: 'Check', icon: icon(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>) },
  { to: '/history', label: 'History', icon: icon(<><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>) },
  { to: '/act', label: 'Act', icon: icon(<><path d="M4 20l16-8L4 4v6l10 2-10 2z" /></>) },
]

export function Footer() {
  return (
    <footer className="mt-12 border-t-2 border-dashed border-ink/30 pt-6 text-center text-sm leading-relaxed text-muted">
      <p className="font-display text-lg font-extrabold text-ink">{t('Stay stubborn.')}</p>
      <p className="mt-2">{t('Stubborn flags possible underpayment. It is not legal advice.')}</p>
      <p className="mt-1">
        {t('Built by')} <a href="https://jayparmar9.vercel.app" target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline decoration-hi decoration-4 underline-offset-4">Jay Parmar</a> {t('at')} <span className="font-bold text-ink">sunhacks 2026</span>, ASU Tempe.
      </p>
    </footer>
  )
}

/** Leaving the sample account reloads the app on the visitor's own account. */
function leaveSample() {
  setDemo(false)
  location.assign('/')
}

export default function Shell({ children }: { children: ReactNode }) {
  const sample = isDemo()
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-paper">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" aria-label={t('Stubborn home')}>
            <Logo />
          </Link>
          {/* Tablet and desktop: links in the top bar */}
          <nav className="hidden gap-1 md:flex" aria-label={t('Main')}>
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg border-2 px-3 py-1.5 text-sm font-bold ${isActive ? 'border-ink bg-hi text-ink' : 'border-transparent text-muted hover:text-ink'}`
                }
              >
                {t(tab.label)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="tag hidden rounded border-2 border-ink px-1.5 py-0.5 min-[400px]:inline md:hidden">sunhacks 2026</span>
            <LangSwitch />
          </div>
        </div>
        {sample && (
          <div className="border-t-2 border-ink bg-hi">
            <p className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-1.5 text-sm font-bold">
              <span>{t('Sample account: {name}', { name: SAMPLE_WORKER.name })}</span>
              <button type="button" onClick={leaveSample} className="underline underline-offset-2">
                {t('Exit')}
              </button>
            </p>
          </div>
        )}
      </header>

      {/* Bottom padding keeps content clear of the phone nav bar */}
      <main className="mx-auto max-w-xl px-4 pb-28 pt-6 md:pb-10">
        {children}
        <Footer />
      </main>

      {/* Phones: nav bar pinned to the bottom, inside thumb reach */}
      <nav aria-label={t('Main')} className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold ${isActive ? 'text-ink' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-12 place-items-center rounded-lg border-2 ${isActive ? 'border-ink bg-hi' : 'border-transparent'}`}>
                    {tab.icon}
                  </span>
                  {t(tab.label)}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
