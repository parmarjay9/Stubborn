// Clock in without signal.
//
// A tap is hashed and chained on the phone, so it does not need the server to
// be created. If the server cannot be reached, the finished entry waits in a
// queue on the phone and is sent, in order, when the connection comes back.
// The server still checks every hash and records when it actually received
// each entry (serverTs), so a late entry is visibly late.
import { ApiError, api } from './api'
import type { Entry } from './hashchain'

export interface LogState {
  entries: Entry[] // sent entries followed by queued ones
  pending: number
  offline: boolean
  conflict: string | null
}

const cacheKey = (deviceId: string) => `stubborn.cache.${deviceId}`
const queueKey = (deviceId: string) => `stubborn.queue.${deviceId}`

function load(key: string): Entry[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Entry[]) : []
  } catch {
    return []
  }
}

function save(key: string, entries: Entry[]) {
  try {
    if (entries.length) localStorage.setItem(key, JSON.stringify(entries))
    else localStorage.removeItem(key)
  } catch {
    // Storage full or blocked. The queue then only lives for this page load.
  }
}

export function queued(deviceId: string): Entry[] {
  return load(queueKey(deviceId))
}

/** Send queued taps in order. Stops at the first one that does not go through. */
async function flush(deviceId: string, synced: Entry[]): Promise<{ synced: Entry[]; offline: boolean; conflict: string | null }> {
  const queue = queued(deviceId)
  while (queue.length) {
    try {
      const { entry } = await api.appendShift(stripLocal(queue[0]))
      synced = [...synced, entry]
      queue.shift()
      save(queueKey(deviceId), queue)
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) return { synced, offline: true, conflict: null }
      // The server refused it (for example the log moved on from another phone).
      return { synced, offline: false, conflict: err instanceof Error ? err.message : 'A saved tap could not be sent.' }
    }
  }
  return { synced, offline: false, conflict: null }
}

function stripLocal(entry: Entry): Entry {
  const { pending: _pending, ...rest } = entry
  return rest
}

/** Fetch the log, send anything waiting, and fall back to the copy on the phone when offline. */
export async function loadLog(deviceId: string): Promise<LogState> {
  let synced: Entry[]
  try {
    synced = (await api.listShifts(deviceId)).entries
    save(cacheKey(deviceId), synced)
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 0)) throw err
    const queue = queued(deviceId)
    return { entries: [...load(cacheKey(deviceId)), ...queue], pending: queue.length, offline: true, conflict: null }
  }
  const result = await flush(deviceId, synced)
  save(cacheKey(deviceId), result.synced)
  const queue = queued(deviceId)
  return { entries: [...result.synced, ...queue], pending: queue.length, offline: result.offline, conflict: result.conflict }
}

/** Send one tap now, or keep it on the phone if there is no connection. */
export async function recordTap(entry: Entry): Promise<'sent' | 'queued'> {
  const queue = queued(entry.deviceId)
  if (queue.length === 0) {
    try {
      await api.appendShift(entry)
      return 'sent'
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 0)) throw err
    }
  }
  save(queueKey(entry.deviceId), [...queue, { ...entry, pending: true }])
  return 'queued'
}
