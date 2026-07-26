export class PhasewireError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'PhasewireError'
  }
}

export class IntegrityError extends PhasewireError {
  public constructor(message: string) {
    super(message, 'INTEGRITY_ERROR')
    this.name = 'IntegrityError'
  }
}

export class ReplayError extends PhasewireError {
  public constructor(message: string) {
    super(message, 'REPLAY_ERROR')
    this.name = 'ReplayError'
  }
}

export class WorkflowConflictError extends PhasewireError {
  public constructor(workflowId: string, heads: readonly string[]) {
    super(
      `Workflow ${workflowId} has multiple heads (${heads.join(', ')}) and is read-only until reconciled`,
      'WORKFLOW_CONFLICT',
    )
    this.name = 'WorkflowConflictError'
  }
}

export class WorkflowNotFoundError extends PhasewireError {
  public constructor(workflowId: string) {
    super(`Workflow ${workflowId} does not exist`, 'WORKFLOW_NOT_FOUND')
    this.name = 'WorkflowNotFoundError'
  }
}

export class StoreBusyError extends PhasewireError {
  public constructor(workflowId: string) {
    super(`Workflow ${workflowId} is currently being modified`, 'STORE_BUSY')
    this.name = 'StoreBusyError'
  }
}

export class ActiveClaimError extends PhasewireError {
  public constructor(workflowId: string, phase: string) {
    super(`Workflow ${workflowId} phase ${phase} already has an active claim`, 'ACTIVE_PHASE_CLAIM')
    this.name = 'ActiveClaimError'
  }
}
