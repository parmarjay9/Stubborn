// Small localStorage-backed state that carries between pages.
import type { CheckResult, Letters, Worker } from './api'
import { SAMPLE_WORKER, isDemo } from './device'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is full or blocked: the value just will not persist.
  }
}

const EMPTY_WORKER: Worker = { name: '', employer: '', managerName: '', phone: '', email: '' }

export const store = {
  getCheck: () => load<CheckResult | null>('stubborn.lastCheck', null),
  setCheck: (check: CheckResult) => {
    save('stubborn.lastCheck', check)
    save('stubborn.letters', null) // letters belong to one check
  },
  // The sample account comes with its made-up worker already filled in.
  getWorker: () => {
    // Blank saved fields do not wipe out the sample worker's made-up details.
    const saved = Object.fromEntries(Object.entries(load<Partial<Worker>>('stubborn.worker', {})).filter(([, v]) => v))
    return { ...EMPTY_WORKER, ...(isDemo() ? SAMPLE_WORKER : {}), ...saved }
  },
  setWorker: (worker: Worker) => save('stubborn.worker', worker),
  getLetters: () => load<Letters | null>('stubborn.letters', null),
  setLetters: (letters: Letters) => save('stubborn.letters', letters),
}
