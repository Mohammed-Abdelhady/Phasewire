import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { VisualNodeKind, VisualTemplate } from '@phasewire/core'
import { InvalidArgumentError, type Command } from 'commander'

import { printJson, printResult } from '../output.js'
import { projectContext } from '../runtime.js'
import { resolveTemplateInput, writeTemplateOutput } from '../template-files.js'

const nodeKinds = new Set<VisualNodeKind>([
  'section',
  'stack',
  'grid',
  'text',
  'metric',
  'list',
  'timeline',
  'evidence',
  'action',
])

const parseNodeKind = (value: string): VisualNodeKind => {
  if (nodeKinds.has(value as VisualNodeKind)) return value as VisualNodeKind
  throw new InvalidArgumentError(`Kind must be one of: ${[...nodeKinds].join(', ')}`)
}

const readTemplate = async (projectRoot: string, input: string): Promise<VisualTemplate> => {
  const path = await resolveTemplateInput(projectRoot, input)
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('id' in parsed) ||
    !('version' in parsed)
  ) {
    throw new Error(`Invalid template file: ${input}`)
  }
  return parsed as VisualTemplate
}

const templateJson = (template: VisualTemplate): string => `${JSON.stringify(template, null, 2)}\n`

const addCreateCommand = (templates: Command): void => {
  templates
    .command('create')
    .argument('<id>')
    .requiredOption('--name <name>', 'Human-readable template name')
    .requiredOption('--description <text>', 'Template purpose')
    .option('--binding <path>', 'Primary workflow projection binding', 'status')
    .option('--kind <kind>', 'Primary visual node kind', parseNodeKind, 'section')
    .option('--version <version>', 'Semantic template version', '1.0.0')
    .option('--output <file>', 'Project-confined output file')
    .option('--force', 'Replace an existing regular output file')
    .action(
      async (
        id: string,
        options: {
          binding: string
          description: string
          force?: boolean
          kind: VisualNodeKind
          name: string
          output?: string
          version: string
        },
        command: Command,
      ) => {
        const context = await projectContext(command)
        const template = context.core.scaffoldTemplate({
          id,
          name: options.name,
          description: options.description,
          primaryBinding: options.binding,
          primaryKind: options.kind,
          version: options.version,
        })
        const issues = context.core.validateTemplate(template)
        if (issues.length > 0)
          throw new Error(`Template scaffold is invalid:\n${issues.join('\n')}`)
        const output =
          options.output ??
          resolve(context.root, '.phasewire', 'template-drafts', `${id}@${options.version}.json`)
        const path = await writeTemplateOutput(
          context.root,
          output,
          templateJson(template),
          options.force ?? false,
        )
        printResult(
          { path, template },
          context.json,
          () => `Created ${id}@${options.version} at ${path}`,
        )
      },
    )
}

const addReadCommands = (templates: Command): void => {
  templates
    .command('search')
    .argument('[query]')
    .action(async (query: string | undefined, _options: object, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.searchTemplates(query)
      printResult(value, context.json, (result) => JSON.stringify(result, null, 2))
    })

  templates
    .command('add')
    .argument('<file>')
    .action(async (file: string, _options: object, command: Command) => {
      const context = await projectContext(command)
      const template = await readTemplate(context.root, file)
      const issues = context.core.validateTemplate(template)
      if (issues.length > 0) throw new Error(`Template is invalid:\n${issues.join('\n')}`)
      const path = await context.core.installTemplate(template)
      const lock = await context.core.pinTemplate(template.id, template.version)
      printResult(
        { lock, path, template },
        context.json,
        () => `Installed and pinned ${template.id}@${template.version} at ${path}`,
      )
    })

  templates
    .command('validate')
    .argument('<file>')
    .action(async (file: string, _options: object, command: Command) => {
      const context = await projectContext(command)
      const template = await readTemplate(context.root, file)
      const issues = context.core.validateTemplate(template)
      const value = { ok: issues.length === 0, issues }
      printResult(value, context.json, () => (value.ok ? 'Template is valid.' : issues.join('\n')))
      if (!value.ok) process.exitCode = 1
    })
}

const addOutputCommands = (templates: Command): void => {
  templates
    .command('compose')
    .argument('<base-file>')
    .argument('<overlay-file>')
    .option('--output <file>', 'Write composed template to a project-confined file')
    .option('--force', 'Replace an existing regular output file')
    .action(
      async (
        baseFile: string,
        overlayFile: string,
        options: { force?: boolean; output?: string },
        command: Command,
      ) => {
        const context = await projectContext(command)
        const composed = context.core.composeTemplates(
          await readTemplate(context.root, baseFile),
          await readTemplate(context.root, overlayFile),
        )
        if (options.output === undefined) return printJson(composed)
        const path = await writeTemplateOutput(
          context.root,
          options.output,
          templateJson(composed),
          options.force ?? false,
        )
        printResult({ path, template: composed }, context.json, () => path)
      },
    )

  templates
    .command('export')
    .argument('<id>')
    .option('--version <version>', 'Template version')
    .option('--output <file>', 'Write exported template to a project-confined file')
    .option('--force', 'Replace an existing regular output file')
    .action(
      async (
        id: string,
        options: { force?: boolean; output?: string; version?: string },
        command: Command,
      ) => {
        const context = await projectContext(command)
        const template = await context.core.getTemplate(id, options.version)
        if (template === undefined) throw new Error(`Template not found: ${id}`)
        if (options.output === undefined) return printJson(template)
        const path = await writeTemplateOutput(
          context.root,
          options.output,
          templateJson(template),
          options.force ?? false,
        )
        printResult({ path, template }, context.json, () => path)
      },
    )
}

export const addTemplateCommands = (program: Command): void => {
  const templates = program.command('templates').description('Manage declarative visual templates')
  addCreateCommand(templates)
  addReadCommands(templates)
  addOutputCommands(templates)
}
