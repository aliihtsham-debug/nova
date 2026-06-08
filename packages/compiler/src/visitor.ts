// ---------------------------------------------------------------------------
// NovaVisitor — Converts Chevrotain CST output to typed AST nodes
// ---------------------------------------------------------------------------
// The parser produces raw CST objects with `type` fields. This visitor
// normalizes them into the standard AST node types defined in ast.ts,
// adding source location metadata.

import type {
  ProgramNode,
  DeclarationNode,
  EntityNode,
  FieldNode,
  DashboardNode,
  DashboardElementNode,
  CardNode,
  ChartNode,
  TableViewNode,
  WorkflowNode,
  StepNode,
  ActionStepNode,
  DecisionStepNode,
  NotifyStepNode,
  ExpressionNode,
  BinaryExpressionNode,
  LogicalExpressionNode,
  IdentifierNode,
  LiteralNode,
  SourceLocation,
} from './ast.js';

/**
 * Fresh source location to avoid shared mutable references.
 * Every AST node gets its own location object.
 */
function createLoc(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

/**
 * Normalize a fieldType from the CST to a plain string.
 * The parser may return either a token image string or a token object.
 */
function normalizeFieldType(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as { image?: string; name?: string };
    return obj.image ?? obj.name ?? 'string';
  }
  return 'string';
}

// ---------------------------------------------------------------------------
// CST node shape interfaces (tighter than a single catch-all)
// ---------------------------------------------------------------------------

interface CSTNode {
  type: string;
  name?: string;
  image?: string;
  value?: string | number | boolean;
}

interface ProgramCSTNode extends CSTNode {
  type: 'ProgramNode';
  declarations?: CSTNode[];
}

interface EntityCSTNode extends CSTNode {
  type: 'EntityNode';
  fields?: FieldCSTNode[];
}

interface FieldCSTNode extends CSTNode {
  type: 'FieldNode';
  fieldType?: string | { name?: string; image?: string };
  isNullable?: boolean;
  isList?: boolean;
  relationTarget?: string;
}

interface DashboardCSTNode extends CSTNode {
  type: 'DashboardNode';
  elements?: CSTNode[];
}

interface WorkflowCSTNode extends CSTNode {
  type: 'WorkflowNode';
  steps?: CSTNode[];
}

interface DecisionCSTNode extends CSTNode {
  type: 'DecisionStepNode';
  condition?: CSTNode;
  thenStep?: CSTNode;
  elseStep?: CSTNode;
}

interface NotifyCSTNode extends CSTNode {
  type: 'NotifyStepNode';
  targetAddress?: string;
  channel?: string;
  messageBody?: string;
}

interface ActionCSTNode extends CSTNode {
  type: 'ActionStepNode';
  actionScript?: string;
  inputArguments?: string[];
  outputVariables?: string[];
}

interface ExpressionCSTNode extends CSTNode {
  type: 'BinaryExpressionNode' | 'LogicalExpressionNode';
  left?: CSTNode;
  right?: CSTNode;
  operator?: string;
}

interface IdentifierCSTNode extends CSTNode {
  type: 'IdentifierNode';
  name: string;
}

interface LiteralCSTNode extends CSTNode {
  type: 'LiteralNode';
  value: string | number | boolean;
}

// Dashboard element CST nodes have additional fields beyond the base
interface DashboardElementCSTNode extends CSTNode {
  sourceEntity?: string;
  whereClause?: CSTNode;
  selectFields?: string[];
  chartType?: string;
  groupByField?: string;
  columns?: Array<{ name: string; label?: string }>;
}

// ---------------------------------------------------------------------------
// Visitor entry point
// ---------------------------------------------------------------------------

/**
 * Convert a raw CST node into a typed AST node.
 */
export function visitCST(cst: CSTNode): ProgramNode {
  if (cst.type !== 'ProgramNode') {
    throw new Error(`Expected ProgramNode at root, got ${cst.type}`);
  }
  return visitProgramNode(cst as ProgramCSTNode);
}

function visitProgramNode(cst: ProgramCSTNode): ProgramNode {
  const declarations = (cst.declarations ?? []).map((d) => visitDeclaration(d)) as DeclarationNode[];
  return { type: 'Program', declarations, loc: createLoc() };
}

function visitDeclaration(cst: CSTNode): DeclarationNode {
  switch (cst.type) {
    case 'EntityNode': return visitEntityNode(cst as EntityCSTNode);
    case 'DashboardNode': return visitDashboardNode(cst as DashboardCSTNode);
    case 'WorkflowNode': return visitWorkflowNode(cst as WorkflowCSTNode);
    default: throw new Error(`Unknown declaration type: ${cst.type}`);
  }
}

function visitEntityNode(cst: EntityCSTNode): EntityNode {
  const fields = (cst.fields ?? []).map((f) => visitFieldNode(f)) as FieldNode[];
  return { type: 'Entity', name: cst.name ?? '', fields, loc: createLoc() };
}

function visitFieldNode(cst: FieldCSTNode): FieldNode {
  return {
    type: 'Field',
    name: cst.name ?? '',
    fieldType: normalizeFieldType(cst.fieldType),
    isNullable: cst.isNullable ?? false,
    isList: cst.isList ?? false,
    relationTarget: cst.relationTarget,
    loc: createLoc(),
  };
}

function visitDashboardNode(cst: DashboardCSTNode): DashboardNode {
  const elements = (cst.elements ?? []).map((e) => visitDashboardElement(e)) as DashboardElementNode[];
  return { type: 'Dashboard', name: cst.name ?? '', elements, loc: createLoc() };
}

function visitDashboardElement(cst: CSTNode): DashboardElementNode {
  switch (cst.type) {
    case 'CardNode': return visitCardNode(cst);
    case 'ChartNode': return visitChartNode(cst);
    case 'TableViewNode': return visitTableViewNode(cst);
    default: throw new Error(`Unknown dashboard element type: ${cst.type}`);
  }
}

function visitCardNode(cst: DashboardElementCSTNode): CardNode {
  return {
    type: 'Card',
    name: cst.name ?? '',
    sourceEntity: cst.sourceEntity ?? '',
    whereClause: cst.whereClause ? (visitExpression(cst.whereClause) as ExpressionNode) : undefined,
    selectFields: cst.selectFields,
    loc: createLoc(),
  };
}

function visitChartNode(cst: DashboardElementCSTNode): ChartNode {
  return {
    type: 'Chart',
    name: cst.name ?? '',
    chartType: (cst.chartType as ChartNode['chartType']) ?? 'bar',
    sourceEntity: cst.sourceEntity ?? '',
    groupByField: cst.groupByField ?? '',
    whereClause: cst.whereClause ? (visitExpression(cst.whereClause) as ExpressionNode) : undefined,
    loc: createLoc(),
  };
}

function visitTableViewNode(cst: DashboardElementCSTNode): TableViewNode {
  return {
    type: 'TableView',
    name: cst.name ?? '',
    sourceEntity: cst.sourceEntity ?? '',
    whereClause: cst.whereClause ? (visitExpression(cst.whereClause) as ExpressionNode) : undefined,
    columns: cst.columns ?? [],
    loc: createLoc(),
  };
}

function visitWorkflowNode(cst: WorkflowCSTNode): WorkflowNode {
  const steps = (cst.steps ?? []).map((s) => visitStep(s)) as StepNode[];
  return { type: 'Workflow', name: cst.name ?? '', steps, loc: createLoc() };
}

function visitStep(cst: CSTNode): StepNode {
  switch (cst.type) {
    case 'ActionStepNode': return visitActionStep(cst as ActionCSTNode);
    case 'DecisionStepNode': return visitDecisionStep(cst as DecisionCSTNode);
    case 'NotifyStepNode': return visitNotifyStep(cst as NotifyCSTNode);
    default: throw new Error(`Unknown step type: ${cst.type}`);
  }
}

function visitActionStep(cst: ActionCSTNode): ActionStepNode {
  return {
    type: 'ActionStep',
    name: cst.name ?? '',
    actionScript: cst.actionScript ?? '',
    inputArguments: cst.inputArguments,
    outputVariables: cst.outputVariables,
    loc: createLoc(),
  };
}

function visitDecisionStep(cst: DecisionCSTNode): DecisionStepNode {
  if (!cst.condition) {
    throw new Error('DecisionStep is missing a condition');
  }
  if (!cst.thenStep) {
    throw new Error('DecisionStep is missing a thenStep');
  }
  return {
    type: 'DecisionStep',
    condition: visitExpression(cst.condition) as ExpressionNode,
    thenStep: visitStep(cst.thenStep) as StepNode,
    elseStep: cst.elseStep ? (visitStep(cst.elseStep) as StepNode) : undefined,
    loc: createLoc(),
  };
}

function visitNotifyStep(cst: NotifyCSTNode): NotifyStepNode {
  const rawTarget = cst.targetAddress ?? '';
  const rawMessage = cst.messageBody ?? '';
  return {
    type: 'NotifyStep',
    name: cst.name ?? '',
    targetAddress: rawTarget.startsWith('"') ? rawTarget.slice(1, -1) : rawTarget,
    channel: (cst.channel as NotifyStepNode['channel']) ?? 'email',
    messageBody: rawMessage.startsWith('"') ? rawMessage.slice(1, -1) : rawMessage,
    loc: createLoc(),
  };
}

function visitExpression(cst: CSTNode | undefined): ExpressionNode {
  if (!cst) return { type: 'Identifier', name: '', loc: createLoc() } as IdentifierNode;

  switch (cst.type) {
    case 'BinaryExpressionNode': return visitBinaryExpression(cst as ExpressionCSTNode);
    case 'LogicalExpressionNode': return visitLogicalExpression(cst as ExpressionCSTNode);
    case 'IdentifierNode': return visitIdentifierNode(cst as IdentifierCSTNode);
    case 'LiteralNode': return visitLiteralNode(cst as LiteralCSTNode);
    default: return { type: 'Identifier', name: (cst as CSTNode).name ?? '', loc: createLoc() } as IdentifierNode;
  }
}

function visitBinaryExpression(cst: ExpressionCSTNode): BinaryExpressionNode {
  if (!cst.left || !cst.right) {
    throw new Error('BinaryExpressionNode is missing left or right operand');
  }
  return {
    type: 'BinaryExpression',
    left: visitExpression(cst.left) as ExpressionNode,
    operator: (cst.operator as BinaryExpressionNode['operator']) ?? '==',
    right: visitExpression(cst.right) as ExpressionNode,
    loc: createLoc(),
  };
}

function visitLogicalExpression(cst: ExpressionCSTNode): LogicalExpressionNode {
  if (!cst.left || !cst.right) {
    throw new Error('LogicalExpressionNode is missing left or right operand');
  }
  return {
    type: 'LogicalExpression',
    left: visitExpression(cst.left) as ExpressionNode,
    operator: (cst.operator as LogicalExpressionNode['operator']) ?? '&&',
    right: visitExpression(cst.right) as ExpressionNode,
    loc: createLoc(),
  };
}

function visitIdentifierNode(cst: IdentifierCSTNode): IdentifierNode {
  return { type: 'Identifier', name: cst.name ?? '', loc: createLoc() };
}

function visitLiteralNode(cst: LiteralCSTNode): LiteralNode {
  return { type: 'Literal', value: cst.value ?? '', loc: createLoc() };
}
