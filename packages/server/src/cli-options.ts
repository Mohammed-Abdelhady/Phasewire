export interface ServiceCliOptions {
  readonly port?: number
  readonly projectRoot?: string
}

const valueAfter = (values: readonly string[], flag: string): string | undefined => {
  const index = values.indexOf(flag)
  return index === -1 ? undefined : values[index + 1]
}

const parsePort = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const port = Number.parseInt(raw, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port '${raw}'. Expected an integer from 1 to 65535.`)
  }
  return port
}

export const parseServiceCliOptions = (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServiceCliOptions => {
  const projectRoot = valueAfter(argv, '--project-root') ?? env.PHASEWIRE_PROJECT_ROOT
  const port = parsePort(valueAfter(argv, '--port') ?? env.PHASEWIRE_PORT)
  return {
    ...(projectRoot === undefined ? {} : { projectRoot }),
    ...(port === undefined ? {} : { port }),
  }
}
