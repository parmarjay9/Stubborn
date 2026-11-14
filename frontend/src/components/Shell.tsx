import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { isDemo } from '../lib/device'

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)

const TABS = [
  { to: '/', label: 'Home', icon: icon(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>) },
  { to: '/log', label: 'My hours', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
  { to: '/check', label: 'Check stub', icon: icon(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>) },
  { to: '/act', label: 'Take action', icon: icon(<><path d="M4 20l16-8L4 4v6l10 2-10 2z" /></>) },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-base font-black text-white">S</span>
      Stubborn
    </Link>
  )
}

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line pt-5 text-center text-sm leading-relaxed text-muted">
      <p>Stubborn flags possible underpayment. It is not legal advice.</p>
      <p className="mt-1">
        Built by <span className="font-semibold text-ink">Jay Parmar</span> at{' '}
        <span className="font-semibold text-ink">sunhacks 2026</span>, ASU Tempe.
      </p>
    </footer>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo />
          {/* Tablet and desktop: links in the top bar */}
          <nav className="hidden gap-1 md:flex" aria-label="Main">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-accent-soft text-accent-dark' : 'text-muted hover:text-ink'}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            {isDemo() && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">Demo device</span>}
            <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">sunhacks 2026</span>
          </div>
        </div>
      </header>

      {/* Bottom padding keeps content clear of the phone nav bar */}
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5 md:pb-10">
        {children}
        <Footer />
      </main>

      {/* Phones: nav bar pinned to the bottom, inside thumb reach */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
