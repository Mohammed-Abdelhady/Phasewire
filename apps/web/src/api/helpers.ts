const API_ROOT = '/api'

const browserWindow = typeof window === 'undefined' ? null : window
const hashParameters = new URLSearchParams(browserWindow?.location.hash.replace(/^#/u, '') ?? '')

export const apiToken = hashParameters.get('token')
export const requestedWorkflowId = hashParameters.get('workflow')

if (apiToken !== null && browserWindow !== null) {
  const visibleParameters = new URLSearchParams()
  if (requestedWorkflowId !== null) {
    visibleParameters.set('workflow', requestedWorkflowId)
  }
  const visibleHash = visibleParameters.size === 0 ? '' : `#${visibleParameters.toString()}`
  browserWindow.history.replaceState(
    null,
    '',
    `${browserWindow.location.pathname}${browserWindow.location.search}${visibleHash}`,
  )
}

export function apiPath(path: string): string {
  return `${API_ROOT}${path}`
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stringValue(record: Record<string, unknown>, key: string, fallback = ''): string {
  const value = record[key]
  return typeof value === 'string' ? value : fallback
}

export function numberValue(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function recordValue(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key]
  return isRecord(value) ? value : {}
}

export function arrayValue(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key]
  return Array.isArray(value) ? value : []
}

export async function parseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const responseBody: unknown = await response.json().catch(() => null)
    const message = isRecord(responseBody) ? stringValue(responseBody, 'error') : ''
    throw new Error(message.length > 0 ? message : `Phasewire API returned ${response.status}.`)
  }
  return response.json() as Promise<unknown>
}

function cookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }
  const prefix = `${name}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (cookie === undefined) {
    return null
  }
  try {
    return decodeURIComponent(cookie.slice(prefix.length))
  } catch {
    return null
  }
}

export function apiHeaders(options: { json?: boolean; mutation?: boolean } = {}): HeadersInit {
  const csrfToken = options.mutation === true ? cookieValue('phasewire_csrf') : null
  return {
    Accept: 'application/json',
    ...(options.json === true ? { 'Content-Type': 'application/json' } : {}),
    ...(apiToken === null ? {} : { Authorization: `Bearer ${apiToken}` }),
    ...(csrfToken === null ? {} : { 'x-phasewire-csrf': csrfToken }),
  }
}
