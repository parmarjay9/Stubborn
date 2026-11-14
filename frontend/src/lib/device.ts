// No sign-in. Each browser gets a random id that acts as the user key.
//
// The sample account is a second id kept next to the real one. Every browser
// gets its own copy of the sample data, so visitors cannot change each other's.

const DEVICE_KEY = 'stubborn.deviceId'
const SAMPLE_KEY = 'stubborn.sampleId'
const MODE_KEY = 'stubborn.demo'
const SEEDED_KEY = 'stubborn.sampleSeeded'
// Page state that belongs to one account and must not leak into the other.
const PER_ACCOUNT_KEYS = ['stubborn.lastCheck', 'stubborn.letters', 'stubborn.worker']

export const SAMPLE_WORKER = { name: 'Alex Rivera', employer: 'Desert Sun Logistics LLC' }

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private mode: the value just lasts for this page load.
  }
}

function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const b = new Uint8Array(16)
  globalThis.crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const memory: Record<string, string> = {}

function idFor(key: string): string {
  let id = read(key) ?? memory[key]
  if (!id) {
    id = uuid()
    memory[key] = id
    write(key, id)
  }
  return id
}

/** True while this browser is looking at the sample account. */
export function isDemo(): boolean {
  return read(MODE_KEY) === '1'
}

/** Switch between the sample account and the visitor's own (empty) one. */
export function setDemo(on: boolean) {
  if (on === isDemo()) return
  write(MODE_KEY, on ? '1' : null)
  for (const key of PER_ACCOUNT_KEYS) write(key, null)
}

export function getDeviceId(): string {
  return idFor(isDemo() ? SAMPLE_KEY : DEVICE_KEY)
}

/** Has this browser's sample account been loaded with its history yet? */
export function sampleSeeded(): boolean {
  return read(SEEDED_KEY) === idFor(SAMPLE_KEY)
}

export function markSampleSeeded() {
  write(SEEDED_KEY, idFor(SAMPLE_KEY))
}

// ?demo=1 opens the sample account, ?demo=0 leaves it.
const flag = new URLSearchParams(location.search).get('demo')
if (flag === '1') setDemo(true)
if (flag === '0') setDemo(false)
