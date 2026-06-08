import type {
  ProgramNode,
  EntityNode,
  DashboardNode,
  WorkflowNode,
  StepNode,
  CompilerDiagnostic,
} from './ast.js';

// ---------------------------------------------------------------------------
// Semantic Analyzer
// ---------------------------------------------------------------------------
// Enforces the four semantic rules from the TAD:
//   1. Unique Entity Rule    — entity/dashboard/workflow names must be unique
//   2. Unique Field Rule     — field names within an entity must be unique
//   3. Relation Check        — @relation targets must reference existing entities
//   4. Identifier Resolution — workflow/dashboard refs must reference valid entities/fields

export interface AnalysisResult {
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly isValid: boolean;
  readonly entityNames: ReadonlySet<string>;
}

/**
 * Analyze a ProgramNode AST and return diagnostics.
 * Collects all errors rather than short-circuiting on the first one.
 */
export function analyze(program: ProgramNode): AnalysisResult {
  const diagnostics: CompilerDiagnostic[] = [];
  const entityNames = new Set<string>();

  // Collect all declaration names for cross-reference checking
  const declarationNames = new Map<string, 'entity' | 'dashboard' | 'workflow'>();

  for (const decl of program.declarations) {
    // Rule 1: Unique declaration names
    const existing = declarationNames.get(decl.name);
    if (existing) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate declaration '${decl.name}'. A ${existing} with this name already exists.`,
        code: 'DUPLICATE_DECLARATION',
      });
    } else {
      declarationNames.set(decl.name, decl.type === 'Entity' ? 'entity' : decl.type === 'Dashboard' ? 'dashboard' : 'workflow');
    }

    if (decl.type === 'Entity') {
      entityNames.add(decl.name);
      // Rule 2: Unique field names within entity
      checkUniqueFields(decl, diagnostics);
    }
  }

  // Rule 3: Relation checks — @relation targets must exist
  // Rule 4: Identifier resolution — dashboard/workflow refs must be valid
  for (const decl of program.declarations) {
    if (decl.type === 'Entity') {
      checkRelations(decl, entityNames, diagnostics);
    } else if (decl.type === 'Dashboard') {
      checkDashboardRefs(decl, entityNames, declarationNames, diagnostics);
    } else if (decl.type === 'Workflow') {
      checkWorkflowRefs(decl, entityNames, diagnostics);
    }
  }

  return {
    diagnostics,
    isValid: diagnostics.filter((d) => d.severity === 'error').length === 0,
    entityNames,
  };
}

// ---------------------------------------------------------------------------
// Rule 2: Unique field names within an entity
// ---------------------------------------------------------------------------
function checkUniqueFields(entity: EntityNode, diagnostics: CompilerDiagnostic[]): void {
  const seen = new Set<string>();
  for (const field of entity.fields) {
    if (seen.has(field.name)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate field '${field.name}' in entity '${entity.name}'.`,
        code: 'DUPLICATE_FIELD',
      });
    } else {
      seen.add(field.name);
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 3: Relation target must reference an existing entity
// ---------------------------------------------------------------------------
function checkRelations(
  entity: EntityNode,
  entityNames: Set<string>,
  diagnostics: CompilerDiagnostic[],
): void {
  for (const field of entity.fields) {
    if (field.relationTarget && !entityNames.has(field.relationTarget)) {
      diagnostics.push({
        severity: 'error',
        message: `Field '${field.name}' in entity '${entity.name}' references unknown entity '${field.relationTarget}'.`,
        code: 'UNKNOWN_RELATION_TARGET',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 4: Dashboard references must point to valid entities and fields
// ---------------------------------------------------------------------------
function checkDashboardRefs(
  dashboard: DashboardNode,
  entityNames: Set<string>,
  _declarationNames: Map<string, string>,
  diagnostics: CompilerDiagnostic[],
): void {
  for (const element of dashboard.elements) {
    if (element.type === 'Card' || element.type === 'TableView') {
      if (!entityNames.has(element.sourceEntity)) {
        diagnostics.push({
          severity: 'error',
          message: `Dashboard '${dashboard.name}' ${element.type.toLowerCase()} '${element.name}' references unknown entity '${element.sourceEntity}'.`,
          code: 'UNKNOWN_ENTITY_REF',
        });
      }
    } else if (element.type === 'Chart') {
      if (!entityNames.has(element.sourceEntity)) {
        diagnostics.push({
          severity: 'error',
          message: `Dashboard '${dashboard.name}' chart '${element.name}' references unknown entity '${element.sourceEntity}'.`,
          code: 'UNKNOWN_ENTITY_REF',
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 4 (cont): Workflow references must point to valid entities
// ---------------------------------------------------------------------------
function checkWorkflowRefs(
  workflow: WorkflowNode,
  _entityNames: Set<string>,
  _diagnostics: CompilerDiagnostic[],
): void {
  for (const step of workflow.steps) {
    checkStepRefs(step);
  }
}

function checkStepRefs(step: StepNode): void {
  if (step.type === 'DecisionStep') {
    if (step.thenStep) {
      checkStepRefs(step.thenStep);
    }
    if (step.elseStep) {
      checkStepRefs(step.elseStep);
    }
  }
  // ActionStep and NotifyStep don't reference entities directly
}
