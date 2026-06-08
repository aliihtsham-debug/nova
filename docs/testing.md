# Testing Guide

This guide outlines the testing strategy for the Nova codebase, covering unit, integration, and end‑to‑end tests.

## Packages Covered

- **packages/parser** — Lexer and parser unit tests
- **packages/compiler** — AST validation and analyzer tests
- **packages/generator-prisma** — Prisma schema emitter tests
- **packages/generator-zod** — Zod schema emitter tests
- **packages/generator-nextjs** — Next.js template output tests
- **packages/cli** — CLI command tests

## Test Framework

- **Vitest** — Used for all TypeScript unit and integration tests (`pnpm test`)
- **Playwright** — Used for e2e UI tests on the generated app (`pnpm test:e2e`)

## Running Tests

```bash
# Run all unit tests (Vitest)
pnpm test

# Run tests for a specific package
pnpm test --filter @nova/parser

# Run with coverage
pnpm test -- --coverage

# Run in watch mode
pnpm test -- --watch

# Run e2e tests (Playwright, requires a running app)
pnpm test:e2e
```

## Vitest Configuration

Each package has a `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

## Coverage Thresholds

Vitest is configured with coverage thresholds at **80%** for branches, functions, lines, and statements. The CI pipeline fails if coverage drops below these values.

## Adding New Tests

1. Place test files beside the source file or in a `__tests__` folder.
2. Use descriptive names, e.g., `lexer.test.ts`, `parser.test.ts`, `analyzer.test.ts`.
3. Mock external dependencies (file system, network) using `vi.mock()`.
4. For integration tests that require the full pipeline, use the `integration` Vitest project configuration.

## Test Patterns

### Parser Tests

```typescript
import { describe, it, expect } from 'vitest';
import { parseDSL } from '@nova/parser';

describe('Parser', () => {
  it('should parse a simple entity', () => {
    const source = `entity User {
  name string
}`;
    const { cst } = parseDSL(source);
    expect(cst.type).toBe('ProgramNode');
    expect(cst.declarations).toHaveLength(1);
    expect(cst.declarations[0].type).toBe('EntityNode');
  });
});
```

### Generator Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('Prisma Generator', () => {
  it('should generate correct model from EntityNode', async () => {
    const program = parseFixture('single-entity.nova');
    const artifacts = await generatePrisma(program);
    const schema = artifacts.find((a) => a.path === 'prisma/schema.prisma');
    expect(schema?.content).toContain('model User');
    expect(schema?.content).toContain('id String @id @default(uuid())');
  });
});
```

## E2E Tests

Playwright tests are generated in the generated app at `e2e/`:

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can sign up', async ({ page }) => {
  await page.goto('/auth/register');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.fill('[name="confirmPassword"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

---

> **Tip**: Keep tests fast and deterministic. Avoid network calls in unit tests. Use fixtures for consistent DSL inputs.
