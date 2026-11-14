import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { isDemo } from '../lib/device'

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)

const TABS = [
  { to: '/', label: 'Home', icon: icon(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>) },
  { to: '/log', label: 'My hours', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
  { to: '/check', label: 'Check stub', icon: icon(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>) },
  { to: '/act', label: 'Take action', icon: icon(<><path d="M4 20l16-8L4 4v6l10 2-10 2z" /></>) },
]

/** The mark is a ticket stub: a tag with a notch punched out of each side. */
function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-display text-[1.35rem] font-extrabold tracking-tight text-ink">
      <span
        className="grid h-8 w-10 place-items-center bg-ink text-base font-black text-hi"
        style={{ mask: 'radial-gradient(circle 5px at 0 50%, #0000 98%, #000), radial-gradient(circle 5px at 100% 50%, #0000 98%, #000)', maskComposite: 'intersect' }}
        aria-hidden="true"
      >
        S
      </span>
      <span>
        Stub<span className="hl">born</span>
      </span>
    </Link>
  )
}

export function Footer() {
  return (
    <footer className="mt-12 border-t-2 border-dashed border-ink/30 pt-6 text-center text-sm leading-relaxed text-muted">
      <p className="font-display text-lg font-extrabold text-ink">Stay stubborn.</p>
      <p className="mt-2">Stubborn flags possible underpayment. It is not legal advice.</p>
      <p className="mt-1">
        Built by <span className="font-bold text-ink">Jay Parmar</span> at <span className="font-bold text-ink">sunhacks 2026</span>, ASU
        Tempe.
      </p>
    </footer>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-paper">
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
                  `rounded-lg border-2 px-3 py-1.5 text-sm font-bold ${isActive ? 'border-ink bg-hi text-ink' : 'border-transparent text-muted hover:text-ink'}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            {isDemo() && <span className="tag rounded border-2 border-warn px-1.5 py-0.5 text-warn">Demo</span>}
            <span className="tag rounded border-2 border-ink px-1.5 py-0.5">sunhacks 2026</span>
          </div>
        </div>
      </header>

      {/* Bottom padding keeps content clear of the phone nav bar */}
      <main className="mx-auto max-w-xl px-4 pb-28 pt-6 md:pb-10">
        {children}
        <Footer />
      </main>

      {/* Phones: nav bar pinned to the bottom, inside thumb reach */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4">
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
                  {tab.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
