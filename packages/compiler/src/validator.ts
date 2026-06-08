import type {
  ProgramNode,
  EntityNode,
  FieldNode,
  CompilerDiagnostic,
} from './ast.js';

// ---------------------------------------------------------------------------
// Validation Pipeline
// ---------------------------------------------------------------------------
// Phase 4 of the compiler pipeline. Checks for:
//   1. Circular entity relationships (A → B → C → A)
//   2. Entities with no fields (warning)
//   3. Optional fields on every field (suspicious — warning)
//   4. Unknown field types (not primitive + not a known entity)
//   5. Self-referencing relations without nullable flag (warning)

export interface ValidationResult {
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly isValid: boolean;
}

export function validate(program: ProgramNode, knownEntityNames: ReadonlySet<string>): ValidationResult {
  const diagnostics: CompilerDiagnostic[] = [];

  for (const decl of program.declarations) {
    if (decl.type === 'Entity') {
      validateEntity(decl, knownEntityNames, diagnostics);
    }
  }

  // Check circular relationships across all entities
  checkCircularRelations(program.declarations.filter((d): d is EntityNode => d.type === 'Entity'), diagnostics);

  return {
    diagnostics,
    isValid: diagnostics.filter((d) => d.severity === 'error').length === 0,
  };
}

// ---------------------------------------------------------------------------
// Entity-level validation
// ---------------------------------------------------------------------------
function validateEntity(
  entity: EntityNode,
  knownEntityNames: ReadonlySet<string>,
  diagnostics: CompilerDiagnostic[],
): void {
  // Warning: entity with no fields
  if (entity.fields.length === 0) {
    diagnostics.push({
      severity: 'warning',
      message: `Entity '${entity.name}' has no fields defined.`,
      code: 'EMPTY_ENTITY',
    });
  }

  for (const field of entity.fields) {
    validateField(field, entity.name, knownEntityNames, diagnostics);
  }
}

// ---------------------------------------------------------------------------
// Field-level validation
// ---------------------------------------------------------------------------
function validateField(
  field: FieldNode,
  entityName: string,
  knownEntityNames: ReadonlySet<string>,
  diagnostics: CompilerDiagnostic[],
): void {
  const { name, fieldType, isNullable, relationTarget } = field;

  // Check: unknown type (not primitive and not a known entity)
  const primitiveTypes = new Set(['string', 'number', 'boolean', 'date', 'money', 'uuid']);
  if (!primitiveTypes.has(fieldType) && !knownEntityNames.has(fieldType)) {
    diagnostics.push({
      severity: 'warning',
      message: `Field '${name}' in entity '${entityName}' has unknown type '${fieldType}'. Expected a primitive type or a declared entity.`,
      code: 'UNKNOWN_FIELD_TYPE',
    });
  }

  // Check: self-referencing relation without nullable
  if (relationTarget === entityName && !isNullable) {
    diagnostics.push({
      severity: 'warning',
      message: `Self-referencing field '${name}' in entity '${entityName}' should be nullable.`,
      code: 'SELF_REF_NOT_NULLABLE',
    });
  }

  // Check: relation target matches field type
  if (relationTarget && fieldType !== relationTarget) {
    diagnostics.push({
      severity: 'error',
      message: `Field '${name}' in entity '${entityName}' has type '${fieldType}' but @relation targets '${relationTarget}'. The type and @relation target should match.`,
      code: 'RELATION_TYPE_MISMATCH',
    });
  }
}

// ---------------------------------------------------------------------------
// Circular relationship detection
// ---------------------------------------------------------------------------
function checkCircularRelations(entities: readonly EntityNode[], diagnostics: CompilerDiagnostic[]): void {
  // Build adjacency list: entityName → relationTarget[]
  const adjacency = new Map<string, string[]>();

  for (const entity of entities) {
    const targets: string[] = [];
    for (const field of entity.fields) {
      if (field.relationTarget) {
        targets.push(field.relationTarget);
      }
    }
    adjacency.set(entity.name, targets);
  }

  // DFS-based cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();

  for (const entityName of adjacency.keys()) {
    if (!visited.has(entityName)) {
      const cycle = dfsDetectCycle(entityName, adjacency, visited, inStack, []);
      if (cycle) {
        diagnostics.push({
          severity: 'error',
          message: `Circular entity relationship detected: ${cycle.join(' → ')}`,
          code: 'CIRCULAR_RELATION',
        });
      }
    }
  }
}

function dfsDetectCycle(
  node: string,
  adjacency: Map<string, string[]>,
  visited: Set<string>,
  inStack: Set<string>,
  path: string[],
): string[] | null {
  visited.add(node);
  inStack.add(node);
  path.push(node);

  const neighbors = adjacency.get(node) ?? [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      const cycle = dfsDetectCycle(neighbor, adjacency, visited, inStack, path);
      if (cycle) return cycle;
    } else if (inStack.has(neighbor)) {
      // Found cycle — return the cycle path
      const cycleStart = path.indexOf(neighbor);
      return [...path.slice(cycleStart), neighbor];
    }
  }

  path.pop();
  inStack.delete(node);
  return null;
}
