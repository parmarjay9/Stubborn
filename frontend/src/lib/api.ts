import type { Entry } from './hashchain'

const configured = import.meta.env.VITE_API_URL as string | undefined
// In dev with no VITE_API_URL, talk to backend/local_server.py on the same host.
export const API_BASE = (configured || `${location.protocol}//${location.hostname}:8787`).replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('We could not reach the server. Check your connection and try again.', 0)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', response.status)
  return data as T
}

export interface VerifyResult {
  valid: boolean
  brokenAtSeq: number | null
  count: number
  tampered?: boolean
}

export interface StubFields {
  payPeriodStart: string
  payPeriodEnd: string
  hourlyRate: string
  regularHoursPaid: string
  overtimeHoursPaid: string
  grossPay: string
}

export type StubFieldName = keyof StubFields

export interface ExtractResult {
  ok: boolean
  message?: string
  fields: Record<StubFieldName, { value: string | null; confidence: number; raw: string | null }>
}

export interface Finding {
  code: string
  label: string
  math: string
  amount: string | null
}

export interface CheckResult {
  checkId: string
  checkedAt: string
  payPeriod: { start: string; end: string }
  rate: string
  effectiveRate: string
  overtimeRate: string
  minimumWage: string
  rateBelowMinimum: boolean
  weeks: { weekStart: string; weekEnd: string; loggedHours: string; expectedRegular: string; expectedOT: string; expectedGross: string }[]
  totals: {
    loggedHours: string
    paidHours: string
    missingHours: string
    expectedRegular: string
    expectedOT: string
    expectedGross: string
    grossPay: string
    owed: string
  }
  findings: Finding[]
  warnings: string[]
  log: VerifyResult
}

export interface Letters {
  managerMessage: string
  complaintSummary: string
  source: 'bedrock' | 'template'
}

export interface Worker {
  name: string
  employer: string
  managerName: string
  phone: string
  email: string
}

export interface AgentStep {
  step: number
  message: string
  ts?: string
}

export interface AgentRun {
  runId: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE'
  steps: AgentStep[]
  streamingUrl: string | null
  result: unknown
  message?: string
}

export type Claim = Record<
  'name' | 'phone' | 'email' | 'employer' | 'payPeriodStart' | 'payPeriodEnd' | 'hourlyRate' | 'hoursLogged' | 'hoursPaid' | 'amountOwed' | 'summary',
  string
>

export const api = {
  health: () => call<{ ok: boolean }>('GET', '/health'),
  listShifts: (deviceId: string) => call<{ entries: Entry[] }>('GET', `/shifts?deviceId=${deviceId}`),
  appendShift: (entry: Entry) => call<{ entry: Entry }>('POST', '/shifts', entry),
  verify: (deviceId: string) => call<VerifyResult>('GET', `/shifts/verify?deviceId=${deviceId}`),
  demo: (deviceId: string, action: 'tamper' | 'restore') => call<VerifyResult>('POST', '/shifts/demo', { deviceId, action }),
  uploadUrl: (deviceId: string, contentType: string) =>
    call<{ key: string; uploadUrl: string }>('POST', '/stub/upload-url', { deviceId, contentType }),
  extract: (deviceId: string, key: string) => call<ExtractResult>('POST', '/stub/extract', { deviceId, key }),
  check: (deviceId: string, stub: StubFields) => call<CheckResult>('POST', '/check', { deviceId, stub }),
  letters: (check: CheckResult, worker: Worker) => call<Letters>('POST', '/letters', { check, worker }),
  agentStart: (deviceId: string, claim: Claim) => call<{ runId: string }>('POST', '/agent/start', { deviceId, claim }),
  agentStatus: (runId: string) => call<AgentRun>('GET', `/agent/status/${runId}`),
}

export async function uploadStub(uploadUrl: string, blob: Blob): Promise<void> {
  const url = uploadUrl.startsWith('/') ? API_BASE + uploadUrl : uploadUrl
  let response: Response
  try {
    response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob })
  } catch {
    throw new ApiError('The photo did not upload. Check your connection and try again.', 0)
  }
  if (!response.ok) throw new ApiError('The photo did not upload. Please try again.', response.status)
}
