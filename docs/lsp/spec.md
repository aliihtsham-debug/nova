# LSP Specification

## Overview

The Nova Language Server (`@nova/lsp`) provides IDE support for `.nova` DSL files using the VS Code Language Server Protocol. It runs as a separate Node.js process and communicates with the editor via JSON-RPC over stdio.

## Connection

- **Transport**: stdio (default), TCP, or WebSocket
- **Protocol**: LSP 3.17
- **File scheme**: `file://`

## Server Capabilities

### Text Document Sync

| Capability | Value |
|-----------|-------|
| `textDocumentSync` | `Incremental` |

### Language Features

| Feature | Status |
|---------|--------|
| Diagnostics | ✅ Push-based on open/change |
| Completion | ✅ Trigger characters: space, `@` |
| Hover | ✅ |
| Go-to Definition | ✅ |
| Document Symbols | ✅ |
| Rename | ✅ |
| Code Actions | ✅ Quick fixes for common errors |

## Message Contracts

### Initialize Request

```jsonc
// Client → Server
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "processId": 12345,
    "rootUri": "file:///workspace/project",
    "capabilities": {
      "textDocument": {
        "completion": { "completionItem": { "snippetSupport": true } },
        "hover": { "contentFormat": ["markdown", "plaintext"] },
        "definition": { "linkSupport": true }
      }
    }
  }
}

// Server → Client
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "capabilities": {
      "textDocumentSync": 2, // Incremental
      "completionProvider": {
        "triggerCharacters": [" ", "@"],
        "resolveProvider": true
      },
      "hoverProvider": true,
      "definitionProvider": true,
      "documentSymbolProvider": true,
      "renameProvider": { "prepareProvider": true },
      "codeActionProvider": { "codeActionKinds": ["quickfix"] },
      "diagnosticProvider": {
        "interFileDependencies": false,
        "workspaceDiagnostics": false
      }
    },
    "serverInfo": {
      "name": "nova-lsp",
      "version": "0.1.0"
    }
  }
}
```

### Diagnostics: `textDocument/publishDiagnostics`

```jsonc
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
        "severity": 1, // Error
        "code": "DUPLICATE_DECLARATION",
        "source": "nova",
        "message": "Duplicate declaration 'User'. An entity with this name already exists."
      },
      {
        "range": {
          "start": { "line": 15, "character": 8 },
          "end": { "line": 15, "character": 20 }
        },
        "severity": 2, // Warning
        "code": "EMPTY_ENTITY",
        "source": "nova",
        "message": "Entity 'Log' has no fields defined."
      }
    ]
  }
}
```

### Completion: `textDocument/completion`

**Trigger**: Space or `@` character.

**Keyword completions** (context: start of line/block):
```jsonc
// Response to typing nothing on a new line
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "isIncomplete": false,
    "items": [
      {
        "label": "entity",
        "kind": 14, // Keyword
        "detail": "Declare an entity (database model)",
        "insertText": "entity ${1:Name} {\n  ${0}\n}",
        "insertTextFormat": 2 // Snippet
      },
      {
        "label": "dashboard",
        "kind": 14,
        "detail": "Declare a dashboard view",
        "insertText": "dashboard ${1:Name} {\n  ${0}\n}",
        "insertTextFormat": 2
      },
      {
        "label": "workflow",
        "kind": 14,
        "detail": "Declare a workflow",
        "insertText": "workflow ${1:Name} {\n  ${0}\n}",
        "insertTextFormat": 2
      }
    ]
  }
}
```

**Type completions** (context: inside entity, after field name):
```jsonc
// Response to typing field name + space
{
  "jsonrpc": "2.0",
  "id": 43,
  "result": {
    "items": [
      { "label": "string", "kind": 12, "detail": "Primitive: Text string" },
      { "label": "number", "kind": 12, "detail": "Primitive: Integer number" },
      { "label": "boolean", "kind": 12, "detail": "Primitive: true/false" },
      { "label": "date", "kind": 12, "detail": "Primitive: DateTime" },
      { "label": "money", "kind": 12, "detail": "Primitive: Decimal money" },
      { "label": "uuid", "kind": 12, "detail": "Primitive: UUID" },
      // Entity references
      { "label": "User", "kind": 7, "detail": "Reference to entity 'User'" },
      { "label": "Post", "kind": 7, "detail": "Reference to entity 'Post'" }
    ]
  }
}
```

**Annotation completions** (context: after `@`):
```jsonc
{
  "jsonrpc": "2.0",
  "id": 44,
  "result": {
    "items": [
      {
        "label": "@relation",
        "kind": 14,
        "detail": "Define a relation to another entity",
        "insertText": "@relation(${1:EntityName})",
        "insertTextFormat": 2
      }
    ]
  }
}
```

### Hover: `textDocument/hover`

Hover over an entity name shows:
```jsonc
{
  "jsonrpc": "2.0",
  "id": 45,
  "result": {
    "contents": {
      "kind": "markdown",
      "value": "**Entity: User**\n\nRepresents a user in the system.\n\n**Fields:**\n- `id`: uuid\n- `name`: string\n- `email`: string\n- `role`: string"
    }
  }
}
```

Hover over a keyword shows:
```jsonc
{
  "jsonrpc": "2.0",
  "id": 46,
  "result": {
    "contents": {
      "kind": "markdown",
      "value": "**entity** — Declares a database model.\n\n```\nentity Name {\n  fieldName: type\n}\n```"
    }
  }
}
```

### Go-to Definition: `textDocument/definition`

Navigate from a relation reference to the entity declaration:
```jsonc
// Request: hovering over "User" in `user User @relation(User)`
{
  "jsonrpc": "2.0",
  "id": 47,
  "method": "textDocument/definition",
  "params": {
    "textDocument": { "uri": "file:///workspace/project/app.nova" },
    "position": { "line": 5, "character": 10 }
  }
}

// Response:
{
  "jsonrpc": "2.0",
  "id": 47,
  "result": {
    "uri": "file:///workspace/project/app.nova",
    "range": {
      "start": { "line": 0, "character": 7 },
      "end": { "line": 0, "character": 11 }
    }
  }
}
```

### Document Symbols: `textDocument/documentSymbol`

```jsonc
{
  "jsonrpc": "2.0",
  "id": 48,
  "result": [
    {
      "name": "User",
      "kind": 5, // Class
      "range": { "start": { "line": 0 }, "end": { "line": 5 } },
      "selectionRange": { "start": { "line": 0, "character": 7 }, "end": { "line": 0, "character": 11 } },
      "children": [
        { "name": "id", "kind": 8, "range": { "start": { "line": 1 }, "end": { "line": 1 } } },
        { "name": "name", "kind": 8, "range": { "start": { "line": 2 }, "end": { "line": 2 } } }
      ]
    },
    {
      "name": "Overview",
      "kind": 2, // Module (dashboard)
      "range": { "start": { "line": 8 }, "end": { "line": 10 } },
      "selectionRange": { "start": { "line": 8, "character": 10 }, "end": { "line": 8, "character": 18 } }
    }
  ]
}
```

## Diagnostic Codes

| Code | Severity | Description |
|------|----------|-------------|
| `DUPLICATE_DECLARATION` | Error | Two declarations share the same name |
| `DUPLICATE_FIELD` | Error | Two fields in the same entity share a name |
| `UNKNOWN_RELATION_TARGET` | Error | `@relation` references a non-existent entity |
| `UNKNOWN_ENTITY_REF` | Error | Dashboard/workflow references a non-existent entity |
| `CIRCULAR_RELATION` | Error | Entity A → B → ... → A |
| `RELATION_TYPE_MISMATCH` | Error | Field type doesn't match @relation target |
| `EMPTY_ENTITY` | Warning | Entity has no fields |
| `UNKNOWN_FIELD_TYPE` | Warning | Field type is neither primitive nor entity |
| `SELF_REF_NOT_NULLABLE` | Warning | Self-referencing field should be nullable |
| `UNUSED_ENTITY` | Warning | Entity declared but never referenced |

## Diagnostic Production

The server produces diagnostics by:

1. On `textDocument/didOpen`: Parse full document, run analyzer, push diagnostics
2. On `textDocument/didChange`: Parse changed portion (incremental), run analyzer, push diagnostics
3. On `textDocument/didSave`: Re-parse full document, push final diagnostics

### Incremental Parsing

For fast feedback during editing:
1. Re-parse the full document on each change (acceptable for files < 1000 lines)
2. For future optimization: use Chevrotain's `tokenVector` replacement to update only changed tokens
3. Debounce: 300ms delay after last keystroke before parsing

## Code Actions

### Quick Fix: Create missing entity

When `UNKNOWN_RELATION_TARGET` is detected:
```
Code Action: "Create entity 'User'"
Effect: Append `entity User {\n  id uuid\n}\n\n` to the document
```

### Quick Fix: Add @relation annotation

When a field type matches another entity name but has no `@relation`:
```
Code Action: "Add @relation(User)"
Effect: Transform `user User` → `user User @relation(User)`
```

## Implementation Notes

### Performance Targets

| Operation | Target |
|-----------|--------|
| Parse (< 500 lines) | < 50ms |
| Diagnostics update | < 200ms |
| Completion response | < 100ms |
| Hover response | < 100ms |

### Memory

- Cache parsed AST per document
- Invalidate cache on `didChange`
- Release cache on `didClose`
