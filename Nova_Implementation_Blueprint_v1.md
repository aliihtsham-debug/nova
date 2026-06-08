# Nova Implementation Blueprint v1.0

---

## 1. Product Definition
Nova is an AI-native compiler producing production-ready, highly-maintainable Next.js 14+ web applications with a PostgreSQL database backed by Prisma and TypeScript.
* **Non-Proprietary Runtime**: Generated applications run on standard Next.js, and can be built and deployed without custom Nova packages.
* **Extensibility & Overwrite Safety**: The compiler respects custom code blocks added by developers. Any generated React page or server file supports boundary annotations:
  ```typescript
  // <nova-custom-start id="user-profile-widget">
  // Developer customizations are preserved here across compile runs
  // </nova-custom-start id="user-profile-widget">
  ```
  During compilation, the emitter reads the existing target file, parses custom code blocks by matching IDs, and merges them into the new artifact.

---

## 2. System Architecture
Nova compiles application specifications in a multi-stage process managed in a pnpm monorepo. Compilation is deterministic. Running compilation on the same DSL file yields identical outputs.

---

## 3. Monorepo Structure
The codebase uses a `pnpm` monorepo configuration. Refer to the file tree inside the Technical Architecture Document.

---

## 4. DSL Grammar (EBNF)
The Domain-Specific Language (DSL) EBNF grammar defines entities, fields, dashboards, and workflows:

```ebnf
program = { declaration } ;
declaration = entity | dashboard | workflow ;

identifier = [a-zA-Z_] { [a-zA-Z0-9_] } ;
string_literal = '"' { any_character } '"' ;
number_literal = [ "-" ] digit { digit } ;

entity = 'entity' identifier '{' { field } '}' ;
field = identifier type [ '?' ] [ '@relation' '(' identifier ')' ] ;
type = 'string' | 'number' | 'boolean' | 'date' | 'money' | 'uuid' | identifier ;

dashboard = 'dashboard' identifier '{' { dashboard_element } '}' ;
dashboard_element = card | chart | table_view ;
card = 'card' identifier 'from' identifier [ 'where' expression ] [ 'select' identifier_list ] ;
chart = 'chart' chart_type identifier 'from' identifier 'by' identifier [ 'where' expression ] ;
chart_type = 'bar' | 'line' | 'pie' | 'donut' ;
table_view = 'table' identifier 'from' identifier [ 'where' expression ] '{' { column } '}' ;
column = 'column' identifier [ 'label' string_literal ] ;
identifier_list = identifier { ',' identifier } ;

workflow = 'workflow' identifier '{' { step } '}' ;
step = action_step | decision_step | notify_step ;
action_step = 'action' identifier '{' 'run' string_literal [ 'input' identifier_list ] [ 'output' identifier_list ] '}' ;
decision_step = 'if' expression 'then' step [ 'else' step ] ;
notify_step = 'notify' identifier 'to' string_literal 'via' notify_channel 'message' string_literal ;
notify_channel = 'email' | 'slack' | 'sms' ;

expression = logical_or_expression ;
logical_or_expression = logical_and_expression { '||' logical_and_expression } ;
logical_and_expression = comparison_expression { '&&' comparison_expression } ;
comparison_expression = identifier comparison_op value | '(' expression ')' ;
comparison_op = '==' | '!=' | '>' | '<' | '>=' | '<=' ;
value = string_literal | number_literal | 'true' | 'false' | identifier ;
```

---

## 5. AST Specification (TypeScript Types)
The complete AST structure is defined as a TypeScript compiler schema:

```typescript
export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface BaseNode {
  type: string;
  loc?: SourceLocation;
}

export interface ProgramNode extends BaseNode {
  type: 'Program';
  declarations: DeclarationNode[];
}

export type DeclarationNode = EntityNode | DashboardNode | WorkflowNode;

export interface EntityNode extends BaseNode {
  type: 'Entity';
  name: string;
  fields: FieldNode[];
}

export interface FieldNode extends BaseNode {
  type: 'Field';
  name: string;
  fieldType: string; // PrimitiveType or reference entity name
  isNullable: boolean;
  isList: boolean;
  relationTarget?: string;
}

export interface DashboardNode extends BaseNode {
  type: 'Dashboard';
  name: string;
  elements: DashboardElementNode[];
}

export type DashboardElementNode = CardNode | ChartNode | TableViewNode;

export interface CardNode extends BaseNode {
  type: 'Card';
  name: string;
  sourceEntity: string;
  whereClause?: ExpressionNode;
  selectFields?: string[];
}

export interface ChartNode extends BaseNode {
  type: 'Chart';
  name: string;
  chartType: 'bar' | 'line' | 'pie' | 'donut';
  sourceEntity: string;
  groupByField: string;
  whereClause?: ExpressionNode;
}

export interface TableViewNode extends BaseNode {
  type: 'TableView';
  name: string;
  sourceEntity: string;
  whereClause?: ExpressionNode;
  columns: Array<{ name: string; label?: string }>;
}

export interface WorkflowNode extends BaseNode {
  type: 'Workflow';
  name: string;
  steps: StepNode[];
}

export type StepNode = ActionStepNode | DecisionStepNode | NotifyStepNode;

export interface ActionStepNode extends BaseNode {
  type: 'ActionStep';
  name: string;
  actionScript: string;
  inputArguments?: string[];
  outputVariables?: string[];
}

export interface DecisionStepNode extends BaseNode {
  type: 'DecisionStep';
  condition: ExpressionNode;
  thenStep: StepNode;
  elseStep?: StepNode;
}

export interface NotifyStepNode extends BaseNode {
  type: 'NotifyStep';
  name: string;
  targetAddress: string;
  channel: 'email' | 'slack' | 'sms';
  messageBody: string;
}

export type ExpressionNode = BinaryExpressionNode | LogicalExpressionNode | LiteralNode | IdentifierNode;

export interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  left: ExpressionNode;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  right: ExpressionNode;
}

export interface LogicalExpressionNode extends BaseNode {
  type: 'LogicalExpression';
  left: ExpressionNode;
  operator: '&&' | '||';
  right: ExpressionNode;
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface LiteralNode extends BaseNode {
  type: 'Literal';
  value: string | number | boolean;
}
```

---

## 6. Type System
Nova implements a static, relational type system supporting:
* **Primitive Types**: `string` (Text), `number` (Int/Float), `boolean` (True/False), `date` (DateTime), `money` (Decimal), `uuid` (UUID token).
* **Optional Flag (`?`)**: Declares nullable fields in Database schemas and validator files.
* **Relations**: Declarative foreign-key setup.

---

## 7. Parser Design
The parser uses **Chevrotain** for high-speed LL(k) parsing.

```typescript
import { Lexer, EmbeddedActionsParser, createToken } from 'chevrotain';

// Token Registry Definitions
export const EntityKeyword = createToken({ name: 'EntityKeyword', pattern: /entity/ });
export const DashboardKeyword = createToken({ name: 'DashboardKeyword', pattern: /dashboard/ });
export const WorkflowKeyword = createToken({ name: 'WorkflowKeyword', pattern: /workflow/ });
export const CardKeyword = createToken({ name: 'CardKeyword', pattern: /card/ });
export const ChartKeyword = createToken({ name: 'ChartKeyword', pattern: /chart/ });
export const TableKeyword = createToken({ name: 'TableKeyword', pattern: /table/ });
export const IfKeyword = createToken({ name: 'IfKeyword', pattern: /if/ });
export const ThenKeyword = createToken({ name: 'ThenKeyword', pattern: /then/ });
export const ElseKeyword = createToken({ name: 'ElseKeyword', pattern: /else/ });
export const ActionKeyword = createToken({ name: 'ActionKeyword', pattern: /action/ });
export const NotifyKeyword = createToken({ name: 'NotifyKeyword', pattern: /notify/ });
export const RunKeyword = createToken({ name: 'RunKeyword', pattern: /run/ });

export const RelationKeyword = createToken({ name: 'RelationKeyword', pattern: /@relation/ });
export const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ });
export const StringLiteral = createToken({ name: 'StringLiteral', pattern: /"([^"\\]|\\.)*"/ });
export const NumberLiteral = createToken({ name: 'NumberLiteral', pattern: /-?\d+/ });

export const LCurly = createToken({ name: 'LCurly', pattern: /\{/ });
export const RCurly = createToken({ name: 'RCurly', pattern: /\}/ });
export const LRound = createToken({ name: 'LRound', pattern: /\(/ });
export const RRound = createToken({ name: 'RRound', pattern: /\)/ });
export const QuestionMark = createToken({ name: 'QuestionMark', pattern: /\?/ });
export const Equals = createToken({ name: 'Equals', pattern: /==/ });
export const AndOperator = createToken({ name: 'AndOperator', pattern: /&&/ });
export const OrOperator = createToken({ name: 'OrOperator', pattern: /\|\|/ });

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED
});

export const allTokens = [
  WhiteSpace,
  EntityKeyword,
  DashboardKeyword,
  WorkflowKeyword,
  CardKeyword,
  ChartKeyword,
  TableKeyword,
  IfKeyword,
  ThenKeyword,
  ElseKeyword,
  ActionKeyword,
  NotifyKeyword,
  RunKeyword,
  Equals,
  AndOperator,
  OrOperator,
  LCurly,
  RCurly,
  LRound,
  RRound,
  QuestionMark,
  StringLiteral,
  NumberLiteral,
  RelationKeyword,
  Identifier
];

export const NovaLexer = new Lexer(allTokens);

### Lexer Token Registry

The full token list and ordering rationale are documented in [docs/parser/token_registry.md](file:///e:/NOVA/docs/parser/token_registry.md). Specific tokens (e.g., `AndOperator`, `OrOperator`, `NotOperator`, `RelationKeyword`) are placed before the generic `Identifier` to avoid lexing ambiguities.

```

---

## 8. Compiler Contracts
Generators conform to strict TypeScript interfaces.

```typescript
export interface GeneratedArtifact {
  path: string;       // target relative path
  content: string;    // text context
  type: 'file' | 'directory';
}

export interface CompilerContext {
  targetDirectory: string;
  options: {
    verbose?: boolean;
    projectName: string;
  };
  diagnostics: Array<{
    severity: 'error' | 'warning';
    message: string;
    line?: number;
    column?: number;
  }>;
}

export interface Generator {
  name: string;
  generate(program: ProgramNode, context: CompilerContext): Promise<GeneratedArtifact[]>;
}
```

---

## 9. Database Generation
Emits output matching standard PostgreSQL targets.

---

## 10. API Generation
Generates typed REST handlers and Next.js Server Actions.

---

## 11. Frontend Generation
Next.js App Router structure optimized for load performance.

---

## 12. Authentication
Emits Next-Auth configuration.

---

## 13. Billing
Generates Stripe abstraction tables and helper endpoints.

---

## 14. OpenRouter Architecture
Coordinates asynchronous AI completions using **OpenRouter**.

---

## 15. OpenRouter Interfaces (SDK Wrapper Specification)
The client SDK wrapper defines structured request execution:

```typescript
import { z } from 'zod';

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(prompt: string, options?: CompletionOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/nova-compiler/nova',
        'X-Title': 'Nova Application Compiler'
      },
      body: JSON.stringify({
        model: process.env.NOVA_MODEL || 'owl-alpha',
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 2000
      })
    });
    const json = await response.json();
    return json.choices[0].message.content;
  }

  async generateStructured<T>(prompt: string, schema: z.Schema<T>): Promise<T> {
    const raw = await this.generate(
      `${prompt}\nReturn strictly a JSON object conforming to: ${JSON.stringify(schema)}`
    );
    return schema.parse(JSON.parse(raw));
  }
}
```

---

## 16. Owl Alpha Prompting (System Templates)
System instructions are scoped to maintain semantic correctness and structural alignment.

### 16.1 Code Generation Agent Prompt
```
You are the Nova Code Generation Agent. 
Your task is to generate React client pages using Tailwind CSS and shadcn/ui components.
INPUT: Valid DSL AST representation of views and dashboards.
RULES:
1. Output ONLY runnable TypeScript/React (.tsx) code.
2. Use standard ESM imports. Import shadcn components from "@/components/ui/".
3. Wrap all custom user interactions in standard React Server Actions triggers.
4. Do NOT inject comments or markdown styling blocks around the code.
```

### 16.2 Repair Agent Prompt
```
You are the Nova Compiler Repair Agent.
INPUT: Broken generated code, along with compiler console error streams.
RULES:
1. Locate the exact line containing compilation failures.
2. Emit a replacement diff containing only lines corrected.
3. Preserve the developer custom hooks bounded by "// <nova-custom-start>".
```

---

## 17. Agent Orchestration Flow
System workflows execute in sequence:

```
[Spec Description] 
   |
   v
Architecture Agent (Generates schema.nova)
   |
   v
Parser Engine (Syntactic and type check validation)
   |
   v
Code Generation Agent (Writes custom UI pages, API endpoints)
   |
   v
Testing Agent (Assembles Playwright integration scripts)
   |
   v
Local Verification (Build and run testing suites)
   |
   +---> Fail? -> Repair Agent (Corrects code syntax) -> Retry Verification
   +---> Pass? -> Deploy Pipeline
```

---

## 18. CLI Specification (Commands and Exit Codes)
Command executions emit specific exit codes for script pipeline checking:

| Command | Arguments | Flags | Exit Codes |
| --- | --- | --- | --- |
| `nova init` | `<project-name>` | `--template=<type>` | **0**: Success, **1**: Path exists / Permission Denied |
| `nova generate` | None | `--file=<path>` | **0**: Success, **2**: Syntax Parsing Failure, **3**: Semantic Check Fail, **4**: LLM Network Timeout |
| `nova dev` | None | None | **0**: Terminated by SIGINT, **1**: Port in use |
| `nova test` | None | `--coverage` | **0**: All tests pass, **5**: Assertion failure |
| `nova deploy` | None | `--stage=<name>` | **0**: Build success, **6**: Migrations fail, **7**: Credentials missing |

---

## 19. LSP Message Contracts (JSON-RPC)
The language server communicates using VS Code LSP standards:

### 19.1 Diagnostics: `textDocument/publishDiagnostics`
```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/publishDiagnostics",
  "params": {
    "uri": "file:///workspace/project/app.nova",
    "diagnostics": [
      {
        "range": {
          "start": { "line": 12, "character": 4 },
          "end": { "line": 12, "character": 16 }
        },
        "severity": 1,
        "code": "SEMANTIC_TYPE_MISMATCH",
        "message": "Field type 'integer' is not valid. Did you mean 'number'?"
      }
    ]
  }
}
```

### 19.2 Completion Request: `textDocument/completion`
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "textDocument/completion",
  "params": {
    "textDocument": {
      "uri": "file:///workspace/project/app.nova"
    },
    "position": { "line": 15, "character": 8 }
  }
}
```
Response:
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": [
    { "label": "string", "kind": 12, "detail": "Primitive Text" },
    { "label": "number", "kind": 12, "detail": "Primitive Numeric" },
    { "label": "boolean", "kind": 12, "detail": "Primitive Logical" }
  ]
}
```

### 19.3 Go-To-Definition: `textDocument/definition`
Request:
```json
{
  "jsonrpc": "2.0",
  "id": 43,
  "method": "textDocument/definition",
  "params": {
    "textDocument": { "uri": "file:///workspace/project/app.nova" },
    "position": { "line": 10, "character": 15 }
  }
}
```
Response:
```json
{
  "jsonrpc": "2.0",
  "id": 43,
  "result": {
    "uri": "file:///workspace/project/app.nova",
    "range": {
      "start": { "line": 2, "character": 7 },
      "end": { "line": 2, "character": 11 }
    }
  }
}
```

### 19.4 Hover Documentation: `textDocument/hover`
Request:
```json
{
  "jsonrpc": "2.0",
  "id": 44,
  "method": "textDocument/hover",
  "params": {
    "textDocument": { "uri": "file:///workspace/project/app.nova" },
    "position": { "line": 12, "character": 5 }
  }
}
```
Response:
```json
{
  "jsonrpc": "2.0",
  "id": 44,
  "result": {
    "contents": {
      "kind": "markdown",
      "value": "**Account Entity**\n\nRepresents a user account containing fields for financial transactions and status."
    }
  }
}
```

---

## 20. Template Engine
Uses **EJS** (Embedded JavaScript templates) to inject AST variables into pre-designed React components.

---

## 21. Testing Strategy
* **Vitest**: Runs inside `packages/*` executing parser and compiler verification test cases.
* **Playwright**: Installed in the generated project, executing browser sessions to verify login forms and CRUD pages.

---

## 22. Security Model
* **Zod Sanitation**: Verifies payload fields match schema layouts, rejecting untrusted inputs.
* **CSRF Protection**: Next.js Server Actions automatically validate tokens, blocking Cross-Site Request Forgeries.
* **RBAC Verification**: Database roles are validated on every database query using Prisma interceptors.

---

## 23. Observability & Telemetry
* **Logging**: Uses structured JSON logging (Winston) containing scope, trace IDs, and levels.
* **Metrics**: Compiles execution speeds, parser errors, and LLM call durations to report diagnostic stats.

---

## 24. Acceptance Criteria
* **Execution Time**: The DSL compiler must parse and generate the application in under 10 seconds.
* **Syntax Correctness**: Generated Next.js applications must compile via `npm run build` without any syntax or type errors.
* **Functional CRUD**: Generates full, functional CRUD screens for all defined entities, including searching, pagination, sorting, and form validation.

---

## 25. Sprint Plan
* **Sprint 1 (Weeks 1-2)**: Initialize monorepo, complete Chevrotain parser definitions, and verify AST outputs.
* **Sprint 2 (Weeks 3-4)**: Implement Prisma and Zod generator modules, and compile database configurations.
* **Sprint 3 (Weeks 5-6)**: Develop the Next.js page generation templates and API server actions.
* **Sprint 4 (Weeks 7-8)**: Integrate Next-Auth configurations, RBAC middlewares, and Stripe billing models.
* **Sprint 5 (Weeks 9-10)**: Establish the OpenRouter agent runner pipelines, verify test scripts, and launch the MVP.

---

## 26. Coding Standards
* **Strict TypeScript**: `tsconfig.json` compiles with `"strict": true`, `"noImplicitAny": true`, and `"strictNullChecks": true`.
* **Linting & Code Style**: Prettier and ESLint rule validations are executed pre-commit.
* **Typed Public APIs**: Every exported module inside `packages/*` must specify return types and parameter structures.

---

## 27. MVP Deliverables
* **Parser Package**: Parses basic DSL entities.
* **CLI Package**: Exposes `init`, `generate`, and `dev` commands.
* **Generators**: Emits functioning Prisma schemas, Zod schemas, App Router APIs, and basic CRUD page structures.
* **AI Orchestrator**: Wraps OpenRouter API interactions with retry mechanics.

---

## 28. Risks & Mitigations
* **Risk 1: AI Code Failures**: LLM updates can result in syntax or type errors in the generated React pages.
  * *Mitigation*: Run generated UI pages through `tsc --noEmit` locally, triggering the Repair Agent to resolve any reported type errors.
* **Risk 2: Multi-Tenant Data Leakage**: Insecure queries can leak tenant rows.
  * *Mitigation*: Automatically append tenant filter scopes to Prisma database operations in the generated route handlers.

---

## 29. Roadmap
* **v1.0 (CRUD & Auth)**: Launches the core compiler engine with credentials authentication, database generation, and basic UI pages.
* **v2.0 (Custom Workflows)**: Adds declarative background tasks, job states, and Stripe/Resend integrations.
* **v3.0 (Agent Automation)**: Introduces the VS Code LSP extension, visual dashboard designers, and interactive playground updates.
* **v4.0 (Multi-Platform)**: Supports compiling alternative frameworks (e.g., React Native mobile packages).

---

## 30. Execution Test Fixtures (DSL vs Expected Prisma Target)
An integration compiler test asserts correct emission behavior mapping the `.nova` input to target files:

### 30.1 DSL Input Test Fixture (`test/fixtures/app.nova`)
```nova
entity Account {
  id uuid
  username string
  isActive boolean
  balance money
}

dashboard SalesReport {
  card TotalUsers from Account
  chart bar BalanceDist from Account by balance
}
```

### 30.2 Expected Output Compiled Database Schema (`test/fixtures/expected_schema.prisma`)
```prisma
// Generated by Nova Compiler - DO NOT EDIT

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Account {
  id        String   @id @default(uuid())
  username  String
  isActive  Boolean
  balance   Decimal
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
