// ---------------------------------------------------------------------------
// @nova/compiler — Public API
// ---------------------------------------------------------------------------
// Main compile() entry point that orchestrates the full pipeline:
//   1. Lexer (tokens)
//   2. Parser (CST)
//   3. Visitor (CST → AST)
//   4. Semantic Analyzer
//   5. Validator
//   6. Returns CompilationResult with diagnostics

import { parseDSL } from '@nova/parser';
import type {
  ProgramNode,
  CompilerOptions,
  CompilerContext,
  CompilerDiagnostic,
  CompilationResult,
  GeneratedArtifact,
  Generator,
} from './ast.js';
import { analyze } from './analyzer.js';
import { validate } from './validator.js';

export type {
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
  Position,
  SourceLocation,
  BaseNode,
  GeneratedArtifact,
  CompilerDiagnostic,
  CompilerOptions,
  CompilerContext,
  Generator,
  CompilationResult,
} from './ast.js';

export { analyze } from './analyzer.js';
export type { AnalysisResult } from './analyzer.js';
export { validate } from './validator.js';
export type { ValidationResult } from './validator.js';
export { PRIMITIVE_TYPES, isPrimitiveType } from './ast.js';
export type { PrimitiveType } from './ast.js';

// ---------------------------------------------------------------------------
// compile() — Main entry point
// ---------------------------------------------------------------------------
export async function compile(
  dslText: string,
  options: CompilerOptions,
  generators: readonly Generator[] = [],
): Promise<CompilationResult> {
  const diagnostics: CompilerDiagnostic[] = [];
  const targetDirectory = options.targetDirectory ?? './generated-app';

  const context: CompilerContext = {
    targetDirectory,
    options,
    diagnostics,
  };

  // Phase 1 & 2: Lex + Parse → CST
  let parseResult;
  try {
    parseResult = parseDSL(dslText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      artifacts: [],
      diagnostics: [
        { severity: 'error', message, code: 'PARSE_ERROR' },
      ],
    };
  }

  // Phase 3: CST → AST (visitor normalization)
  // Import visitor dynamically to avoid circular deps
  const { visitCST } = await import('@nova/parser');
  const program: ProgramNode = visitCST(parseResult.cst as Parameters<typeof visitCST>[0]);

  // Phase 4: Semantic Analysis
  const analysisResult = analyze(program);
  diagnostics.push(...analysisResult.diagnostics);

  if (!analysisResult.isValid) {
    return {
      success: false,
      artifacts: [],
      diagnostics,
    };
  }

  // Phase 5: Validation Pipeline
  const validationResult = validate(program, analysisResult.entityNames);
  diagnostics.push(...validationResult.diagnostics);

  if (!validationResult.isValid) {
    return {
      success: false,
      artifacts: [],
      diagnostics,
    };
  }

  // Phase 6: Generator Pipeline
  const artifacts: GeneratedArtifact[] = [];
  for (const generator of generators) {
    try {
      const generated = await generator.generate(program, context);
      artifacts.push(...generated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      diagnostics.push({
        severity: 'error',
        message: `Generator '${generator.name}' failed: ${message}`,
        code: 'GENERATOR_ERROR',
      });
      return {
        success: false,
        artifacts: [],
        diagnostics,
      };
    }
  }

  // Phase 7: Post-processing
  // Artifacts are returned to the caller (typically the CLI) which writes them to disk.

  return {
    success: true,
    artifacts,
    diagnostics,
  };
}
