# Parser Specification

## Overview

The Nova parser (`@nova/parser`) uses **Chevrotain** to tokenize and parse `.nova` DSL files into a Concrete Syntax Tree (CST), which is then converted to a typed Abstract Syntax Tree (AST) by the visitor.

## Architecture

```
Source Text → Lexer (tokens) → Parser (CST) → Visitor (AST)
```

## Lexer

### Token Definitions

All tokens are defined in `packages/parser/src/tokens.ts`. The lexer uses Chevrotain's `Lexer` class with the `allTokens` array.

**Token ordering** (most-specific first):
1. Whitespace (skipped)
2. Multi-character operators (`&&`, `||`, `==`, `!=`, `>=`, `<=`)
3. Single-character operators (`!`, `>`, `<`, `{`, `}`, `(`, `)`, `?`, `,`)
4. Annotation (`@relation`)
5. Declaration keywords (`entity`, `dashboard`, `workflow`)
6. Dashboard element keywords (`card`, `chart`, `table`)
7. Chart types (`bar`, `line`, `pie`, `donut`)
8. Dashboard sub-clauses (`from`, `where`, `select`, `by`, `column`, `label`)
9. Workflow step keywords (`if`, `then`, `else`, `action`, `notify`, `run`)
10. Workflow sub-clauses (`input`, `output`, `to`, `via`, `message`)
11. Notify channels (`email`, `slack`, `sms`)
12. Boolean literals (`true`, `false`)
13. Value literals (`StringLiteral`, `NumberLiteral`)
14. Type keywords (`string`, `number`, `boolean`, `date`, `money`, `uuid`)
15. `Identifier` (always last)

### Lexer Output

```typescript
interface LexerResult {
  tokens: IToken[];
  errors: ILexerError[];
}
```

## Parser

### Grammar (EBNF)

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

### Parser Rules

The parser is implemented as a Chevrotain `EmbeddedActionsParser` in `packages/parser/src/parser.ts`. Each grammar rule maps to a `this.RULE()` method that returns a CST node.

### Error Recovery

Chevrotain's built-in error recovery is enabled:
- `recoveryEnabled: true`
- `maxLookahead: 2`
- On syntax error, the parser attempts token insertion/deletion to recover
- Errors are collected in `parser.errors` and reported to the user

### CST Output

Each rule returns a plain object with a `type` field:

```typescript
// Example: entity rule output
{
  type: 'EntityNode',
  name: 'User',
  fields: [
    { type: 'FieldNode', name: 'id', fieldType: 'uuid', isNullable: false, isList: false },
    { type: 'FieldNode', name: 'name', fieldType: 'string', isNullable: false, isList: false },
  ]
}
```

## Visitor (CST → AST)

The visitor in `packages/parser/src/visitor.ts` converts raw CST nodes into typed AST nodes from `@nova/compiler`:

1. `visitCST(root)` → `ProgramNode`
2. `visitDeclaration(node)` → `EntityNode | DashboardNode | WorkflowNode`
3. `visitEntityNode(node)` → `EntityNode` with typed fields
4. `visitFieldNode(node)` → `FieldNode` with normalized types
5. `visitDashboardElement(node)` → `CardNode | ChartNode | TableViewNode`
6. `visitStep(node)` → `ActionStepNode | DecisionStepNode | NotifyStepNode`
7. `visitExpression(node)` → `ExpressionNode` (recursive)

### Location Tracking

Each AST node includes an optional `loc: SourceLocation` field:
```typescript
interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
```

## Public API

```typescript
import { parseDSL, NovaLexer, allTokens, NovaParser, visitCST } from '@nova/parser';

// Parse DSL source to CST + tokens
const { cst, tokens } = parseDSL(source);

// Convert CST to AST
const ast = visitCST(cst);

// Access lexer directly
const lexResult = NovaLexer.tokenize(source);

// Access parser directly
const parser = new NovaParser();
parser.input = lexResult.tokens;
const cst = parser.program();
```

## Error Messages

| Error Type | Example Message |
|-----------|----------------|
| Lexer | `Lexer error at line 5, column 12: unexpected character @` |
| Parser | `Parser error at token 'then': expecting 'if' but found 'then'` |
| Recovery | `Parser recovered by inserting missing '}'` |

## Performance

| Metric | Target |
|--------|--------|
| Lex 500 lines | < 10ms |
| Parse 500 lines | < 50ms |
| Visitor conversion | < 10ms |
| Total pipeline | < 100ms |
