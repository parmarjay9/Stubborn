// English and Spanish. Strings are written in English in the code and looked
// up in the Spanish table (i18n-es.ts) when Spanish is on. Numbers never go
// through translation: they come from the rules engine and are filled in.
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react'
import { ES } from './i18n-es'

export type Lang = 'en' | 'es'

const KEY = 'stubborn.lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    // fall through to the browser language
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

let current: Lang = initial()

export function getLang(): Lang {
  return current
}

/** Translate an English string. {name} placeholders are filled from vars. */
export function t(text: string, vars?: Record<string, string | number>): string {
  let out = text
  if (current === 'es') {
    const found = ES[text]
    if (found === undefined && import.meta.env.DEV) console.warn('[i18n] missing es:', text)
    out = found ?? text
  }
  if (vars) for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(String(value))
  return out
}

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: current, setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(current)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = (next: Lang) => {
    current = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // the choice just lasts for this visit
    }
    setState(next)
  }
  // Keyed on the language so every screen redraws in the new one.
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}

/** EN | ES switch. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div role="group" aria-label="Language / Idioma" className={`flex overflow-hidden rounded-md border-2 border-ink text-xs font-extrabold ${className}`}>
      {(['en', 'es'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`min-h-8 min-w-9 px-2 ${lang === code ? 'bg-ink text-hi' : 'bg-card text-ink'}`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
