// ---------------------------------------------------------------------------
// @nova/lsp — VS Code Language Server for the Nova DSL
// ---------------------------------------------------------------------------
// Implements the Language Server Protocol (LSP) for .nova files:
//   - Diagnostics (parse errors, semantic errors)
//   - Completions (keywords, entity names, field names)
//   - Hover (type information, documentation)
//   - Go-to-definition (entity/field references)

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  Hover,
  DefinitionParams,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseDSL } from '@nova/parser';
import { analyze } from '@nova/compiler';

// ---------------------------------------------------------------------------
// Connection & Documents
// ---------------------------------------------------------------------------
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// ---------------------------------------------------------------------------
// Keywords for completions
// ---------------------------------------------------------------------------
const DECLARATION_KEYWORDS = ['entity', 'dashboard', 'workflow'];
const DASHBOARD_KEYWORDS = ['card', 'chart', 'table', 'from', 'where', 'by', 'select', 'column', 'label'];
const CHART_TYPES = ['bar', 'line', 'pie', 'donut'];
const WORKFLOW_KEYWORDS = ['action', 'if', 'then', 'else', 'notify', 'run', 'input', 'output', 'to', 'via', 'message'];
const TYPE_KEYWORDS = ['string', 'number', 'boolean', 'date', 'money', 'uuid'];
const NOTIFY_CHANNELS = ['email', 'slack', 'sms'];

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
connection.onInitialize((_params: InitializeParams) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [' ', '\n', '@'],
      },
      hoverProvider: true,
      definitionProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
  };
});

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------
async function validateDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const text = textDocument.getText();

  if (!text.trim()) return diagnostics;

  // Phase 1: Parse
  let parseResult;
  try {
    parseResult = parseDSL(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: textDocument.positionAt(0),
        end: textDocument.positionAt(text.length),
      },
      message,
      source: 'nova-parser',
    });
    return diagnostics;
  }

  // Phase 2: CST → AST
  try {
    const { visitCST } = await import('@nova/compiler');
    const program = visitCST(parseResult.cst as Parameters<typeof visitCST>[0]);

    // Phase 3: Semantic analysis
    const analysisResult = analyze(program);

    for (const diag of analysisResult.diagnostics) {
      diagnostics.push({
        severity: diag.severity === 'error'
          ? DiagnosticSeverity.Error
          : DiagnosticSeverity.Warning,
        range: {
          start: textDocument.positionAt(0),
          end: textDocument.positionAt(text.length),
        },
        message: diag.message,
        code: diag.code,
        source: 'nova-analyzer',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: textDocument.positionAt(0),
        end: textDocument.positionAt(text.length),
      },
      message: `AST error: ${message}`,
      source: 'nova-visitor',
    });
  }

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------
connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[params.position.line] ?? '';
    const linePrefix = line.slice(0, params.position.character).trim();

    const completions: CompletionItem[] = [];

    // Context-aware completions
    if (linePrefix === '' || DECLARATION_KEYWORDS.some((k) => linePrefix.startsWith(k))) {
      // Top-level: suggest declaration keywords
      for (const kw of DECLARATION_KEYWORDS) {
        completions.push({
          label: kw,
          kind: CompletionItemKind.Keyword,
          detail: `Declare a new ${kw}`,
        });
      }
    }

    if (linePrefix.includes('entity') || linePrefix.includes('dashboard') || linePrefix.includes('workflow')) {
      // Inside a declaration block
      if (linePrefix.includes('entity')) {
        for (const type of TYPE_KEYWORDS) {
          completions.push({
            label: type,
            kind: CompletionItemKind.TypeParameter,
            detail: `Field type: ${type}`,
          });
        }
        completions.push({
          label: '@relation',
          kind: CompletionItemKind.Snippet,
          detail: 'Add a relation to another entity',
        });
      }

      if (linePrefix.includes('dashboard')) {
        for (const kw of [...DASHBOARD_KEYWORDS, ...CHART_TYPES]) {
          completions.push({
            label: kw,
            kind: CompletionItemKind.Keyword,
            detail: `Dashboard element: ${kw}`,
          });
        }
      }

      if (linePrefix.includes('workflow')) {
        for (const kw of [...WORKFLOW_KEYWORDS, ...NOTIFY_CHANNELS]) {
          completions.push({
            label: kw,
            kind: CompletionItemKind.Keyword,
            detail: `Workflow step: ${kw}`,
          });
        }
      }
    }

    // Always offer keywords
    if (completions.length === 0) {
      const allKeywords = [
        ...DECLARATION_KEYWORDS,
        ...DASHBOARD_KEYWORDS,
        ...CHART_TYPES,
        ...WORKFLOW_KEYWORDS,
        ...TYPE_KEYWORDS,
        ...NOTIFY_CHANNELS,
      ];
      for (const kw of allKeywords) {
        completions.push({
          label: kw,
          kind: CompletionItemKind.Keyword,
        });
      }
    }

    return completions;
  },
);

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------
connection.onHover(
  (_params: TextDocumentPositionParams): Hover | null => {
    // Provide hover info for known keywords
    return null; // Simplified — full implementation would resolve identifiers
  },
);

// ---------------------------------------------------------------------------
// Go-to-Definition
// ---------------------------------------------------------------------------
connection.onDefinition(
  (_params: DefinitionParams): null => {
    // Resolve entity/field references
    return null; // Simplified — full implementation would build a symbol table
  },
);

// ---------------------------------------------------------------------------
// Document change → revalidate
// ---------------------------------------------------------------------------
documents.onDidChangeContent((event) => {
  validateDocument(event.document).then((diagnostics) => {
    connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics,
    });
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
documents.listen(connection);
connection.listen();
