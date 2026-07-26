import { homedir } from 'node:os'
import { mkdir, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { canonicalJson } from '../canonical.js'
import { PhasewireError } from '../errors.js'
import { pathExists, readJson, writeJsonImmutable, writeJsonReplace } from '../files.js'
import { assertSecurePath, assertSecurePhasewireRoot, assertSecureRoot, assertSecureRootEntry } from '../paths.js'
import type {
  JsonObject, TemplateDescriptor, TemplateLayer, TemplateLock, TemplatePin, TemplateRegistryOptions, VisualNode,
  VisualTemplate,
} from '../types.js'
import { BUILTIN_VISUAL_TEMPLATES } from './builtins.js'
import { createVisualTemplate } from './factory.js'
import { assertVisualTemplate, validateVisualTemplate } from './validation.js'

function asJsonObject(value: object): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

function lockAsJson(lock: TemplateLock): JsonObject {
  return {
    schemaVersion: 1,
    templates: Object.fromEntries(Object.entries(lock.templates).map(([id, pin]) => [id, { ...pin }])),
  }
}

function pinFor(descriptor: TemplateDescriptor): TemplatePin {
  return {
    version: descriptor.template.version,
    integrity: descriptor.template.integrity,
    layer: descriptor.layer,
  }
}

function matchesPin(descriptor: TemplateDescriptor, pin: TemplatePin): boolean {
  return descriptor.template.version === pin.version &&
    descriptor.template.integrity === pin.integrity && descriptor.layer === pin.layer
}

function lockedPinFrom(value: unknown): TemplatePin | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const candidate = value as Readonly<Record<string, unknown>>
  if (typeof candidate.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(candidate.version) ||
    typeof candidate.integrity !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(candidate.integrity) ||
    !['builtin', 'user', 'project'].includes(String(candidate.layer))) return undefined
  return {
    version: candidate.version,
    integrity: candidate.integrity as `sha256:${string}`,
    layer: candidate.layer as TemplateLayer,
  }
}

function mergeNodes(base: readonly VisualNode[], overlay: readonly VisualNode[]): readonly VisualNode[] {
  const overlayById = new Map(overlay.map((node) => [node.id, node]))
  const merged = base.map((node) => {
    const replacement = overlayById.get(node.id)
    if (replacement === undefined) return node
    overlayById.delete(node.id)
    if (node.children === undefined || replacement.children === undefined) return replacement
    return { ...replacement, children: mergeNodes(node.children, replacement.children) }
  })
  return [...merged, ...overlayById.values()]
}

export class TemplateRegistry {
  private readonly projectRoot: string
  private readonly phasewireRoot: string
  private readonly projectTemplateRoot: string
  private readonly userRoot: string
  private readonly lockPath: string

  public constructor(projectRoot: string, options: TemplateRegistryOptions = {}) {
    this.projectRoot = resolve(projectRoot)
    assertSecureRootEntry(this.projectRoot)
    this.phasewireRoot = resolve(this.projectRoot, '.phasewire')
    this.projectTemplateRoot = join(this.phasewireRoot, 'templates')
    this.userRoot = resolve(options.userTemplateRoot ?? join(homedir(), '.phasewire', 'templates'))
    this.lockPath = join(this.phasewireRoot, 'template-lock.json')
  }

  public async initialize(): Promise<void> {
    await this.secureProjectPath(this.projectTemplateRoot)
    const builtinPins = Object.fromEntries(BUILTIN_VISUAL_TEMPLATES.map((template) => [
      template.id, pinFor({ template, layer: 'builtin' }),
    ]))
    if (!(await pathExists(this.lockPath))) {
      await writeJsonImmutable(this.lockPath, lockAsJson({ schemaVersion: 1, templates: builtinPins }), this.projectRoot)
      return
    }
    const current = await this.readLock()
    const merged = { ...builtinPins, ...current.templates }
    if (canonicalJson(asJsonObject(merged)) !== canonicalJson(asJsonObject(current.templates))) {
      await writeJsonReplace(this.lockPath, lockAsJson({ schemaVersion: 1, templates: merged }), this.projectRoot)
    }
  }

  public validate(value: unknown): readonly string[] {
    return validateVisualTemplate(value)
  }

  public async install(template: VisualTemplate, layer: Exclude<TemplateLayer, 'builtin'> = 'project'): Promise<string> {
    assertVisualTemplate(template)
    const root = layer === 'user' ? this.userRoot : this.projectTemplateRoot
    await this.secureLayerRoot(root)
    const path = join(root, `${template.id}@${template.version}.json`)
    await assertSecurePath(root, path)
    if (await pathExists(path)) {
      const existing = await readJson(path, root)
      assertVisualTemplate(existing)
      if (canonicalJson(asJsonObject(existing)) !== canonicalJson(asJsonObject(template))) {
        throw new PhasewireError(`Template ${template.id}@${template.version} is immutable`, 'TEMPLATE_VERSION_CONFLICT')
      }
      return path
    }
    await writeJsonImmutable(path, asJsonObject(template), root)
    return path
  }

  public async discover(): Promise<readonly TemplateDescriptor[]> {
    const descriptors: TemplateDescriptor[] = BUILTIN_VISUAL_TEMPLATES.map((template) => ({ template, layer: 'builtin' }))
    for (const [root, layer] of [[this.userRoot, 'user'], [this.projectTemplateRoot, 'project']] as const) {
      if (!(await pathExists(root))) continue
      await this.secureLayerRoot(root)
      for (const file of (await readdir(root)).filter((name) => name.endsWith('.json')).sort()) {
        const path = join(root, file)
        const value = await readJson(path, root)
        assertVisualTemplate(value)
        descriptors.push({ template: value, layer, path })
      }
    }
    return descriptors
  }

  public async list(): Promise<readonly VisualTemplate[]> {
    const groups = new Map<string, TemplateDescriptor[]>()
    for (const descriptor of await this.discover()) {
      const key = `${descriptor.template.id}@${descriptor.template.version}`
      groups.set(key, [...(groups.get(key) ?? []), descriptor])
    }
    const lock = await this.readLock()
    const templates = [...groups.values()].map((descriptors) => {
      const first = descriptors[0]
      if (first === undefined) throw new PhasewireError('Template group is empty', 'INVALID_TEMPLATE')
      const pin = lock.templates[first.template.id]
      if (pin?.version === first.template.version) {
        const pinned = descriptors.find((descriptor) => matchesPin(descriptor, pin))
        if (pinned !== undefined) return pinned.template
      }
      if (descriptors.length === 1) return first.template
      throw new PhasewireError(`Template ${first.template.id}@${first.template.version} is ambiguous`, 'TEMPLATE_AMBIGUOUS')
    })
    return templates.sort((left, right) => left.id.localeCompare(right.id) || left.version.localeCompare(right.version))
  }

  public async get(id: string, version?: string): Promise<VisualTemplate | undefined> {
    const descriptors = (await this.discover()).filter((descriptor) => descriptor.template.id === id)
    if (version !== undefined) {
      const matching = descriptors.filter((descriptor) => descriptor.template.version === version)
      const pin = (await this.readLock()).templates[id]
      if (pin?.version === version) return matching.find((descriptor) => matchesPin(descriptor, pin))?.template
      if (matching.length > 1) throw new PhasewireError(`Template ${id}@${version} is ambiguous`, 'TEMPLATE_AMBIGUOUS')
      return matching[0]?.template
    }
    const pin = (await this.readLock()).templates[id]
    if (pin === undefined) return undefined
    return descriptors.find((descriptor) => matchesPin(descriptor, pin))?.template
  }

  public async pin(id: string, version: string): Promise<TemplateLock> {
    const descriptor = (await this.discover()).filter((candidate) =>
      candidate.template.id === id && candidate.template.version === version).at(-1)
    if (descriptor === undefined) throw new PhasewireError(`Template ${id}@${version} is not installed`, 'TEMPLATE_NOT_FOUND')
    const current = await this.readLock()
    const next: TemplateLock = { schemaVersion: 1, templates: { ...current.templates, [id]: pinFor(descriptor) } }
    await writeJsonReplace(this.lockPath, lockAsJson(next), this.projectRoot)
    return next
  }

  public async resolve(id: string): Promise<VisualTemplate | undefined> {
    return this.get(id)
  }

  public compose(base: VisualTemplate, overlay: VisualTemplate): VisualTemplate {
    assertVisualTemplate(base)
    assertVisualTemplate(overlay)
    const { integrity: _baseIntegrity, ...baseBody } = base
    const { integrity: _overlayIntegrity, ...overlayBody } = overlay
    void _baseIntegrity
    void _overlayIntegrity
    return createVisualTemplate({
      ...baseBody, ...overlayBody, regions: mergeNodes(base.regions, overlay.regions),
      accessibility: { ...base.accessibility, ...overlay.accessibility },
    })
  }

  public async readLock(): Promise<TemplateLock> {
    await this.secureProjectPath(this.lockPath)
    const value = await readJson(this.lockPath, this.projectRoot)
    if (typeof value !== 'object' || value === null || !('schemaVersion' in value) || value.schemaVersion !== 1 ||
      !('templates' in value) || typeof value.templates !== 'object' || value.templates === null || Array.isArray(value.templates)) {
      throw new PhasewireError('Invalid .phasewire/template-lock.json', 'INVALID_TEMPLATE_LOCK')
    }
    const descriptors = await this.discover()
    const templates: Record<string, TemplatePin> = {}
    for (const [id, rawPin] of Object.entries(value.templates)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
        throw new PhasewireError('Invalid template lock entry', 'INVALID_TEMPLATE_LOCK')
      }
      if (typeof rawPin === 'string') {
        const matching = descriptors.filter((descriptor) =>
          descriptor.template.id === id && descriptor.template.version === rawPin)
        const descriptor = matching.find((candidate) => candidate.layer === 'builtin') ?? matching.at(-1)
        if (descriptor === undefined) throw new PhasewireError('Locked template is not installed', 'TEMPLATE_NOT_FOUND')
        templates[id] = pinFor(descriptor)
        continue
      }
      const pin = lockedPinFrom(rawPin)
      if (pin === undefined) {
        throw new PhasewireError('Invalid template lock entry', 'INVALID_TEMPLATE_LOCK')
      }
      templates[id] = pin
    }
    return { schemaVersion: 1, templates }
  }

  private async secureProjectPath(path: string): Promise<void> {
    await assertSecurePhasewireRoot(this.projectRoot, this.phasewireRoot)
    await assertSecurePath(this.projectRoot, path)
  }

  private async secureLayerRoot(root: string): Promise<void> {
    if (root === this.projectTemplateRoot) {
      await this.secureProjectPath(root)
      return
    }
    if (!(await pathExists(root))) {
      const parent = resolve(root, '..')
      await assertSecureRoot(parent)
      await assertSecurePath(parent, root)
      await mkdir(root, { recursive: true })
    }
    await assertSecureRoot(root)
  }
}
