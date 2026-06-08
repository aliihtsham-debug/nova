# ADR-0002: Next.js Server Actions for Data Mutations

## Status
Accepted

## Context
When compiling the data mutation pipeline (create, update, delete actions on DSL entities), Nova needs to emit secure API layers that connect the user interface to Prisma ORM.

We evaluated two communication patterns:
1. **REST APIs with Express-style endpoints**: Emitting endpoint route controllers (e.g. `/api/users/create`) and fetching them via client-side libraries.
2. **Next.js Server Actions**: Direct Server Action definitions marked with the `'use server'` directive, which Next.js compiles into standard POST requests automatically.

## Decision
We chose **Next.js Server Actions** as the primary data mutation mechanism:
* **Zero Boilerplate API Code**: Next.js automatically creates the RPC endpoints, eliminating the need to write and maintain manual fetch pipelines and route routing parameters.
* **Security & Type Safety**: Server Actions support complete type checking from backend controllers to frontend forms. Zod schemas can be executed directly inside Server Actions to validate inputs before database execution.
* **Progressive Enhancement**: Server Actions integrate naturally with standard React form states (`useActionState`, `useFormStatus`), allowing forms to operate even before client-side JavaScript finishes hydration.

## Consequences
* REST endpoints under `app/api/[entity]/route.ts` will still be generated for external application integrations, but the internal UI forms will rely on Server Actions.
* Requires the target project to run Next.js 14+ with Server Actions enabled.
