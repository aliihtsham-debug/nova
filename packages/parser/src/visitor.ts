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
  Position,
} from '@nova/compiler';

// ---------------------------------------------------------------------------
// NovaVisitor — Converts Chevrotain CST output to typed AST nodes
// ---------------------------------------------------------------------------
// The parser produces raw CST objects with `type` fields. This visitor
// normalizes them into the standard AST node types defined in
// packages/compiler/src/ast.ts, adding source location metadata.

interface CSTNode {
  type: string;
  name?: string;
  image?: string;
  value?: string | number | boolean;
  declarations?: CSTNode[];
  fields?: CSTNode[];
  elements?: CSTNode[];
  steps?: CSTNode[];
  condition?: CSTNode;
  thenStep?: CSTNode;
  elseStep?: CSTNode;
  actionScript?: string;
  inputArguments?: string[];
  outputVariables?: string[];
  targetAddress?: string;
  channel?: string;
  messageBody?: string;
  left?: CSTNode;
  right?: CSTNode;
  operator?: string;
  chartType?: string;
  sourceEntity?: string;
  groupByField?: string;
  whereClause?: CSTNode;
  selectFields?: string[];
  columns?: Array<{ name: string; label?: string }>;
  fieldType?: string | { name: string };
  isNullable?: boolean;
  isList?: boolean;
  relationTarget?: string;
}

/**
 * Build a SourceLocation from Chevrotain token position data.
 */
function buildLocation(startOffset: number, endOffset: number, startLine: number, endLine: number, startCol: number, endCol: number): SourceLocation {
  return {
    start: { line: startLine, column: startCol, offset: startOffset } as Position,
    end: { line: endLine, column: endCol, offset: endOffset } as Position,
  };
}

/**
 * Default location for nodes without precise offset data.
 */
const defaultLoc: SourceLocation = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

/**
 * Convert a raw CST node into a typed AST node.
 */
export function visitCST(cst: CSTNode, loc: SourceLocation = defaultLoc): ProgramNode {
  if (cst.type !== 'ProgramNode') {
    throw new Error(`Expected ProgramNode at root, got ${cst.type}`);
  }

  return visitProgramNode(cst, loc);
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------
function visitProgramNode(cst: CSTNode, loc: SourceLocation): ProgramNode {
  const declarations = (cst.declarations ?? []).map((d) =>
    visitDeclaration(d),
  ) as DeclarationNode[];

  return { type: 'Program', declarations, loc };
}

// ---------------------------------------------------------------------------
// Declaration dispatcher
// ---------------------------------------------------------------------------
function visitDeclaration(cst: CSTNode): DeclarationNode {
  switch (cst.type) {
    case 'EntityNode':
      return visitEntityNode(cst);
    case 'DashboardNode':
      return visitDashboardNode(cst);
    case 'WorkflowNode':
      return visitWorkflowNode(cst);
    default:
      throw new Error(`Unknown declaration type: ${cst.type}`);
  }
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------
function visitEntityNode(cst: CSTNode): EntityNode {
  const fields = (cst.fields ?? []).map((f) => visitFieldNode(f)) as FieldNode[];
  return {
    type: 'Entity',
    name: cst.name ?? '',
    fields,
    loc: { ...defaultLoc },
  };
}

function visitFieldNode(cst: CSTNode): FieldNode {
  const rawType = cst.fieldType;
  const fieldType = typeof rawType === 'string' ? rawType : (rawType?.name ?? 'string');
  return {
    type: 'Field',
    name: cst.name ?? '',
    fieldType,
    isNullable: cst.isNullable ?? false,
    isList: cst.isList ?? false,
    relationTarget: cst.relationTarget,
    loc: { ...defaultLoc },
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function visitDashboardNode(cst: CSTNode): DashboardNode {
  const elements = (cst.elements ?? []).map((e) =>
    visitDashboardElement(e),
  ) as DashboardElementNode[];
  return {
    type: 'Dashboard',
    name: cst.name ?? '',
    elements,
    loc: { ...defaultLoc },
  };
}

function visitDashboardElement(cst: CSTNode): DashboardElementNode {
  switch (cst.type) {
    case 'CardNode':
      return visitCardNode(cst);
    case 'ChartNode':
      return visitChartNode(cst);
    case 'TableViewNode':
      return visitTableViewNode(cst);
    default:
      throw new Error(`Unknown dashboard element type: ${cst.type}`);
  }
}

function visitCardNode(cst: CSTNode): CardNode {
  return {
    type: 'Card',
    name: cst.name ?? '',
    sourceEntity: cst.sourceEntity ?? '',
    whereClause: cst.whereClause
      ? (visitExpression(cst.whereClause) as ExpressionNode)
      : undefined,
    selectFields: cst.selectFields,
    loc: { ...defaultLoc },
  };
}

function visitChartNode(cst: CSTNode): ChartNode {
  return {
    type: 'Chart',
    name: cst.name ?? '',
    chartType: (cst.chartType as ChartNode['chartType']) ?? 'bar',
    sourceEntity: cst.sourceEntity ?? '',
    groupByField: cst.groupByField ?? '',
    whereClause: cst.whereClause
      ? (visitExpression(cst.whereClause) as ExpressionNode)
      : undefined,
    loc: { ...defaultLoc },
  };
}

function visitTableViewNode(cst: CSTNode): TableViewNode {
  return {
    type: 'TableView',
    name: cst.name ?? '',
    sourceEntity: cst.sourceEntity ?? '',
    whereClause: cst.whereClause
      ? (visitExpression(cst.whereClause) as ExpressionNode)
      : undefined,
    columns: cst.columns ?? [],
    loc: { ...defaultLoc },
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------
function visitWorkflowNode(cst: CSTNode): WorkflowNode {
  const steps = (cst.steps ?? []).map((s) => visitStep(s)) as StepNode[];
  return {
    type: 'Workflow',
    name: cst.name ?? '',
    steps,
    loc: { ...defaultLoc },
  };
}

function visitStep(cst: CSTNode): StepNode {
  switch (cst.type) {
    case 'ActionStepNode':
      return visitActionStep(cst);
    case 'DecisionStepNode':
      return visitDecisionStep(cst);
    case 'NotifyStepNode':
      return visitNotifyStep(cst);
    default:
      throw new Error(`Unknown step type: ${cst.type}`);
  }
}

function visitActionStep(cst: CSTNode): ActionStepNode {
  return {
    type: 'ActionStep',
    name: cst.name ?? '',
    actionScript: cst.actionScript ?? '',
    inputArguments: cst.inputArguments,
    outputVariables: cst.outputVariables,
    loc: { ...defaultLoc },
  };
}

function visitDecisionStep(cst: CSTNode): DecisionStepNode {
  return {
    type: 'DecisionStep',
    condition: visitExpression(cst.condition!) as ExpressionNode,
    thenStep: visitStep(cst.thenStep!) as StepNode,
    elseStep: cst.elseStep
      ? (visitStep(cst.elseStep) as StepNode)
      : undefined,
    loc: { ...defaultLoc },
  };
}

function visitNotifyStep(cst: CSTNode): NotifyStepNode {
  return {
    type: 'NotifyStep',
    name: cst.name ?? '',
    targetAddress: cst.targetAddress ?? '',
    channel: (cst.channel as NotifyStepNode['channel']) ?? 'email',
    messageBody: cst.messageBody ?? '',
    loc: { ...defaultLoc },
  };
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------
function visitExpression(cst: CSTNode): CSTNode | ExpressionNode {
  if (!cst) return { type: 'IdentifierNode', name: '' } as IdentifierNode;

  switch (cst.type) {
    case 'BinaryExpressionNode':
      return visitBinaryExpression(cst);
    case 'LogicalExpressionNode':
      return visitLogicalExpression(cst);
    case 'IdentifierNode':
      return visitIdentifierNode(cst);
    case 'LiteralNode':
      return visitLiteralNode(cst);
    default:
      // Fallback: treat as-is (may be a raw CST node from parser)
      return cst as ExpressionNode;
  }
}

function visitBinaryExpression(cst: CSTNode): BinaryExpressionNode {
  return {
    type: 'BinaryExpression',
    left: visitExpression(cst.left!) as ExpressionNode,
    operator: (cst.operator as BinaryExpressionNode['operator']) ?? '==',
    right: visitExpression(cst.right!) as ExpressionNode,
    loc: { ...defaultLoc },
  };
}

function visitLogicalExpression(cst: CSTNode): LogicalExpressionNode {
  return {
    type: 'LogicalExpression',
    left: visitExpression(cst.left!) as ExpressionNode,
    operator: (cst.operator as LogicalExpressionNode['operator']) ?? '&&',
    right: visitExpression(cst.right!) as ExpressionNode,
    loc: { ...defaultLoc },
  };
}

function visitIdentifierNode(cst: CSTNode): IdentifierNode {
  return {
    type: 'Identifier',
    name: cst.name ?? '',
    loc: { ...defaultLoc },
  };
}

function visitLiteralNode(cst: CSTNode): LiteralNode {
  return {
    type: 'Literal',
    value: cst.value ?? '',
    loc: { ...defaultLoc },
  };
}
