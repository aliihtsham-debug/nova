# AST Extensions

This document describes the AST node types defined in `packages/compiler/src/ast.ts` and how they integrate with the parser and generators.

## Core AST Types

All AST types are defined in `packages/compiler/src/ast.ts`. The key interfaces:

### Program & Declarations

```typescript
interface ProgramNode extends BaseNode {
  type: 'Program';
  declarations: readonly DeclarationNode[];
}

type DeclarationNode = EntityNode | DashboardNode | WorkflowNode;
```

### Entity

```typescript
interface EntityNode extends BaseNode {
  type: 'Entity';
  name: string;
  fields: readonly FieldNode[];
}

interface FieldNode extends BaseNode {
  type: 'Field';
  name: string;
  fieldType: string;       // Primitive type or entity name
  isNullable: boolean;
  isList: boolean;
  relationTarget?: string; // Set when @relation is used
}
```

### Dashboard

```typescript
interface DashboardNode extends BaseNode {
  type: 'Dashboard';
  name: string;
  elements: readonly DashboardElementNode[];
}

type DashboardElementNode = CardNode | ChartNode | TableViewNode;

interface CardNode extends BaseNode {
  type: 'Card';
  name: string;
  sourceEntity: string;
  whereClause?: ExpressionNode;
  selectFields?: readonly string[];
}

interface ChartNode extends BaseNode {
  type: 'Chart';
  name: string;
  chartType: 'bar' | 'line' | 'pie' | 'donut';
  sourceEntity: string;
  groupByField: string;
  whereClause?: ExpressionNode;
}

interface TableViewNode extends BaseNode {
  type: 'TableView';
  name: string;
  sourceEntity: string;
  whereClause?: ExpressionNode;
  columns: readonly TableColumn[];
}
```

### Workflow

```typescript
interface WorkflowNode extends BaseNode {
  type: 'Workflow';
  name: string;
  steps: readonly StepNode[];
}

type StepNode = ActionStepNode | DecisionStepNode | NotifyStepNode;

interface ActionStepNode extends BaseNode {
  type: 'ActionStep';
  name: string;
  actionScript: string;
  inputArguments?: readonly string[];
  outputVariables?: readonly string[];
}

interface DecisionStepNode extends BaseNode {
  type: 'DecisionStep';
  condition: ExpressionNode;
  thenStep: StepNode;
  elseStep?: StepNode;
}

interface NotifyStepNode extends BaseNode {
  type: 'NotifyStep';
  name: string;
  targetAddress: string;
  channel: 'email' | 'slack' | 'sms';
  messageBody: string;
}
```

### Expressions

```typescript
type ExpressionNode =
  | BinaryExpressionNode
  | LogicalExpressionNode
  | IdentifierNode
  | LiteralNode;

interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  left: ExpressionNode;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  right: ExpressionNode;
}

interface LogicalExpressionNode extends BaseNode {
  type: 'LogicalExpression';
  left: ExpressionNode;
  operator: '&&' | '||';
  right: ExpressionNode;
}

interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

interface LiteralNode extends BaseNode {
  type: 'Literal';
  value: string | number | boolean;
}
```

## Integration with Parser

The parser produces CST nodes with matching `type` fields. The visitor (`packages/parser/src/visitor.ts`) converts CST → AST by:

1. Normalizing field types (string → 'string', etc.)
2. Adding `SourceLocation` metadata
3. Ensuring all optional fields have defaults
4. Validating node structure

## Integration with Generators

Each generator consumes the typed AST:

| Generator | Primary AST Types Used |
|-----------|----------------------|
| Prisma | `EntityNode`, `FieldNode` |
| Zod | `EntityNode`, `FieldNode` |
| Next.js | All types (entities, dashboards, workflows) |
| Auth | Extends `EntityNode` (User model) |
| Billing | Creates new `EntityNode`-like structures |

## Source Location

Every node carries an optional `loc` field for error reporting:

```typescript
interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
```

---

> **Note**: When adding new AST node types, update: (1) `packages/compiler/src/ast.ts`, (2) `packages/parser/src/visitor.ts`, (3) all generators that handle the new type.
