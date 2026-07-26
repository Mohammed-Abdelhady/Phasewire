import type { AdapterHost, AdapterSkill } from './catalog.js'

const hostLabel = (host: AdapterHost): string => {
  if (host === 'claude') return 'Claude Code'
  if (host === 'codex') return 'Codex'
  if (host === 'grok') return 'Grok'
  return 'Antigravity (Agy)'
}

const hostInvocation = (host: AdapterHost, skill: AdapterSkill): string => {
  if (host === 'claude') {
    return skill.id === 'phasewire' ? '/phasewire' : `/phasewire:${skill.id}`
  }
  if (host === 'agy') return skill.skillName
  return `$${skill.skillName}`
}

export const renderSkillMarkdown = (skill: AdapterSkill, host: AdapterHost): string => {
  const label = hostLabel(host)
  const invocation = hostInvocation(host, skill)
  const lines = [
    '---',
    `name: ${skill.skillName}`,
    'description: |',
    `  ${skill.description}`,
    `argument-hint: "${skill.argumentHint}"`,
    'version: 0.1.0',
    'license: MIT',
    `compatibility: ${label}; requires the phasewire CLI on PATH or via npm workspace script`,
    'tags: [phasewire, workflow, harness-adapter]',
    '---',
    '',
    `# ${skill.title}`,
    '',
    `Portable Phasewire adapter for **${label}**.`,
    '',
    '## Invocation',
    '',
    `- Host trigger: \`${invocation}\``,
    `- CLI shape: \`${skill.cli}\``,
    `- Current harness id to pass as \`--harness\`: \`${host}\``,
    '',
    '## Hard rules',
    '',
    '- Durable state lives under `.phasewire/`. Chat transcripts are never authoritative.',
    '- Keep the unique `phasewire` namespace. Do not add bare `/plan`, `/execute`, `/review`, or `/resume`.',
    '- Harness names are coordination identities, not authentication principals.',
    '- Blocking review findings require remediation plan → user approval → remediation execution → fresh review.',
    '- Phasewire never deploys. Do not run deploy commands from these adapters.',
    '- Prefer `phasewire ... --json` and summarize the machine-readable result for the user.',
    '',
    '## Steps',
    '',
    ...skill.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Recovery',
    '',
    'If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.',
    '',
  ]
  return `${lines.join('\n')}\n`
}

export const renderClaudeCommandMarkdown = (skill: AdapterSkill): string => {
  const body = [
    '---',
    `description: ${skill.description.split('\n')[0] ?? skill.description}`,
    '---',
    '',
    `# ${skill.title}`,
    '',
    'Follow the Phasewire skill contract for this host.',
    '',
    '1. Detect the current host as `claude`.',
    `2. Execute the \`${skill.cli.replace('<host>', 'claude')}\` flow using the phasewire CLI.`,
    '3. Keep the `phasewire` namespace and never deploy.',
    '',
    'If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.',
    '',
  ]
  return `${body.join('\n')}\n`
}

export const renderPluginJson = (): string =>
  `${JSON.stringify(
    {
      name: 'phasewire',
      version: '0.1.0',
      description:
        'Harness adapters for Phasewire workflows: plan, execute, review, resume, status, handoff, and open across Claude Code, Codex, Grok, and Antigravity.',
      author: {
        name: 'Mohammed Abdelhady',
        url: 'https://github.com/Mohammed-Abdelhady',
      },
      homepage: 'https://github.com/Mohammed-Abdelhady/Phasewire',
      repository: 'https://github.com/Mohammed-Abdelhady/Phasewire',
      license: 'MIT',
      keywords: ['phasewire', 'workflow', 'harness-adapter', 'claude-code-plugin'],
    },
    null,
    2,
  )}\n`

export const renderCodexPluginJson = (): string =>
  `${JSON.stringify(
    {
      name: 'phasewire',
      version: '0.1.0',
      description:
        'Phasewire harness adapters for Codex: portable plan/execute/review/resume skills over the phasewire CLI.',
      author: {
        name: 'Mohammed Abdelhady',
        url: 'https://github.com/Mohammed-Abdelhady',
      },
      homepage: 'https://github.com/Mohammed-Abdelhady/Phasewire',
      repository: 'https://github.com/Mohammed-Abdelhady/Phasewire',
      license: 'MIT',
      skills: './skills/',
      interface: {
        displayName: 'Phasewire',
        shortDescription: 'Harness-agnostic Plan → Execute → Review control layer',
        longDescription:
          'Installs Phasewire skills that wrap the local phasewire CLI so Codex can plan, execute, review, resume, and hand off durable workflows without owning deployment.',
        developerName: 'Mohammed Abdelhady',
        category: 'Engineering',
        capabilities: ['Interactive', 'Read', 'Write'],
        websiteURL: 'https://github.com/Mohammed-Abdelhady/Phasewire',
        defaultPrompt: [
          'Use Phasewire to plan this change',
          'Show Phasewire workflow status',
          'Resume the latest Phasewire handoff',
        ],
        brandColor: '#7C5CFF',
        screenshots: [],
      },
    },
    null,
    2,
  )}\n`
