import { createInterface, type Interface } from 'node:readline'

export type PromptIo = {
  readonly input?: NodeJS.ReadableStream
  readonly output?: NodeJS.WritableStream
}

const withInterface = async <T>(
  run: (rl: Interface) => Promise<T>,
  io: PromptIo = {},
): Promise<T> => {
  const rl = createInterface({
    input: io.input ?? process.stdin,
    output: io.output ?? process.stdout,
    terminal: true,
  })
  try {
    return await run(rl)
  } finally {
    rl.close()
  }
}

const question = (rl: Interface, prompt: string): Promise<string> =>
  new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer)
    })
  })

const formatDefault = (value: string | undefined): string =>
  value === undefined || value.length === 0 ? '' : ` [${value}]`

export const askText = async (
  label: string,
  defaultValue?: string,
  io: PromptIo = {},
): Promise<string> =>
  withInterface(async (rl) => {
    const answer = (await question(rl, `${label}${formatDefault(defaultValue)}: `)).trim()
    if (answer.length > 0) return answer
    if (defaultValue !== undefined) return defaultValue
    return ''
  }, io)

export const askConfirm = async (
  label: string,
  defaultValue = true,
  io: PromptIo = {},
): Promise<boolean> =>
  withInterface(async (rl) => {
    const hint = defaultValue ? 'Y/n' : 'y/N'
    const answer = (await question(rl, `${label} (${hint}): `)).trim().toLowerCase()
    if (answer.length === 0) return defaultValue
    if (answer === 'y' || answer === 'yes') return true
    if (answer === 'n' || answer === 'no') return false
    return defaultValue
  }, io)

export const askSelect = async (
  label: string,
  choices: readonly string[],
  defaultValue?: string,
  io: PromptIo = {},
): Promise<string> => {
  if (choices.length === 0) throw new Error('askSelect requires at least one choice')
  const fallback =
    defaultValue !== undefined && choices.includes(defaultValue) ? defaultValue : choices[0]!
  return withInterface(async (rl) => {
    const output = io.output ?? process.stdout
    output.write(`${label}\n`)
    choices.forEach((choice, index) => {
      const marker = choice === fallback ? '*' : ' '
      output.write(`  ${marker} ${String(index + 1)}. ${choice}\n`)
    })
    const answer = (await question(rl, `Select 1-${String(choices.length)}${formatDefault(fallback)}: `)).trim()
    if (answer.length === 0) return fallback
    const asNumber = Number.parseInt(answer, 10)
    if (Number.isSafeInteger(asNumber) && asNumber >= 1 && asNumber <= choices.length) {
      return choices[asNumber - 1]!
    }
    if (choices.includes(answer)) return answer
    return fallback
  }, io)
}

export const askMultiSelect = async (
  label: string,
  choices: readonly string[],
  defaultValues: readonly string[] = choices,
  io: PromptIo = {},
): Promise<readonly string[]> => {
  if (choices.length === 0) throw new Error('askMultiSelect requires at least one choice')
  const defaults = defaultValues.filter((value) => choices.includes(value))
  const fallback = defaults.length > 0 ? defaults : [...choices]
  return withInterface(async (rl) => {
    const output = io.output ?? process.stdout
    output.write(`${label}\n`)
    choices.forEach((choice, index) => {
      const marker = fallback.includes(choice) ? '*' : ' '
      output.write(`  ${marker} ${String(index + 1)}. ${choice}\n`)
    })
    output.write('  Enter comma-separated numbers or names, "all", or blank for defaults.\n')
    const answer = (
      await question(rl, `Select [default: ${fallback.join(', ')}]: `)
    )
      .trim()
      .toLowerCase()
    if (answer.length === 0) return fallback
    if (answer === 'all' || answer === '*') return [...choices]
    const selected: string[] = []
    for (const token of answer.split(/[,\s]+/u).filter((part) => part.length > 0)) {
      const asNumber = Number.parseInt(token, 10)
      if (Number.isSafeInteger(asNumber) && asNumber >= 1 && asNumber <= choices.length) {
        const choice = choices[asNumber - 1]!
        if (!selected.includes(choice)) selected.push(choice)
        continue
      }
      const match = choices.find((choice) => choice.toLowerCase() === token)
      if (match !== undefined && !selected.includes(match)) selected.push(match)
    }
    return selected.length > 0 ? selected : fallback
  }, io)
}
