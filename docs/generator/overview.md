# Generator Overview

This document provides an overview of the code‑generation subsystem in **Nova**. Generators take the validated AST and emit artifacts for various target platforms.

## Primary Generators

| Generator | Package | Output |
|-----------|---------|--------|
| **Prisma Generator** | `@nova/generator-prisma` | `schema.prisma` with models, enums, relations |
| **Zod Generator** | `@nova/generator-zod` | `lib/schemas/[Entity]Schema.ts` with validation schemas |
| **Next.js Generator** | `@nova/generator-nextjs` | Full App Router app with pages, routes, components |
| **Auth Generator** | *(extends Prisma + Zod + Next.js)* | NextAuth config, middleware, login/register pages |
| **Billing Generator** | *(extends Prisma + Zod + Next.js)* | Stripe integration, usage metering, pricing pages |

## Generation Pipeline

1. **AST Validation** — The compiler validates the AST before passing it to generators
2. **Generator Invocation** — Each generator receives the `ProgramNode` and `CompilerContext`
3. **File Emission** — Generators return `GeneratedArtifact[]` with path + content
4. **Post-processing** — Prettier runs on generated files; Prisma client is generated
5. **Custom Code Merge** — Existing files with `nova-custom-start/end` blocks are preserved

## Generator Interface

All generators implement the `Generator` interface:

```typescript
interface Generator {
  name: string;
  generate(program: ProgramNode, context: CompilerContext): Promise<GeneratedArtifact[]>;
}
```

## Generation Order

Generators are invoked in dependency order:

1. **Prisma** (schema.prisma — no dependencies on other generators)
2. **Zod** (depends on Prisma for enum names)
3. **Auth** (extends Prisma's User model; extends Zod with auth schemas)
4. **Billing** (extends Prisma with Plan/Subscription models)
5. **Next.js** (depends on all above for complete app generation)

## Extending Generators

To add a new target (e.g., GraphQL, OpenAPI, tRPC):

1. Create a new package under `packages/generator-<name>/`
2. Implement the `Generator` interface
3. Register it in the compiler's generator pipeline
4. Optionally add EJS templates under `templates/<name>/`

Each generator should:
- Respect the AST types from `@nova/compiler`
- Use EJS templates for code emission
- Support custom code preservation
- Produce valid, formatted output

---

> **Tip**: When adding new AST node types (see `docs/parser/ast_extensions.md`), update ALL generators that need to handle the new constructs.
