// No accounts. Each device gets a random id that acts as the user key.

export const DEMO_DEVICE_ID = '5eedde70-0000-4000-8000-00000000d340'

const DEVICE_KEY = 'stubborn.deviceId'
const DEMO_KEY = 'stubborn.demo'

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
    // Private mode: the id just lasts for this page load.
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

// ?demo=1 switches this browser to the seeded demo device, ?demo=0 switches back.
const flag = new URLSearchParams(location.search).get('demo')
if (flag === '1') write(DEMO_KEY, '1')
if (flag === '0') write(DEMO_KEY, null)

let memoryId: string | null = null

export function isDemo(): boolean {
  return read(DEMO_KEY) === '1'
}

export function getDeviceId(): string {
  if (isDemo()) return DEMO_DEVICE_ID
  let id = read(DEVICE_KEY) ?? memoryId
  if (!id) {
    id = uuid()
    memoryId = id
    write(DEVICE_KEY, id)
  }
  return id
}
