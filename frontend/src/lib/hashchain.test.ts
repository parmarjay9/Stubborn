import { describe, expect, it } from 'vitest'
import { ZERO_HASH, canonicalJson, hashEntry, roundCoord, sha256Fallback, sha256Hex, type EntryCore } from './hashchain'

// The same entry and the same expected hash are hardcoded in
// backend/tests/test_hashchain.py. If either side changes, both tests fail.
const KNOWN_ENTRY: EntryCore = {
  deviceId: '5eedde70-0000-4000-8000-00000000d340',
  seq: 0,
  type: 'IN',
  clientTs: '2026-11-10T08:02:11-07:00',
  lat: 33.4242,
  lng: -111.9281,
  accuracyM: 12,
  prevHash: ZERO_HASH,
}
const KNOWN_HASH = '5b3c06b3c31410205a88c8c3786d9acaaa43ba37c2bfa7a21b88a88ead79ee74'

describe('hash chain', () => {
  it('builds the same canonical JSON as the server', () => {
    expect(canonicalJson(KNOWN_ENTRY)).toBe(
      '{"accuracyM":12,"clientTs":"2026-11-10T08:02:11-07:00",' +
        '"deviceId":"5eedde70-0000-4000-8000-00000000d340","lat":"33.424200","lng":"-111.928100",' +
        `"prevHash":"${ZERO_HASH}","seq":0,"type":"IN"}`,
    )
  })

  it('matches the hash hardcoded in the Python tests', async () => {
    expect(await hashEntry(KNOWN_ENTRY)).toBe(KNOWN_HASH)
  })

  it('hashes a missing location as null', () => {
    expect(canonicalJson({ ...KNOWN_ENTRY, lat: null, lng: null, accuracyM: null })).toContain('"lat":null,"lng":null')
  })

  it('pure JS fallback agrees with Web Crypto', async () => {
    const samples = ['', 'abc', canonicalJson(KNOWN_ENTRY), 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'héllo ✓'.repeat(40)]
    for (const sample of samples) {
      expect(sha256Fallback(new TextEncoder().encode(sample))).toBe(await sha256Hex(sample))
    }
    expect(sha256Fallback(new TextEncoder().encode(canonicalJson(KNOWN_ENTRY)))).toBe(KNOWN_HASH)
  })

  it('rounds coordinates to 6 decimals', () => {
    expect(roundCoord(33.42421234567)).toBe(33.424212)
  })
})
