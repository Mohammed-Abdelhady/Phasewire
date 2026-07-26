import type { WorkflowProjection, WorkflowSummary } from '@phasewire/core'

export const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

export const printLine = (value: string): void => {
  process.stdout.write(`${value}\n`)
}

const ANSI_PATTERN = new RegExp(String.raw`\u001b\[[0-?]*[ -/]*[@-~]`, 'gu')
const TERMINAL_CONTROL_PATTERN = new RegExp(
  String.raw`[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]`,
  'gu',
)
const BIDI_CONTROL_PATTERN = new RegExp(
  String.raw`[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]`,
  'gu',
)

export const sanitizeTerminalText = (value: string): string =>
  value
    .replace(ANSI_PATTERN, '')
    .replace(TERMINAL_CONTROL_PATTERN, '')
    .replace(BIDI_CONTROL_PATTERN, '')

export const sanitizeTerminalField = (value: string): string =>
  sanitizeTerminalText(value)
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/ {2,}/gu, ' ')
    .trim()

export const printResult = (
  value: unknown,
  json: boolean,
  human: (value: unknown) => string,
): void => {
  if (json) printJson(value)
  else printLine(human(value))
}

const isWorkflowProjection = (value: unknown): value is WorkflowProjection =>
  typeof value === 'object' && value !== null && 'workflowId' in value && 'eventCount' in value

const isWorkflowSummary = (value: unknown): value is WorkflowSummary =>
  typeof value === 'object' && value !== null && 'workflowId' in value && 'status' in value

export const formatStatus = (value: unknown): string => {
  if (isWorkflowProjection(value)) {
    return [
      `${sanitizeTerminalField(value.workflowId)} · ${sanitizeTerminalField(value.title)}`,
      `Status: ${sanitizeTerminalField(value.status)}`,
      `Phase: ${sanitizeTerminalField(value.currentPhase)}`,
      `Cycle: ${String(value.cycle)}`,
      `Events: ${String(value.eventCount)}`,
      `Deployment ready: ${value.deploymentReadiness.ready ? 'yes' : 'no'}`,
    ].join('\n')
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'No workflows.'
    return value
      .filter(isWorkflowSummary)
      .map(
        (workflow) =>
          `${sanitizeTerminalField(workflow.workflowId)}\t${sanitizeTerminalField(workflow.status)}\t` +
          `${sanitizeTerminalField(workflow.currentPhase)}\t${sanitizeTerminalField(workflow.title)}`,
      )
      .join('\n')
  }
  return JSON.stringify(value, null, 2)
}
