import { timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

import type { FastifyRequest } from 'fastify'

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '::1', 'localhost'])

const stripIpv6Brackets = (hostname: string): string =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

export const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = stripIpv6Brackets(hostname.toLowerCase().replace(/\.$/u, ''))
  if (LOOPBACK_HOSTNAMES.has(normalized)) return true
  return isIP(normalized) === 4 && normalized.startsWith('127.')
}

const parseHost = (host: string): string | undefined => {
  try {
    return new URL(`http://${host}`).hostname
  } catch {
    return undefined
  }
}

export const isAllowedHostHeader = (host: string | undefined): boolean => {
  if (host === undefined) return false
  const hostname = parseHost(host)
  return hostname !== undefined && isLoopbackHostname(hostname)
}

export const isAllowedOriginHeader = (origin: string | undefined): boolean => {
  if (origin === undefined || origin === 'null') return true
  try {
    const url = new URL(origin)
    return (url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackHostname(url.hostname)
  } catch {
    return false
  }
}

export const tokensMatch = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

const cookieToken = (cookieHeader: string | undefined): string | undefined => {
  if (cookieHeader === undefined) return undefined
  for (const part of cookieHeader.split(';')) {
    const [name, ...rawValue] = part.trim().split('=')
    if (name === 'phasewire_session') {
      try {
        return decodeURIComponent(rawValue.join('='))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

const cookieValue = (cookieHeader: string | undefined, expectedName: string): string | undefined => {
  if (cookieHeader === undefined) return undefined
  for (const part of cookieHeader.split(';')) {
    const [name, ...rawValue] = part.trim().split('=')
    if (name !== expectedName) continue
    try {
      return decodeURIComponent(rawValue.join('='))
    } catch {
      return undefined
    }
  }
  return undefined
}

const bearerToken = (authorization: string | undefined): string | undefined => {
  if (authorization === undefined) return undefined
  const [scheme, token] = authorization.split(' ', 2)
  return scheme?.toLowerCase() === 'bearer' && token !== undefined ? token : undefined
}

const queryToken = (request: FastifyRequest): string | undefined => {
  if (!request.url.startsWith('/api/updates') && !request.url.startsWith('/api/events/stream')) {
    return undefined
  }
  const query = request.query
  if (typeof query !== 'object' || query === null || !('token' in query)) return undefined
  return typeof query.token === 'string' ? query.token : undefined
}

export const isAuthenticatedRequest = (request: FastifyRequest, expectedToken: string): boolean => {
  const headerToken = request.headers['x-phasewire-token']
  const suppliedToken =
    bearerToken(request.headers.authorization) ??
    (typeof headerToken === 'string' ? headerToken : undefined) ??
    cookieToken(request.headers.cookie) ??
    queryToken(request)
  return suppliedToken !== undefined && tokensMatch(suppliedToken, expectedToken)
}

export const isHarnessAuthenticatedRequest = (
  request: FastifyRequest,
  expectedToken: string,
): boolean => {
  const headerToken = request.headers['x-phasewire-token']
  const suppliedToken =
    bearerToken(request.headers.authorization) ??
    (typeof headerToken === 'string' ? headerToken : undefined)
  return suppliedToken !== undefined && tokensMatch(suppliedToken, expectedToken)
}

export const isExactLoopbackOrigin = (
  origin: string | undefined,
  host: string | undefined,
): boolean => {
  if (origin === undefined || host === undefined || !isAllowedHostHeader(host)) return false
  try {
    const parsed = new URL(origin)
    const expected = new URL(`http://${host}`)
    return parsed.protocol === 'http:' && parsed.origin.toLowerCase() === expected.origin.toLowerCase()
  } catch {
    return false
  }
}

export const isInteractiveRequest = (
  request: FastifyRequest,
  expectedSessionToken: string,
  expectedCsrfToken: string,
): boolean => {
  const session = cookieValue(request.headers.cookie, 'phasewire_session')
  const csrfCookie = cookieValue(request.headers.cookie, 'phasewire_csrf')
  const csrfHeader = request.headers['x-phasewire-csrf']
  return (
    session !== undefined &&
    csrfCookie !== undefined &&
    typeof csrfHeader === 'string' &&
    tokensMatch(session, expectedSessionToken) &&
    tokensMatch(csrfCookie, expectedCsrfToken) &&
    tokensMatch(csrfHeader, expectedCsrfToken) &&
    isExactLoopbackOrigin(request.headers.origin, request.headers.host)
  )
}
