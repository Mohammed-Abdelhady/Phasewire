import { describe, expect, it } from 'vitest'

import { parseServiceCliOptions } from './cli-options.js'

describe('parseServiceCliOptions', () => {
  it('reads project root and port from argv', () => {
    expect(
      parseServiceCliOptions(
        ['node', 'index.js', '--project-root', '/tmp/project', '--port', '4317'],
        {},
      ),
    ).toEqual({ port: 4317, projectRoot: '/tmp/project' })
  })

  it('falls back to environment variables', () => {
    expect(
      parseServiceCliOptions([], {
        PHASEWIRE_PORT: '4317',
        PHASEWIRE_PROJECT_ROOT: '/tmp/env-project',
      }),
    ).toEqual({ port: 4317, projectRoot: '/tmp/env-project' })
  })

  it('rejects invalid ports', () => {
    expect(() => parseServiceCliOptions(['--port', '0'], {})).toThrow(/Invalid port/)
    expect(() => parseServiceCliOptions(['--port', 'abc'], {})).toThrow(/Invalid port/)
  })
})
