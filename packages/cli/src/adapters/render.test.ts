import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'

import { ADAPTER_HOSTS, ADAPTER_SKILLS, type AdapterSkill } from './catalog.js'
import {
  renderClaudeCommandMarkdown,
  renderSkillMarkdown,
  yamlDoubleQuoted,
} from './render.js'

const extractFrontmatter = (markdown: string): string => {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown)
  if (match?.[1] === undefined) {
    throw new Error('Missing YAML frontmatter delimiters')
  }
  return match[1]
}

const parseFrontmatter = (markdown: string): Record<string, unknown> => {
  const parsed: unknown = parseYaml(extractFrontmatter(markdown))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter did not parse to a mapping')
  }
  return parsed as Record<string, unknown>
}

describe('yamlDoubleQuoted', () => {
  it('round-trips scalars with quotes, colons, hashes, backslashes, and newlines', () => {
    const samples = [
      '"<goal>" [--template <id>] [--validation <check>]',
      'key: value # not a comment',
      'slash\\and"quote',
      'line one\nline two',
      'trailing space ',
    ]

    for (const sample of samples) {
      const document = `value: ${yamlDoubleQuoted(sample)}\n`
      const parsed: unknown = parseYaml(document)
      expect(parsed).toEqual({ value: sample })
    }
  })
})

describe('renderSkillMarkdown frontmatter', () => {
  it('parses for every skill and host', () => {
    for (const skill of ADAPTER_SKILLS) {
      for (const host of ADAPTER_HOSTS) {
        const markdown = renderSkillMarkdown(skill, host)
        const frontmatter = parseFrontmatter(markdown)

        expect(frontmatter.name).toBe(skill.skillName)
        expect(frontmatter['argument-hint']).toBe(skill.argumentHint)
        expect(String(frontmatter.description).replace(/\n$/, '')).toBe(skill.description)
        expect(frontmatter.version).toBe('0.1.0')
        expect(frontmatter.license).toBe('MIT')
        expect(typeof frontmatter.compatibility).toBe('string')
        expect(frontmatter.tags).toEqual(['phasewire', 'workflow', 'harness-adapter'])
      }
    }
  })

  it('preserves plan argument-hint including embedded quotes', () => {
    const plan = ADAPTER_SKILLS.find((skill) => skill.id === 'plan')
    expect(plan).toBeDefined()
    if (plan === undefined) return

    const frontmatter = parseFrontmatter(renderSkillMarkdown(plan, 'claude'))
    expect(frontmatter['argument-hint']).toBe(
      '"<goal>" [--template <id>] [--validation <check>]',
    )
  })

  it('encodes synthetic special-character skill fields', () => {
    const skill: AdapterSkill = {
      id: 'plan',
      skillName: 'phasewire:plan#test',
      title: 'Synthetic',
      argumentHint: 'goal: "x" #tag\nnext',
      cli: 'phasewire plan',
      description: 'Single-line description for block scalar.',
      steps: ['step'],
    }

    const frontmatter = parseFrontmatter(renderSkillMarkdown(skill, 'codex'))
    expect(frontmatter.name).toBe(skill.skillName)
    expect(frontmatter['argument-hint']).toBe(skill.argumentHint)
    expect(String(frontmatter.compatibility)).toContain('Codex')
  })
})

describe('renderClaudeCommandMarkdown frontmatter', () => {
  it('parses description as a quoted scalar for every skill', () => {
    for (const skill of ADAPTER_SKILLS) {
      const markdown = renderClaudeCommandMarkdown(skill)
      const frontmatter = parseFrontmatter(markdown)
      const expected = skill.description.split('\n')[0] ?? skill.description
      expect(frontmatter.description).toBe(expected)
    }
  })
})

describe('review skill GitHub write policy', () => {
  const reviewSkill = ADAPTER_SKILLS.find((skill) => skill.id === 'review')
  if (reviewSkill === undefined) {
    throw new Error('review skill missing from ADAPTER_SKILLS')
  }

  const forbiddenPhrases = [
    'If a GitHub PR is in scope: post start comment',
    'post start comment, visual guide',
    'and finish with `Finished reviewing this one.`',
  ] as const

  const requiredPhrases = [
    'local/draft-only',
    'explicitly authorizes an external write',
    'repository and PR number are unambiguous',
    'one batched formal review',
  ] as const

  it('renders local-default authorization and batched-write policy for every host', () => {
    for (const host of ADAPTER_HOSTS) {
      const skillMarkdown = renderSkillMarkdown(reviewSkill, host)

      for (const phrase of requiredPhrases) {
        expect(skillMarkdown).toContain(phrase)
      }

      for (const phrase of forbiddenPhrases) {
        expect(skillMarkdown).not.toContain(phrase)
      }
    }

    const claudeCommand = renderClaudeCommandMarkdown(reviewSkill)
    for (const phrase of forbiddenPhrases) {
      expect(claudeCommand).not.toContain(phrase)
    }
  })
})
