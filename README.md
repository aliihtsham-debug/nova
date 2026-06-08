# Nova

## Overview
Nova is an AI‑native compiler that transforms a declarative `.nova` DSL into a production‑ready Next.js 14+ application with PostgreSQL, Prisma, Zod validation, and a full LSP integration.

## Quick‑Start
```bash
# Clone the repository
git clone <repo‑url>
cd nova

# Install dependencies (pnpm workspace)
pnpm install

# Build the monorepo
pnpm run build

# Generate a sample project from a DSL file
pnpm run generate --file examples/app.nova

# Run the generated app
cd generated-app
npm install
npm run dev
```

The generated project follows the layout described in the Technical Architecture Document and can be deployed with `npm run build`.

## Features
- Declarative DSL for entities, dashboards, and workflows.
- Chevrotain parser with full logical expression support.
- Prisma & Zod generators.
- Next.js App Router generator with shadcn UI components.
- OpenRouter‑based AI code generation and repair agents.
- VS Code LSP server for diagnostics, completions, and hover.

---

[See the full specification](file:///e:/NOVA/Nova_Implementation_Blueprint_v1.md)
