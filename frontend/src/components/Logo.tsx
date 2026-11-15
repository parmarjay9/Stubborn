/** The mark: a pay stub with a torn edge, and a clock whose hands make a check.
    Same drawing as public/logo.svg, which is also the favicon. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#17160f" />
      <g transform="rotate(-7 32 32)">
        <path d="M15 12a3 3 0 0 1 3-3h28a3 3 0 0 1 3 3v39l-5.67 5-5.67-5-5.66 5-5.67-5-5.66 5L15 51z" fill="#ffd23f" />
        <circle cx="32" cy="29" r="12.5" fill="#fffdf7" stroke="#17160f" strokeWidth="4" />
        <path d="M25.5 29.5l5 5 8-10.5" fill="none" stroke="#17160f" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-[1.4rem] font-extrabold tracking-tight text-ink">
      <LogoMark />
      <span>Stubborn</span>
    </span>
  )
}
