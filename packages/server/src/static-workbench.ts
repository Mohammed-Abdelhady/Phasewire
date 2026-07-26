import { realpathSync } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import fastifyStatic from '@fastify/static'
import type { FastifyInstance, FastifyReply } from 'fastify'

const outsideRoot = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate)
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)
}

const containsDotSegment = (path: string): boolean =>
  path.split(/[\\/]/u).some((segment) => segment.startsWith('.') && segment !== '')

type PathDisposition = 'allowed' | 'denied' | 'missing'

const pathDisposition = async (root: string, pathName: string): Promise<PathDisposition> => {
  if (containsDotSegment(pathName)) return 'denied'
  const relativePath = pathName.replace(/^[/\\]+/u, '')
  const lexicalPath = resolve(root, relativePath)
  if (outsideRoot(root, lexicalPath)) return 'denied'
  try {
    return outsideRoot(root, await realpath(lexicalPath)) ? 'denied' : 'allowed'
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return 'missing'
    return 'denied'
  }
}

const notFound = (reply: FastifyReply): FastifyReply => reply.code(404).send({ error: 'Not found' })

export const registerStaticWorkbench = async (
  app: FastifyInstance,
  webRoot: string | undefined,
): Promise<void> => {
  if (webRoot === undefined) return

  let root: string
  try {
    root = await realpath(webRoot)
    if (!(await stat(root)).isDirectory()) return
  } catch {
    return
  }

  await app.register(fastifyStatic, {
    root,
    decorateReply: true,
    dotfiles: 'deny',
    maxAge: '1h',
    immutable: false,
    allowedPath: (pathName) => {
      if (containsDotSegment(pathName)) return false
      const relativePath = pathName.replace(/^[/\\]+/u, '')
      const target = resolve(root, relativePath)
      if (outsideRoot(root, target)) return false
      try {
        const metadata = realpathSync(target)
        return !outsideRoot(root, metadata)
      } catch {
        return false
      }
    },
  })

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) return notFound(reply)
    const pathName = new URL(request.url, 'http://phasewire.local').pathname
    const disposition = await pathDisposition(root, pathName)
    if (disposition !== 'missing') return notFound(reply)
    if (!request.headers.accept?.includes('text/html')) return notFound(reply)
    return reply.header('cache-control', 'no-store').sendFile('index.html')
  })
}
