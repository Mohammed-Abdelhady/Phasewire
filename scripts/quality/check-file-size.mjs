import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const MAX_LINES = 350
const ROOT = process.cwd()
const INCLUDED_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hyperflow',
  '.phasewire',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
])
const IGNORED_FILES = new Set(['package-lock.json'])

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(path))
    else if (entry.isFile() && !IGNORED_FILES.has(entry.name) && INCLUDED_EXTENSIONS.has(extname(entry.name))) {
      files.push(path)
    }
  }
  return files
}

const violations = []
for (const file of await collectFiles(ROOT)) {
  const contents = await readFile(file, 'utf8')
  const lineCount = contents === '' ? 0 : contents.split(/\r?\n/u).length
  if (lineCount > MAX_LINES) {
    violations.push({ file: relative(ROOT, file), lineCount })
  }
}

if (violations.length > 0) {
  process.stderr.write(`Files exceed the ${MAX_LINES}-line limit:\n`)
  for (const violation of violations.sort((left, right) => right.lineCount - left.lineCount)) {
    process.stderr.write(`  ${violation.lineCount}  ${violation.file}\n`)
  }
  process.exitCode = 1
} else {
  process.stdout.write(`All authored files are within ${MAX_LINES} lines.\n`)
}

