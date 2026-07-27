#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shipRoot = join(root, 'packages', 'phasewire')
const shipDist = join(shipRoot, 'dist')
const shipWeb = join(shipRoot, 'web')
const shipSchemas = join(shipRoot, 'schemas')

const sources = {
  core: join(root, 'packages', 'core', 'dist'),
  server: join(root, 'packages', 'server', 'dist'),
  cli: join(root, 'packages', 'cli', 'dist'),
  schemas: join(root, 'packages', 'core', 'schemas'),
  web: join(root, 'apps', 'web', 'dist'),
}

const packageTargets = {
  '@phasewire/core': 'core/index.js',
  '@phasewire/server/core-facade': 'server/core-facade.js',
  '@phasewire/server/launcher': 'server/launcher.js',
  '@phasewire/server': 'server/index.js',
}

const isShipSourceFile = (name) => {
  const fileName = String(name)
  return (
    !fileName.endsWith('.test.js') &&
    !fileName.endsWith('.test.d.ts') &&
    !fileName.endsWith('.test.d.ts.map') &&
    !fileName.endsWith('.test.js.map') &&
    fileName !== '.tsbuildinfo'
  )
}

const ensureDir = async (path) => {
  await mkdir(path, { recursive: true })
}

const pathExists = async (path) => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full)))
      continue
    }
    if (entry.isFile() && isShipSourceFile(entry.name)) files.push(full)
  }
  return files
}

const copyTreeFiltered = async (from, to) => {
  if (!(await pathExists(from))) {
    throw new Error(`Missing pack source: ${from}`)
  }
  await ensureDir(to)
  const files = await listFiles(from)
  for (const file of files) {
    const relativePath = relative(from, file)
    const destination = join(to, relativePath)
    await ensureDir(dirname(destination))
    await cp(file, destination)
  }
}

const toPosix = (value) => String(value).split(sep).join('/')

const relativeImport = (fromFile, targetWithinDist) => {
  const fromDir = dirname(fromFile)
  const target = join(shipDist, ...String(targetWithinDist).split('/'))
  let rel = toPosix(relative(fromDir, target))
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel
}

const rewriteImports = (source, filePath) => {
  const ordered = Object.keys(packageTargets).sort((a, b) => b.length - a.length)
  let next = String(source)
  for (const specifier of ordered) {
    const target = packageTargets[/** @type {keyof typeof packageTargets} */ (specifier)]
    const replacement = relativeImport(filePath, target)
    const pattern = new RegExp(
      `(from\\s+|import\\s*\\(\\s*)(['"])${specifier.replaceAll('/', '\\/')}\\2`,
      'gu',
    )
    next = next.replace(pattern, `$1$2${replacement}$2`)
  }
  return next
}

const rewriteTree = async (directory) => {
  const files = await listFiles(directory)
  for (const file of files) {
    if (!String(file).endsWith('.js')) continue
    const original = await readFile(file, 'utf8')
    const rewritten = rewriteImports(original, file)
    if (rewritten !== original) await writeFile(file, rewritten, 'utf8')
  }
}

const assertBuilt = async () => {
  const required = [
    join(sources.cli, 'index.js'),
    join(sources.server, 'index.js'),
    join(sources.core, 'index.js'),
    join(sources.web, 'index.html'),
  ]
  for (const path of required) {
    if (!(await pathExists(path))) {
      throw new Error(`Build artifact missing before pack: ${path}. Run npm run build first.`)
    }
  }
}

const main = async () => {
  await assertBuilt()

  await rm(shipDist, { recursive: true, force: true })
  await rm(shipWeb, { recursive: true, force: true })
  await rm(shipSchemas, { recursive: true, force: true })

  await copyTreeFiltered(sources.core, join(shipDist, 'core'))
  await copyTreeFiltered(sources.server, join(shipDist, 'server'))
  await copyTreeFiltered(sources.cli, join(shipDist, 'cli'))
  await cp(sources.schemas, shipSchemas, { recursive: true })
  await cp(sources.web, shipWeb, { recursive: true })

  await rewriteTree(shipDist)

  const cliEntry = join(shipDist, 'cli', 'index.js')
  const webIndex = join(shipWeb, 'index.html')
  if (!(await pathExists(cliEntry))) throw new Error(`Pack failed: missing ${cliEntry}`)
  if (!(await pathExists(webIndex))) throw new Error(`Pack failed: missing ${webIndex}`)

  process.stdout.write(
    [
      'phasewire ship package ready',
      `  ${relative(root, cliEntry)}`,
      `  ${relative(root, webIndex)}`,
      `  ${relative(root, shipSchemas)}`,
    ].join('\n') + '\n',
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
