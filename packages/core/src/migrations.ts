import { readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

import { doctorProject } from './doctor.js'
import { PhasewireError } from './errors.js'
import { pathExists, readJson, readTextFile, writeJsonReplace } from './files.js'
import { assertSecurePath, assertSecurePhasewireRoot } from './paths.js'
import { configAsJson } from './store-helpers.js'
import type { JsonValue, MigrationResult, PhasewireConfig, ProjectExport } from './types.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return undefined
  return [...new Set(value)]
}

export async function readProjectSchemaVersion(projectRoot: string): Promise<number | undefined> {
  const absoluteRoot = resolve(projectRoot)
  const phasewireRoot = join(absoluteRoot, '.phasewire')
  await assertSecurePhasewireRoot(absoluteRoot, phasewireRoot)
  const configPath = join(phasewireRoot, 'config.json')
  if (!(await pathExists(configPath))) return undefined
  const value = await readJson(configPath, absoluteRoot)
  if (!isObject(value) || !Number.isSafeInteger(value.schemaVersion) || Number(value.schemaVersion) < 0) {
    throw new PhasewireError('Project config has no supported numeric schemaVersion', 'INVALID_CONFIG')
  }
  return Number(value.schemaVersion)
}

function migrateConfigV0(value: unknown): PhasewireConfig {
  if (!isObject(value) || value.schemaVersion !== 0 || typeof value.projectId !== 'string') {
    throw new PhasewireError('Invalid schema v0 config fixture', 'INVALID_CONFIG')
  }
  const defaultTemplateId = typeof value.defaultTemplateId === 'string'
    ? value.defaultTemplateId
    : typeof value.templateId === 'string' ? value.templateId : 'phasewire.default'
  const requiredValidations = strings(value.requiredValidations) ?? strings(value.requiredChecks) ?? []
  return { schemaVersion: 1, projectId: value.projectId, defaultTemplateId, requiredValidations }
}

export async function migrateProject(
  projectRoot: string,
  initialize: () => Promise<PhasewireConfig>,
): Promise<MigrationResult> {
  const absoluteRoot = resolve(projectRoot)
  const phasewireRoot = join(absoluteRoot, '.phasewire')
  const version = await readProjectSchemaVersion(absoluteRoot)
  if (version === undefined) {
    await initialize()
    return {
      fromVersion: 1, toVersion: 1, changed: false, readOnly: false,
      exportAvailable: true, diagnostics: await doctorProject(absoluteRoot),
    }
  }
  if (version > 1) {
    return {
      fromVersion: version, toVersion: version, changed: false, readOnly: true,
      exportAvailable: true, diagnostics: await doctorProject(absoluteRoot),
    }
  }
  if (version === 1) {
    return {
      fromVersion: 1, toVersion: 1, changed: false, readOnly: false,
      exportAvailable: true, diagnostics: await doctorProject(absoluteRoot),
    }
  }
  const configPath = join(phasewireRoot, 'config.json')
  const migrated = migrateConfigV0(await readJson(configPath, absoluteRoot))
  await writeJsonReplace(configPath, configAsJson(migrated), absoluteRoot)
  await initialize()
  return {
    fromVersion: 0, toVersion: 1, changed: true, readOnly: false,
    exportAvailable: true, diagnostics: await doctorProject(absoluteRoot),
  }
}

function blockedExportPath(path: string): boolean {
  const name = path.split('/').at(-1) ?? ''
  return name === '.env' || name.startsWith('.env.') || /\.(?:pem|key|crt)$/u.test(name)
}

async function collectExportFiles(
  projectRoot: string,
  directory: string,
  files: Record<string, JsonValue>,
): Promise<void> {
  await assertSecurePath(projectRoot, directory)
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const exportPath = relative(projectRoot, path).split('\\').join('/')
    if (entry.isSymbolicLink()) throw new PhasewireError(`Export path cannot be a symbolic link: ${exportPath}`, 'PATH_ESCAPE')
    if (entry.isDirectory()) {
      if (entry.name !== '.runtime') await collectExportFiles(projectRoot, path, files)
      continue
    }
    if (!entry.isFile() || blockedExportPath(exportPath)) continue
    const text = await readTextFile(path, projectRoot)
    try {
      files[exportPath] = JSON.parse(text) as JsonValue
    } catch {
      files[exportPath] = text
    }
  }
}

export async function exportProject(projectRoot: string): Promise<ProjectExport> {
  const absoluteRoot = resolve(projectRoot)
  const phasewireRoot = join(absoluteRoot, '.phasewire')
  await assertSecurePhasewireRoot(absoluteRoot, phasewireRoot)
  if (!(await pathExists(phasewireRoot))) throw new PhasewireError('Phasewire project is not initialized', 'PROJECT_NOT_INITIALIZED')
  const files: Record<string, JsonValue> = {}
  await collectExportFiles(absoluteRoot, phasewireRoot, files)
  return {
    schemaVersion: await readProjectSchemaVersion(absoluteRoot) ?? 1,
    exportedAt: new Date().toISOString(), projectRoot: '.', files,
  }
}
