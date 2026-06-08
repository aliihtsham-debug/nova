import { EmbeddedActionsParser, type IToken } from 'chevrotain';
import {
  // Operators
  AndOperator,
  OrOperator,
  Equals,
  NotEquals,
  GreaterThan,
  LessThan,
  GreaterThanOrEqual,
  LessThanOrEqual,
  // Punctuation
  LCurly,
  RCurly,
  LRound,
  RRound,
  QuestionMark,
  Comma,
  // Annotations
  RelationKeyword,
  // Declarations
  EntityKeyword,
  DashboardKeyword,
  WorkflowKeyword,
  // Dashboard
  CardKeyword,
  ChartKeyword,
  TableKeyword,
  BarKeyword,
  LineKeyword,
  PieKeyword,
  DonutKeyword,
  FromKeyword,
  WhereKeyword,
  SelectKeyword,
  ByKeyword,
  ColumnKeyword,
  LabelKeyword,
  // Workflow
  IfKeyword,
  ThenKeyword,
  ElseKeyword,
  ActionKeyword,
  NotifyKeyword,
  RunKeyword,
  InputKeyword,
  OutputKeyword,
  ToKeyword,
  ViaKeyword,
  MessageKeyword,
  // Literals & Types
  StringLiteral,
  NumberLiteral,
  TrueKeyword,
  FalseKeyword,
  StringType,
  NumberType,
  BooleanType,
  DateType,
  MoneyType,
  UuidType,
  Identifier,
  allTokens,
  NovaLexer,
} from './tokens.js';

// ---------------------------------------------------------------------------
// NovaParser — Full Chevrotain EmbeddedActionsParser for the Nova DSL
// ---------------------------------------------------------------------------
// Implements the complete EBNF grammar from docs/parser/spec.md
// All rules return CST nodes with location metadata for CST-to-AST conversion.

export class NovaParser extends EmbeddedActionsParser {
  // Top-level
  public program!: () => unknown;
  public declaration!: () => unknown;

  // Declarations
  public entity!: () => unknown;
  public dashboard!: () => unknown;
  public workflow!: () => unknown;

  // Entity internals
  public field!: () => unknown;
  public fieldType!: () => unknown;
  public typeIdentifier!: () => unknown;

  // Dashboard internals
  public dashboardElement!: () => unknown;
  public card!: () => unknown;
  public chart!: () => unknown;
  public chartType!: () => unknown;
  public tableView!: () => unknown;
  public column!: () => unknown;
  public identifierList!: () => unknown;

  // Workflow internals
  public step!: () => unknown;
  public actionStep!: () => unknown;
  public decisionStep!: () => unknown;
  public notifyStep!: () => unknown;
  public notifyChannel!: () => unknown;

  // Expressions
  public expression!: () => unknown;
  public logicalOrExpression!: () => unknown;
  public logicalAndExpression!: () => unknown;
  public comparisonExpression!: () => unknown;
  public comparisonOp!: () => unknown;
  public value!: () => unknown;

  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      maxLookahead: 2,
      dynamicTokensEnabled: false,
    });

    const $ = this;

    // =======================================================================
    // program = { declaration } ;
    // =======================================================================
    $.program = $.RULE('program', () => {
      const declarations: unknown[] = [];
      $.MANY(() => {
        declarations.push($.SUBRULE($.declaration) as unknown);
      });
      return { type: 'ProgramNode', declarations };
    });

    // --- Helpers ---
    $.declaration = $.RULE('declaration', () => {
      return $.OR([
        { ALT: () => $.SUBRULE($.entity) },
        { ALT: () => $.SUBRULE($.dashboard) },
        { ALT: () => $.SUBRULE($.workflow) },
      ]);
    });

    // =======================================================================
    // entity = 'entity' identifier '{' { field } '}'
    // =======================================================================
    $.entity = $.RULE('entity', () => {
      $.CONSUME(EntityKeyword);
      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(LCurly);
      const fields: unknown[] = [];
      $.MANY(() => {
        fields.push($.SUBRULE($.field) as unknown);
      });
      $.CONSUME(RCurly);
      return {
        type: 'EntityNode',
        name: nameToken.image,
        fields,
      };
    });

    // =======================================================================
    // field = identifier type [ '?' ] [ @relation '(' identifier ')' ]
    // =======================================================================
    $.field = $.RULE('field', () => {
      const nameToken = $.CONSUME(Identifier);
      const typeNode = $.SUBRULE($.fieldType);
      let isNullable = false;
      let relationTarget: string | undefined;

      $.OPTION(() => {
        $.CONSUME(QuestionMark);
        isNullable = true;
      });

      $.OPTION2(() => {
        $.CONSUME(RelationKeyword);
        $.CONSUME(LRound);
        const targetToken = $.CONSUME2(Identifier);
        $.CONSUME(RRound);
        relationTarget = targetToken.image;
      });

      const rawType = typeNode as { image: string; name: string };
      const fieldType = rawType.image ?? rawType.name;

      return {
        type: 'FieldNode',
        name: nameToken.image,
        fieldType,
        isNullable,
        isList: false,
        relationTarget,
      };
    });

    // =======================================================================
    // fieldType = typeKeyword | identifier (for custom entity refs)
    // =======================================================================
    $.fieldType = $.RULE('fieldType', () => {
      return $.OR([
        { ALT: () => $.SUBRULE($.typeIdentifier) },
        { ALT: () => $.CONSUME2(Identifier) },
      ]);
    });

    $.typeIdentifier = $.RULE('typeIdentifier', () => {
      return $.OR([
        { ALT: () => $.CONSUME(StringType) },
        { ALT: () => $.CONSUME(NumberType) },
        { ALT: () => $.CONSUME(BooleanType) },
        { ALT: () => $.CONSUME(DateType) },
        { ALT: () => $.CONSUME(MoneyType) },
        { ALT: () => $.CONSUME(UuidType) },
      ]);
    });

    // =======================================================================
    // dashboard = 'dashboard' identifier '{' { dashboard_element } '}'
    // =======================================================================
    $.dashboard = $.RULE('dashboard', () => {
      $.CONSUME(DashboardKeyword);
      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(LCurly);
      const elements: unknown[] = [];
      $.MANY(() => {
        elements.push($.SUBRULE($.dashboardElement) as unknown);
      });
      $.CONSUME(RCurly);
      return {
        type: 'DashboardNode',
        name: nameToken.image,
        elements,
      };
    });

    $.dashboardElement = $.RULE('dashboardElement', () => {
      return $.OR([
        { ALT: () => $.SUBRULE($.card) },
        { ALT: () => $.SUBRULE($.chart) },
        { ALT: () => $.SUBRULE($.tableView) },
      ]);
    });

    // =======================================================================
    // card = 'card' identifier 'from' identifier [ 'where' expression ] [ 'select' identifier_list ]
    // =======================================================================
    $.card = $.RULE('card', () => {
      $.CONSUME(CardKeyword);
      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(FromKeyword);
      const sourceToken = $.CONSUME2(Identifier);

      let whereClause: unknown | undefined;
      $.OPTION(() => {
        $.CONSUME(WhereKeyword);
        whereClause = $.SUBRULE($.expression);
      });

      let selectFields: string[] | undefined;
      $.OPTION2(() => {
        $.CONSUME(SelectKeyword);
        selectFields = $.SUBRULE($.identifierList) as string[];
      });

      return {
        type: 'CardNode',
        name: nameToken.image,
        sourceEntity: sourceToken.image,
        whereClause,
        selectFields,
      };
    });

    // =======================================================================
    // chart = 'chart' chart_type identifier 'from' identifier 'by' identifier [ 'where' expression ]
    // =======================================================================
    $.chart = $.RULE('chart', () => {
      $.CONSUME(ChartKeyword);

      // Chart type is optional — if the next token is a chart type keyword, consume it;
      // otherwise default to 'bar'.
      let chartType = 'bar';
      $.OR([
        {
          GATE: () => $.LA(1).tokenType === BarKeyword ||
                       $.LA(1).tokenType === LineKeyword ||
                       $.LA(1).tokenType === PieKeyword ||
                       $.LA(1).tokenType === DonutKeyword,
          ALT: () => {
            const ct = $.SUBRULE($.chartType) as { chartType: string };
            chartType = ct.chartType;
          },
        },
        { ALT: () => { /* no type keyword — default to bar */ } },
      ]);

      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(FromKeyword);
      const sourceToken = $.CONSUME2(Identifier);
      $.CONSUME(ByKeyword);
      const groupByToken = $.CONSUME3(Identifier);

      let whereClause: unknown | undefined;
      $.OPTION(() => {
        $.CONSUME(WhereKeyword);
        whereClause = $.SUBRULE($.expression);
      });

      return {
        type: 'ChartNode',
        name: nameToken.image,
        chartType,
        sourceEntity: sourceToken.image,
        groupByField: groupByToken.image,
        whereClause,
      };
    });

    $.chartType = $.RULE('chartType', () => {
      return $.OR([
        { ALT: () => { $.CONSUME(BarKeyword); return { chartType: 'bar' }; } },
        { ALT: () => { $.CONSUME(LineKeyword); return { chartType: 'line' }; } },
        { ALT: () => { $.CONSUME(PieKeyword); return { chartType: 'pie' }; } },
        { ALT: () => { $.CONSUME(DonutKeyword); return { chartType: 'donut' }; } },
      ]);
    });

    // =======================================================================
    // table_view = 'table' identifier 'from' identifier [ 'where' expression ] '{' { column } '}'
    // =======================================================================
    $.tableView = $.RULE('tableView', () => {
      $.CONSUME(TableKeyword);
      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(FromKeyword);
      const sourceToken = $.CONSUME2(Identifier);

      let whereClause: unknown | undefined;
      $.OPTION(() => {
        $.CONSUME(WhereKeyword);
        whereClause = $.SUBRULE($.expression);
      });

      $.CONSUME(LCurly);
      const columns: unknown[] = [];
      $.MANY(() => {
        columns.push($.SUBRULE($.column) as unknown);
      });
      $.CONSUME(RCurly);

      return {
        type: 'TableViewNode',
        name: nameToken.image,
        sourceEntity: sourceToken.image,
        whereClause,
        columns,
      };
    });

    $.column = $.RULE('column', () => {
      $.CONSUME(ColumnKeyword);
      const nameToken = $.CONSUME(Identifier);
      let label: string | undefined;
      $.OPTION(() => {
        $.CONSUME(LabelKeyword);
        const labelToken = $.CONSUME(StringLiteral);
        label = labelToken.image.slice(1, -1); // strip quotes
      });
      return { name: nameToken.image, label };
    });

    // =======================================================================
    // identifier_list = identifier { ',' identifier }
    // =======================================================================
    $.identifierList = $.RULE('identifierList', () => {
      const ids: string[] = [];
      ids.push($.CONSUME(Identifier).image);
      $.MANY(() => {
        $.CONSUME(Comma);
        ids.push($.CONSUME2(Identifier).image);
      });
      return ids;
    });

    // =======================================================================
    // workflow = 'workflow' identifier '{' { step } '}'
    // =======================================================================
    $.workflow = $.RULE('workflow', () => {
      $.CONSUME(WorkflowKeyword);
      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(LCurly);
      const steps: unknown[] = [];
      $.MANY(() => {
        steps.push($.SUBRULE($.step) as unknown);
      });
      $.CONSUME(RCurly);
      return {
        type: 'WorkflowNode',
        name: nameToken.image,
        steps,
      };
    });

    $.step = $.RULE('step', () => {
      return $.OR([
        { ALT: () => $.SUBRULE($.actionStep) },
        { ALT: () => $.SUBRULE($.decisionStep) },
        { ALT: () => $.SUBRULE($.notifyStep) },
      ]);
    });

    // =======================================================================
    // action_step = 'action' identifier '{' 'run' string_literal [ 'input' identifier_list ] [ 'output' identifier_list ] '}'
    // =======================================================================
    $.actionStep = $.RULE('actionStep', () => {
      $.CONSUME(ActionKeyword);
      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(LCurly);
      $.CONSUME(RunKeyword);
      // Script name is a string literal
      const scriptToken = $.CONSUME(StringLiteral);

      let inputArgs: string[] | undefined;
      $.OPTION(() => {
        $.CONSUME(InputKeyword);
        inputArgs = $.SUBRULE($.identifierList) as string[];
      });

      let outputVars: string[] | undefined;
      $.OPTION2(() => {
        $.CONSUME(OutputKeyword);
        outputVars = $.SUBRULE2($.identifierList) as string[];
      });

      $.CONSUME(RCurly);

      return {
        type: 'ActionStepNode',
        name: nameToken.image,
        actionScript: scriptToken.image.slice(1, -1), // strip quotes
        inputArguments: inputArgs,
        outputVariables: outputVars,
      };
    });

    // =======================================================================
    // decision_step = 'if' expression 'then' step [ 'else' step ]
    // =======================================================================
    $.decisionStep = $.RULE('decisionStep', () => {
      $.CONSUME(IfKeyword);
      const condition = $.SUBRULE($.expression);
      $.CONSUME(ThenKeyword);
      const thenStep = $.SUBRULE($.step);

      let elseStep: unknown | undefined;
      $.OPTION(() => {
        $.CONSUME(ElseKeyword);
        elseStep = $.SUBRULE2($.step);
      });

      return {
        type: 'DecisionStepNode',
        condition,
        thenStep,
        elseStep,
      };
    });

    // =======================================================================
    // notify_step = 'notify' identifier 'to' string_literal 'via' notify_channel 'message' string_literal
    // =======================================================================
    $.notifyStep = $.RULE('notifyStep', () => {
      $.CONSUME(NotifyKeyword);
      const nameToken = $.CONSUME(Identifier);
      $.CONSUME(ToKeyword);
      const targetToken = $.CONSUME(StringLiteral);
      $.CONSUME(ViaKeyword);
      const channelNode = $.SUBRULE($.notifyChannel) as { channel: string };
      $.CONSUME(MessageKeyword);
      const messageToken = $.CONSUME2(StringLiteral);

      return {
        type: 'NotifyStepNode',
        name: nameToken.image,
        targetAddress: targetToken.image,
        channel: channelNode.channel,
        messageBody: messageToken.image,
      };
    });

    $.notifyChannel = $.RULE('notifyChannel', () => {
      const token = $.CONSUME(Identifier);
      return { channel: token.image.toLowerCase() };
    });

    // =======================================================================
    // expression = logical_or_expression
    // logical_or_expression = logical_and_expression { '||' logical_and_expression }
    // logical_and_expression = comparison_expression { '&&' comparison_expression }
    // comparison_expression = identifier comparison_op value | '(' expression ')'
    // comparison_op = '==' | '!=' | '>' | '<' | '>=' | '<='
    // value = string_literal | number_literal | 'true' | 'false' | identifier
    // =======================================================================
    $.expression = $.RULE('expression', () => {
      return $.SUBRULE($.logicalOrExpression);
    });

    $.logicalOrExpression = $.RULE('logicalOrExpression', () => {
      let left = $.SUBRULE($.logicalAndExpression);
      $.MANY(() => {
        $.CONSUME(OrOperator);
        const right = $.SUBRULE2($.logicalAndExpression);
        left = {
          type: 'LogicalExpressionNode',
          operator: '||',
          left,
          right,
        };
      });
      return left;
    });

    $.logicalAndExpression = $.RULE('logicalAndExpression', () => {
      let left = $.SUBRULE($.comparisonExpression);
      $.MANY(() => {
        $.CONSUME(AndOperator);
        const right = $.SUBRULE2($.comparisonExpression);
        left = {
          type: 'LogicalExpressionNode',
          operator: '&&',
          left,
          right,
        };
      });
      return left;
    });

    $.comparisonExpression = $.RULE('comparisonExpression', () => {
      return $.OR([
        // Parenthesized expression
        {
          ALT: () => {
            $.CONSUME(LRound);
            const expr = $.SUBRULE($.expression);
            $.CONSUME(RRound);
            return expr;
          },
        },
        // identifier comparison_op value
        {
          ALT: () => {
            const leftToken = $.CONSUME(Identifier);
            const opNode = $.SUBRULE($.comparisonOp) as { op: string };
            const rightNode = $.SUBRULE($.value);
            return {
              type: 'BinaryExpressionNode',
              left: { type: 'IdentifierNode', name: leftToken.image },
              operator: opNode.op,
              right: rightNode,
            };
          },
        },
      ]);
    });

    $.comparisonOp = $.RULE('comparisonOp', () => {
      return $.OR([
        { ALT: () => { $.CONSUME(Equals); return { op: '==' }; } },
        { ALT: () => { $.CONSUME(NotEquals); return { op: '!=' }; } },
        { ALT: () => { $.CONSUME(GreaterThan); return { op: '>' }; } },
        { ALT: () => { $.CONSUME(LessThan); return { op: '<' }; } },
        { ALT: () => { $.CONSUME(GreaterThanOrEqual); return { op: '>=' }; } },
        { ALT: () => { $.CONSUME(LessThanOrEqual); return { op: '<=' }; } },
      ]);
    });

    $.value = $.RULE('value', () => {
      return $.OR([
        {
          ALT: () => {
            const token = $.CONSUME(StringLiteral);
            return { type: 'LiteralNode', value: token.image.slice(1, -1) };
          },
        },
        {
          ALT: () => {
            const token = $.CONSUME(NumberLiteral);
            return { type: 'LiteralNode', value: Number(token.image) };
          },
        },
        {
          ALT: () => {
            $.CONSUME(TrueKeyword);
            return { type: 'LiteralNode', value: true };
          },
        },
        {
          ALT: () => {
            $.CONSUME(FalseKeyword);
            return { type: 'LiteralNode', value: false };
          },
        },
        {
          ALT: () => {
            const token = $.CONSUME(Identifier);
            return { type: 'IdentifierNode', name: token.image };
          },
        },
      ]);
    });

    // Mandatory call to validate/initialize the parser rules.
    this.performSelfAnalysis();
  }
}

// Singleton instance for reuse.
export const novaParser = new NovaParser();

/**
 * Parse DSL source text and return the CST (Concrete Syntax Tree).
 * The CST is consumed by the visitor to produce the typed AST.
 */
export function parseDSL(source: string) {
  const lexResult = NovaLexer.tokenize(source);

  if (lexResult.errors.length > 0) {
    const messages = lexResult.errors.map(
      (e: { line?: number; column?: number; message: string }) =>
        `Lexer error at line ${e.line}, column ${e.column}: ${e.message}`,
    );
    throw new Error(messages.join('\n'));
  }

  novaParser.input = lexResult.tokens as IToken[];

  const cst = novaParser.program();

  if (novaParser.errors.length > 0) {
    const messages = novaParser.errors.map(
      (e) => `Parser error at token '${e.token.image}': ${e.message}`,
    );
    throw new Error(messages.join('\n'));
  }

  return { cst, tokens: lexResult.tokens };
}
