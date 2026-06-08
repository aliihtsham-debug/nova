# Glossary

A concise reference of key terms used throughout the Nova project.

- **DSL** – Domain‑Specific Language that describes workflows, dashboards, cards, charts, tables, and actions.
- **Token** – The smallest lexical unit recognized by the Nova lexer (e.g., `AndOperator`, `Identifier`).
- **Lexer** – Chevrotain lexer generated from `allTokens` that tokenizes DSL source code.
- **AST** – Abstract Syntax Tree produced by the parser; a hierarchical representation of the DSL.
- **Chevrotain** – The parsing library used for the Nova lexer and parser.
- **Next.js 14** – The framework used for the generated UI and server actions.
- **Turborepo** – Monorepo tool orchestrating builds, linting, and tests across packages.
- **Prisma** – ORM that generates a PostgreSQL schema from Nova models.
- **Zod** – Runtime schema validation library used for generated type definitions.
- **Generator** – The code‑generation suite that emits Prisma models, Zod schemas, Next.js routes, and UI components from the AST.

This glossary will be expanded as new concepts arise.
