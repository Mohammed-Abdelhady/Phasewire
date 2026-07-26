import { describe, expect, it } from 'vitest'

import {
  isAllowedHostHeader,
  isAllowedOriginHeader,
  isExactLoopbackOrigin,
  isLoopbackHostname,
} from './security.js'

describe('loopback request boundary', () => {
  it('accepts loopback hosts and rejects public or malformed hosts', () => {
    expect(isLoopbackHostname('127.0.0.42')).toBe(true)
    expect(isAllowedHostHeader('localhost:4317')).toBe(true)
    expect(isAllowedHostHeader('[::1]:4317')).toBe(true)
    expect(isAllowedHostHeader('phasewire.example')).toBe(false)
    expect(isAllowedHostHeader(undefined)).toBe(false)
  })

  it('accepts only loopback web origins when an Origin header is present', () => {
    expect(isAllowedOriginHeader(undefined)).toBe(true)
    expect(isAllowedOriginHeader('http://127.0.0.1:4317')).toBe(true)
    expect(isAllowedOriginHeader('https://localhost:4317')).toBe(true)
    expect(isAllowedOriginHeader('https://example.com')).toBe(false)
  })

  it('requires the interactive origin to match the exact loopback Host', () => {
    expect(isExactLoopbackOrigin('http://localhost:4317', 'localhost:4317')).toBe(true)
    expect(isExactLoopbackOrigin('http://localhost:9999', 'localhost:4317')).toBe(false)
    expect(isExactLoopbackOrigin(undefined, 'localhost:4317')).toBe(false)
  })
})
