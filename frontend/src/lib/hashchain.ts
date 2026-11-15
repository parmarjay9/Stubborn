// Tamper-evident hash chain. Must match backend/src/common/hashchain.py exactly.
//
// Canonical JSON: the eight hashed fields, keys sorted, no whitespace.
// Coordinates are written as fixed 6-decimal strings so JavaScript and Python
// can never disagree about how a float prints. serverTs is not hashed.

export const ZERO_HASH = '0'.repeat(64)

export interface EntryCore {
  deviceId: string
  seq: number
  type: 'IN' | 'OUT'
  clientTs: string
  lat: number | null
  lng: number | null
  accuracyM: number | null
  prevHash: string
}

export interface Entry extends EntryCore {
  hash: string
  serverTs?: string
  /** Only on the phone: saved without signal, not sent yet. */
  pending?: boolean
}

/** Round a coordinate to 6 decimals (about 11 cm) before it is stored or hashed. */
export function roundCoord(value: number): number {
  return Number(value.toFixed(6))
}

export function canonicalJson(entry: EntryCore): string {
  // Keys are listed in sorted order; JSON.stringify keeps insertion order.
  return JSON.stringify({
    accuracyM: entry.accuracyM === null ? null : Math.round(entry.accuracyM),
    clientTs: entry.clientTs,
    deviceId: entry.deviceId,
    lat: entry.lat === null ? null : entry.lat.toFixed(6),
    lng: entry.lng === null ? null : entry.lng.toFixed(6),
    prevHash: entry.prevHash,
    seq: entry.seq,
    type: entry.type,
  })
}

/** Pure JS SHA-256. Used when Web Crypto is missing (plain http on a LAN). */
export function sha256Fallback(bytes: Uint8Array): string {
  const K = new Uint32Array(64)
  const H = new Uint32Array(8)
  for (let candidate = 2, n = 0; n < 64; candidate++) {
    let prime = true
    for (let i = 2; i * i <= candidate; i++) {
      if (candidate % i === 0) {
        prime = false
        break
      }
    }
    if (!prime) continue
    if (n < 8) H[n] = Math.floor((Math.sqrt(candidate) % 1) * 2 ** 32)
    K[n++] = Math.floor((Math.cbrt(candidate) % 1) * 2 ** 32)
  }

  const length = bytes.length
  const padded = new Uint8Array((((length + 8) >> 6) + 1) << 6)
  padded.set(bytes)
  padded[length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(length / 2 ** 29))
  view.setUint32(padded.length - 4, (length << 3) >>> 0)

  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    H[0] += a
    H[1] += b
    H[2] += c
    H[3] += d
    H[4] += e
    H[5] += f
    H[6] += g
    H[7] += h
  }
  return Array.from(H, (word) => word.toString(16).padStart(8, '0')).join('')
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return sha256Fallback(bytes)
}

export function hashEntry(entry: EntryCore): Promise<string> {
  return sha256Hex(canonicalJson(entry))
}
