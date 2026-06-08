import { createToken, Lexer } from 'chevrotain';

// ---------------------------------------------------------------------------
// Token definitions for Nova DSL (Chevrotain lexer)
// ---------------------------------------------------------------------------
// Ordering: most-specific first, generic Identifier last.
// Chevrotain matches the first token whose pattern fits, so keywords and
// operators MUST appear before Identifier to avoid shadowing.

// Whitespace is skipped globally.
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// --- Multi-character operators (before single-char to avoid partial matches) ---
export const AndOperator = createToken({ name: 'AndOperator', pattern: /&&/ });
export const OrOperator = createToken({ name: 'OrOperator', pattern: /\|\|/ });
export const Equals = createToken({ name: 'Equals', pattern: /==/ });
export const NotEquals = createToken({ name: 'NotEquals', pattern: /!=/ });
export const GreaterThanOrEqual = createToken({ name: 'GreaterThanOrEqual', pattern: />=/ });
export const LessThanOrEqual = createToken({ name: 'LessThanOrEqual', pattern: /<=/ });

// --- Single-character operators/punctuation ---
export const NotOperator = createToken({ name: 'NotOperator', pattern: /!/ });
export const GreaterThan = createToken({ name: 'GreaterThan', pattern: />/ });
export const LessThan = createToken({ name: 'LessThan', pattern: /</ });
export const LCurly = createToken({ name: 'LCurly', pattern: /\{/ });
export const RCurly = createToken({ name: 'RCurly', pattern: /\}/ });
export const LRound = createToken({ name: 'LRound', pattern: /\(/ });
export const RRound = createToken({ name: 'RRound', pattern: /\)/ });
export const QuestionMark = createToken({ name: 'QuestionMark', pattern: /\?/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });

// --- Annotations ---
export const RelationKeyword = createToken({ name: 'RelationKeyword', pattern: /@relation/ });

// --- Declaration keywords ---
export const EntityKeyword = createToken({ name: 'EntityKeyword', pattern: /entity/ });
export const DashboardKeyword = createToken({ name: 'DashboardKeyword', pattern: /dashboard/ });
export const WorkflowKeyword = createToken({ name: 'WorkflowKeyword', pattern: /workflow/ });

// --- Dashboard element keywords ---
export const CardKeyword = createToken({ name: 'CardKeyword', pattern: /card/ });
export const ChartKeyword = createToken({ name: 'ChartKeyword', pattern: /chart/ });
export const TableKeyword = createToken({ name: 'TableKeyword', pattern: /table/ });

// --- Chart type keywords ---
export const BarKeyword = createToken({ name: 'BarKeyword', pattern: /bar/ });
export const LineKeyword = createToken({ name: 'LineKeyword', pattern: /line/ });
export const PieKeyword = createToken({ name: 'PieKeyword', pattern: /pie/ });
export const DonutKeyword = createToken({ name: 'DonutKeyword', pattern: /donut/ });

// --- Dashboard sub-clause keywords ---
export const FromKeyword = createToken({ name: 'FromKeyword', pattern: /from/ });
export const WhereKeyword = createToken({ name: 'WhereKeyword', pattern: /where/ });
export const SelectKeyword = createToken({ name: 'SelectKeyword', pattern: /select/ });
export const ByKeyword = createToken({ name: 'ByKeyword', pattern: /by/ });
export const ColumnKeyword = createToken({ name: 'ColumnKeyword', pattern: /column/ });
export const LabelKeyword = createToken({ name: 'LabelKeyword', pattern: /label/ });

// --- Workflow step keywords ---
export const IfKeyword = createToken({ name: 'IfKeyword', pattern: /if/ });
export const ThenKeyword = createToken({ name: 'ThenKeyword', pattern: /then/ });
export const ElseKeyword = createToken({ name: 'ElseKeyword', pattern: /else/ });
export const ActionKeyword = createToken({ name: 'ActionKeyword', pattern: /action/ });
export const NotifyKeyword = createToken({ name: 'NotifyKeyword', pattern: /notify/ });
export const RunKeyword = createToken({ name: 'RunKeyword', pattern: /run/ });

// --- Workflow sub-clause keywords ---
export const InputKeyword = createToken({ name: 'InputKeyword', pattern: /input/ });
export const OutputKeyword = createToken({ name: 'OutputKeyword', pattern: /output/ });
export const ToKeyword = createToken({ name: 'ToKeyword', pattern: /to/ });
export const ViaKeyword = createToken({ name: 'ViaKeyword', pattern: /via/ });
export const MessageKeyword = createToken({ name: 'MessageKeyword', pattern: /message/ });

// --- Notify channel keywords ---
export const EmailKeyword = createToken({ name: 'EmailKeyword', pattern: /email/ });
export const SlackKeyword = createToken({ name: 'SlackKeyword', pattern: /slack/ });
export const SmsKeyword = createToken({ name: 'SmsKeyword', pattern: /sms/ });

// --- Boolean literals ---
export const TrueKeyword = createToken({ name: 'TrueKeyword', pattern: /true/ });
export const FalseKeyword = createToken({ name: 'FalseKeyword', pattern: /false/ });

// --- Literals ---
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"([^"\\]|\\.)*"/,
});
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?\d+(\.\d+)?/,
});

// --- Type keywords (handled as keywords, not identifiers) ---
export const StringType = createToken({ name: 'StringType', pattern: /string/ });
export const NumberType = createToken({ name: 'NumberType', pattern: /number/ });
export const BooleanType = createToken({ name: 'BooleanType', pattern: /boolean/ });
export const DateType = createToken({ name: 'DateType', pattern: /date/ });
export const MoneyType = createToken({ name: 'MoneyType', pattern: /money/ });
export const UuidType = createToken({ name: 'UuidType', pattern: /uuid/ });

// --- Generic identifier (MUST be last) ---
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

// ---------------------------------------------------------------------------
// Token array — Chevrotain lexer matches in this order.
// ---------------------------------------------------------------------------
export const allTokens: typeof Identifier[] = [
  WhiteSpace,

  // Multi-char operators
  AndOperator,
  OrOperator,
  Equals,
  NotEquals,
  GreaterThanOrEqual,
  LessThanOrEqual,

  // Single-char operators
  NotOperator,
  GreaterThan,
  LessThan,
  LCurly,
  RCurly,
  LRound,
  RRound,
  QuestionMark,
  Comma,

  // Annotations
  RelationKeyword,

  // Declaration keywords
  EntityKeyword,
  DashboardKeyword,
  WorkflowKeyword,

  // Dashboard element keywords
  CardKeyword,
  ChartKeyword,
  TableKeyword,

  // Chart types
  BarKeyword,
  LineKeyword,
  PieKeyword,
  DonutKeyword,

  // Dashboard sub-clauses
  FromKeyword,
  WhereKeyword,
  SelectKeyword,
  ByKeyword,
  ColumnKeyword,
  LabelKeyword,

  // Workflow step keywords
  IfKeyword,
  ThenKeyword,
  ElseKeyword,
  ActionKeyword,
  NotifyKeyword,
  RunKeyword,

  // Workflow sub-clauses
  InputKeyword,
  OutputKeyword,
  ToKeyword,
  ViaKeyword,
  MessageKeyword,

  // Notify channels
  EmailKeyword,
  SlackKeyword,
  SmsKeyword,

  // Boolean literals
  TrueKeyword,
  FalseKeyword,

  // Literals
  StringLiteral,
  NumberLiteral,

  // Type keywords
  StringType,
  NumberType,
  BooleanType,
  DateType,
  MoneyType,
  UuidType,

  // Generic identifier (always last)
  Identifier,
];

export const NovaLexer = new Lexer(allTokens);
