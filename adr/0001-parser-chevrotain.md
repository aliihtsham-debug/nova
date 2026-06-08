# ADR-0001: Selection of Chevrotain for Parser Implementation

## Status
Accepted

## Context
Nova requires a high-performance, maintainable parser and lexer to compile DSL scripts (`.nova`) into an Abstract Syntax Tree (AST). The parser needs to support:
1. **Clear Error Reporting**: Inform developers of precise syntax errors (line, column, expected tokens) to enable rapid feedback.
2. **Incremental Parsing Support**: Allow the language server (LSP) to parse changes incrementally during keystrokes without blocking the editor process.
3. **Type-Safety & Performance**: Scale efficiently in Node.js environments and compile in under a second.

We evaluated three parsing solutions:
1. **ANTLR (via JavaScript target)**: Extremely powerful, standard parser generator, but runtime dependencies are heavy and compiler speeds in JS/TS are slow compared to native tools.
2. **Peg.js / Peggy**: Simple to define grammar, but debugging compiled parsers is complex, error recovery is limited, and building custom AST node properties requires complex embedded hooks.
3. **Chevrotain**: A pure JS/TS library using direct LL(k) parser design. It runs in JS natively, does not require a compilation step to generate the parser code (uses raw code definitions), and provides built-in error recovery and token lookaheads.

## Decision
We chose **Chevrotain** for the following reasons:
* **Performance**: Chevrotain is orders of magnitude faster than Peg.js and ANTLR in JS runtime benchmarks.
* **No Pre-compilation Build Step**: The parser is defined dynamically in raw TypeScript code rather than a `.g4` or `.pegjs` DSL file, meaning standard TypeScript type checking, refactoring tools, and source maps work directly.
* **Error Recovery**: Chevrotain supports automatic token re-synchronization and rule recovery (automatic insertions/deletions), which is critical for compiling partially written DSL files in editor LSPs.

## Consequences
* Developer workflows are simplified because the parser can be debugged using standard Node.js debugging tools without needing generated intermediate source files.
* Developers must write grammar rules directly using Chevrotain's DSL functions (e.g., `this.RULE`, `this.SUBRULE`, `this.MANY`), which carries a learning curve compared to standard EBNF format files.
