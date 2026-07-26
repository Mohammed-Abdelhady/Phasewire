export type JsonPrimitive = boolean | number | string | null

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface EndpointDescriptor {
  readonly origin: string
  readonly pid: number
  readonly port: number
  readonly projectRoot: string
  readonly startedAt: string
  readonly token: string
  readonly version: 1
}

export interface ServiceOptions {
  readonly host?: string
  readonly port?: number
  readonly projectRoot: string
  readonly token?: string
  readonly webRoot?: string
}

export interface RunningService {
  readonly close: () => Promise<void>
  readonly endpoint: EndpointDescriptor
}

export interface EnsureServiceOptions {
  readonly timeoutMs?: number
}

export interface WorkflowEventInput {
  readonly actor: string
  readonly idempotencyKey?: string
  readonly logicalClock?: number
  readonly occurredAt?: string
  readonly parents?: readonly string[]
  readonly payload?: Readonly<Record<string, JsonValue>>
  readonly phase?: 'plan' | 'execute' | 'review' | 'remediation'
  readonly type: string
}

export interface WorkflowActionInput {
  readonly actor?: string
  readonly idempotencyKey?: string
  readonly payload?: Readonly<Record<string, JsonValue>>
}
