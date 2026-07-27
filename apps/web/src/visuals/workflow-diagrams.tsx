import type { PhaseId, WorkflowProjection } from '../types'
import { InteractiveGraph } from './interactive-graph'
import {
  eventRiverModel,
  findingRelationModel,
  readinessModel,
  workflowPhaseModel,
} from './models'
import { RelationLegend } from './relation-legend'

interface WorkflowDiagramsProps {
  workflow: WorkflowProjection
  selectedPhase: PhaseId
  onSelectPhase: (phase: PhaseId) => void
}

export function WorkflowDiagrams({
  workflow,
  selectedPhase,
  onSelectPhase,
}: WorkflowDiagramsProps) {
  const phaseModel = workflowPhaseModel(workflow)

  return (
    <div className="workflow-diagrams" data-testid="workflow-diagrams">
      <RelationLegend />
      <InteractiveGraph
        model={phaseModel}
        mode="horizontal"
        title="Phase constellation"
        description="How plan, execute, review, and the deploy gate connect — including remediation return loops."
        selectedId={selectedPhase}
        onSelect={(id) => {
          if (id === 'plan' || id === 'execute' || id === 'review' || id === 'ready') {
            onSelectPhase(id)
          }
        }}
        testId="phase-constellation"
      />

      {selectedPhase === 'review' && workflow.findings.length > 0 ? (
        <InteractiveGraph
          model={findingRelationModel(workflow.findings, workflow.currentPhase)}
          mode="adaptive"
          title="Finding relationships"
          description="Blocking findings force a remediation plan; non-blocking items still leave evidence trails."
          testId="finding-graph"
        />
      ) : null}

      {selectedPhase === 'execute' && workflow.events.length > 0 ? (
        <InteractiveGraph
          model={eventRiverModel(workflow.events)}
          mode="horizontal"
          title="Event river"
          description="Ordered durable events that explain how execution progressed."
          testId="event-river"
        />
      ) : null}

      {selectedPhase === 'ready' ? (
        <InteractiveGraph
          model={readinessModel(workflow)}
          mode="horizontal"
          title="Readiness chain"
          description="Validation and clear review derive readiness. Authorization stays a separate human step."
          testId="readiness-chain"
        />
      ) : null}
    </div>
  )
}
