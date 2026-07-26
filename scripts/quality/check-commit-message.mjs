import { readFile } from 'node:fs/promises'

const messagePath = process.argv[2]
if (messagePath === undefined) {
  process.stderr.write('Commit message path is required.\n')
  process.exitCode = 1
} else {
  const message = (await readFile(messagePath, 'utf8')).trim()
  const firstLine = message.split(/\r?\n/u)[0] ?? ''
  const conventional = /^(feat|fix|docs|refactor|test|chore|perf|style)(\([a-z0-9._-]+\))?!?: .+$/u
  if (!conventional.test(firstLine) || firstLine.length > 72) {
    process.stderr.write(
      'Commit message must use Conventional Commits, for example: feat(core): add workflow replay\n',
    )
    process.exitCode = 1
  }
}
