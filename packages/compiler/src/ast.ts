// ---------------------------------------------------------------------------
// AST Node Types — Full type definitions for the Nova DSL Abstract Syntax Tree
// ---------------------------------------------------------------------------
// These types are consumed by the analyzer, validator, generators, and visitor.
// Every node carries an optional `loc` (SourceLocation) for error reporting.

// --- Source Location ---

export interface Position {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export interface SourceLocation {
  readonly start: Position;
  readonly end: Position;
}

// --- Base ---

export interface BaseNode {
  readonly type: string;
  readonly loc?: SourceLocation;
}

// --- Program ---

export interface ProgramNode extends BaseNode {
  readonly type: 'Program';
  readonly declarations: readonly DeclarationNode[];
}

export type DeclarationNode = EntityNode | DashboardNode | WorkflowNode;

// --- Entity ---

export interface EntityNode extends BaseNode {
  readonly type: 'Entity';
  readonly name: string;
  readonly fields: readonly FieldNode[];
}

export interface FieldNode extends BaseNode {
  readonly type: 'Field';
  readonly name: string;
  readonly fieldType: string;
  readonly isNullable: boolean;
  readonly isList: boolean;
  readonly relationTarget?: string;
}

// --- Dashboard ---

export interface DashboardNode extends BaseNode {
  readonly type: 'Dashboard';
  readonly name: string;
  readonly elements: readonly DashboardElementNode[];
}

export type DashboardElementNode = CardNode | ChartNode | TableViewNode;

export interface CardNode extends BaseNode {
  readonly type: 'Card';
  readonly name: string;
  readonly sourceEntity: string;
  readonly whereClause?: ExpressionNode;
  readonly selectFields?: readonly string[];
}

export interface ChartNode extends BaseNode {
  readonly type: 'Chart';
  readonly name: string;
  readonly chartType: 'bar' | 'line' | 'pie' | 'donut';
  readonly sourceEntity: string;
  readonly groupByField: string;
  readonly whereClause?: ExpressionNode;
}

export interface TableViewNode extends BaseNode {
  readonly type: 'TableView';
  readonly name: string;
  readonly sourceEntity: string;
  readonly whereClause?: ExpressionNode;
  readonly columns: readonly TableColumn[];
}

export interface TableColumn {
  readonly name: string;
  readonly label?: string;
}

// --- Workflow ---

export interface WorkflowNode extends BaseNode {
  readonly type: 'Workflow';
  readonly name: string;
  readonly steps: readonly StepNode[];
}

export type StepNode = ActionStepNode | DecisionStepNode | NotifyStepNode;

export interface ActionStepNode extends BaseNode {
  readonly type: 'ActionStep';
  readonly name: string;
  readonly actionScript: string;
  readonly inputArguments?: readonly string[];
  readonly outputVariables?: readonly string[];
}

export interface DecisionStepNode extends BaseNode {
  readonly type: 'DecisionStep';
  readonly condition: ExpressionNode;
  readonly thenStep: StepNode;
  readonly elseStep?: StepNode;
}

export interface NotifyStepNode extends BaseNode {
  readonly type: 'NotifyStep';
  readonly name: string;
  readonly targetAddress: string;
  readonly channel: 'email' | 'slack' | 'sms';
  readonly messageBody: string;
}

// --- Expressions ---

export type ExpressionNode =
  | BinaryExpressionNode
  | LogicalExpressionNode
  | IdentifierNode
  | LiteralNode;

export interface BinaryExpressionNode extends BaseNode {
  readonly type: 'BinaryExpression';
  readonly left: ExpressionNode;
  readonly operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  readonly right: ExpressionNode;
}

export interface LogicalExpressionNode extends BaseNode {
  readonly type: 'LogicalExpression';
  readonly left: ExpressionNode;
  readonly operator: '&&' | '||';
  readonly right: ExpressionNode;
}

export interface IdentifierNode extends BaseNode {
  readonly type: 'Identifier';
  readonly name: string;
}

export interface LiteralNode extends BaseNode {
  readonly type: 'Literal';
  readonly value: string | number | boolean;
}

// --- Compiler Contracts ---

export interface GeneratedArtifact {
  readonly path: string;
  readonly content: string;
  readonly type: 'file' | 'directory';
}

export interface CompilerDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly code?: string;
}

export interface CompilerOptions {
  readonly verbose?: boolean;
  readonly projectName: string;
  readonly targetDirectory?: string;
}

export interface CompilerContext {
  readonly targetDirectory: string;
  readonly options: CompilerOptions;
  readonly diagnostics: CompilerDiagnostic[];
}

export interface Generator {
  readonly name: string;
  generate(program: ProgramNode, context: CompilerContext): Promise<GeneratedArtifact[]>;
}

export interface CompilationResult {
  readonly success: boolean;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly diagnostics: readonly CompilerDiagnostic[];
}

// --- Type System ---

export const PRIMITIVE_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
  'money',
  'uuid',
] as const;

export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number];

export function isPrimitiveType(value: string): value is PrimitiveType {
  return PRIMITIVE_TYPES.includes(value as PrimitiveType);
}

// --- Auth / Billing (generated models) ---

export interface RoleEnumNode extends BaseNode {
  readonly type: 'RoleEnum';
  readonly name: string;
  readonly values: readonly string[];
}

// Default role values matching the TAD DDL
export const DEFAULT_ROLE_VALUES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
