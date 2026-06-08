# Lexer Token Registry

This document enumerates all lexer tokens defined in **Nova** parser, explains their purpose, and clarifies the ordering rationale that avoids lexical ambiguities.

## Token Order

The token array in `packages/parser/src/tokens.ts` is deliberately ordered from most specific to most generic. Tokens that could be shadowed by the generic `Identifier` token must appear **before** it.

| # | Token | Pattern | Category |
|---|-------|---------|----------|
| 1 | `WhiteSpace` | `/\s+/` | Skipped |
| 2 | `AndOperator` | `/&&/` | Operator |
| 3 | `OrOperator` | `/\|\|/` | Operator |
| 4 | `Equals` | `/==/` | Operator |
| 5 | `NotEquals` | `/!=/` | Operator |
| 6 | `GreaterThanOrEqual` | `/>=/` | Operator |
| 7 | `LessThanOrEqual` | `/<=/` | Operator |
| 8 | `NotOperator` | `/!/` | Operator |
| 9 | `GreaterThan` | `/>/` | Operator |
| 10 | `LessThan` | `/</` | Operator |
| 11 | `LCurly` | `/\{/` | Punctuation |
| 12 | `RCurly` | `/\}/`  | Punctuation |
| 13 | `LRound` | `/\(/`  | Punctuation |
| 14 | `RRound` | `/\)/`  | Punctuation |
| 15 | `QuestionMark` | `/\?/` | Punctuation |
| 16 | `Comma` | `/,/` | Punctuation |
| 17 | `RelationKeyword` | `/@relation/` | Annotation |
| 18 | `EntityKeyword` | `/entity/` | Declaration |
| 19 | `DashboardKeyword` | `/dashboard/` | Declaration |
| 20 | `WorkflowKeyword` | `/workflow/` | Declaration |
| 21 | `CardKeyword` | `/card/` | Dashboard Element |
| 22 | `ChartKeyword` | `/chart/` | Dashboard Element |
| 23 | `TableKeyword` | `/table/` | Dashboard Element |
| 24 | `BarKeyword` | `/bar/` | Chart Type |
| 25 | `LineKeyword` | `/line/` | Chart Type |
| 26 | `PieKeyword` | `/pie/` | Chart Type |
| 27 | `DonutKeyword` | `/donut/` | Chart Type |
| 28 | `FromKeyword` | `/from/` | Sub-clause |
| 29 | `WhereKeyword` | `/where/` | Sub-clause |
| 30 | `SelectKeyword` | `/select/` | Sub-clause |
| 31 | `ByKeyword` | `/by/` | Sub-clause |
| 32 | `ColumnKeyword` | `/column/` | Sub-clause |
| 33 | `LabelKeyword` | `/label/` | Sub-clause |
| 34 | `IfKeyword` | `/if/` | Workflow |
| 35 | `ThenKeyword` | `/then/` | Workflow |
| 36 | `ElseKeyword` | `/else/` | Workflow |
| 37 | `ActionKeyword` | `/action/` | Workflow |
| 38 | `NotifyKeyword` | `/notify/` | Workflow |
| 39 | `RunKeyword` | `/run/` | Workflow |
| 40 | `InputKeyword` | `/input/` | Sub-clause |
| 41 | `OutputKeyword` | `/output/` | Sub-clause |
| 42 | `ToKeyword` | `/to/` | Sub-clause |
| 43 | `ViaKeyword` | `/via/` | Sub-clause |
| 44 | `MessageKeyword` | `/message/` | Sub-clause |
| 45 | `EmailKeyword` | `/email/` | Channel |
| 46 | `SlackKeyword` | `/slack/` | Channel |
| 47 | `SmsKeyword` | `/sms/` | Channel |
| 48 | `TrueKeyword` | `/true/` | Literal |
| 49 | `FalseKeyword` | `/false/` | Literal |
| 50 | `StringLiteral` | `/"([^"\\]|\\.)*"/` | Literal |
| 51 | `NumberLiteral` | `/-?\d+(\.\d+)?/` | Literal |
| 52 | `StringType` | `/string/` | Type |
| 53 | `NumberType` | `/number/` | Type |
| 54 | `BooleanType` | `/boolean/` | Type |
| 55 | `DateType` | `/date/` | Type |
| 56 | `MoneyType` | `/money/` | Type |
| 57 | `UuidType` | `/uuid/` | Type |
| 58 | `Identifier` | `/[a-zA-Z_][a-zA-Z0-9_]*/` | Generic |

## Why Ordering Matters

Chevrotain's lexer matches the **first** token whose pattern fits the input. If `Identifier` were placed before `AndOperator`, sequences like `&&` would be incorrectly tokenized as two `Identifier` tokens, breaking the parser.

**Critical ordering rules:**

1. **Multi-character operators before single-character** — `==` before `=`, `&&` before `&`
2. **Keywords before Identifier** — `entity`, `dashboard`, `string`, etc. must all precede `Identifier`
3. **Type keywords before Identifier** — `string`, `number`, etc. are both valid types and identifiers
4. **Boolean literals before Identifier** — `true`/`false` would match as identifiers otherwise
5. **Type keywords before Identifier** — DSL types like `string`, `number` are keywords in type position

## Usage

The token list is exported as `allTokens` and used to construct the lexer:

```typescript
import { Lexer } from 'chevrotain';
import { allTokens } from './tokens';
export const NovaLexer = new Lexer(allTokens);
```

Developers can reference this registry when extending the language — any new keyword or operator must be added **above** `Identifier`.
