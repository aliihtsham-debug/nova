# CLI Specification

## Overview

The Nova CLI (`@nova/cli`) is the primary interface for developers. Built with `commander.js` and styled with `chalk`, it provides commands to initialize, generate, develop, test, and deploy Nova applications.

## Installation

```bash
npm install -g @nova/cli
# or use directly from the monorepo
pnpm nova <command>
```

## Global Options

| Flag | Description |
|------|-------------|
| `-V, --version` | Output the version number |
| `-v, --verbose` | Enable verbose logging |
| `-c, --config <path>` | Path to config file (default: `nova.config.ts`) |
| `-h, --help` | Display help for command |

## Commands

### `nova init <project-name>`

Initialize a new Nova project.

| Argument | Required | Description |
|----------|----------|-------------|
| `project-name` | Yes | Name of the project directory |

| Flag | Default | Description |
|------|---------|-------------|
| `--template <type>` | `default` | Template type: `default`, `saas`, `crm`, `ecommerce` |
| `--auth` | `true` | Include authentication |
| `--billing` | `false` | Include Stripe billing |
| `--no-git` | `false` | Skip git initialization |
| `--package-manager <pm>` | `pnpm` | Package manager: `pnpm`, `npm`, `yarn` |

**Exit Codes:**
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Path exists / Permission denied |
| 2 | Template not found |

**Files created:**
```
<project-name>/
├── nova.config.ts
├── app.nova
├── .env.example
├── .gitignore
└── README.md
```

### `nova generate`

Compile `.nova` DSL files into a Next.js application.

| Flag | Default | Description |
|------|---------|-------------|
| `--file <path>` | `app.nova` | Path to the DSL file |
| `--output <dir>` | `./generated-app` | Output directory |
| `--auth` | `true` | Generate auth |
| `--billing` | `false` | Generate billing |
| `--force` | `false` | Overwrite existing output |
| `--no-format` | `false` | Skip prettier formatting |

**Exit Codes:**
| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Syntax parsing failure |
| 3 | Semantic check failure |
| 4 | LLM network timeout |
| 5 | Generator failure |

**Progress output (with `--verbose`):**
```
[1/7] Lexing app.nova...          ✓ 142 tokens
[2/7] Parsing DSL...              ✓ 3 entities, 1 dashboard
[3/7] Semantic analysis...        ✓ No errors
[4/7] Validation...               ✓ No circular relations
[5/7] Generating Prisma schema... ✓ schema.prisma
[6/7] Generating Zod schemas...    ✓ 3 schemas
[7/7] Generating Next.js app...   ✓ 12 files
─────────────────────────────────────
Generated successfully in 2.3s
Output: ./generated-app
```

### `nova dev`

Start the generated application in development mode.

| Flag | Default | Description |
|------|---------|-------------|
| `--port <number>` | `3000` | Port to run on |
| `--dir <path>` | `./generated-app` | Path to generated app |

**Exit Codes:**
| Code | Meaning |
|------|---------|
| 0 | Terminated by SIGINT |
| 1 | Port in use |
| 2 | Generated app not found |

### `nova test`

Run tests for the generated application.

| Flag | Default | Description |
|------|---------|-------------|
| `--coverage` | `false` | Generate coverage report |
| `--watch` | `false` | Watch mode |
| `--e2e` | `false` | Run Playwright e2e tests |

**Exit Codes:**
| Code | Meaning |
|------|---------|
| 0 | All tests pass |
| 5 | Assertion failure |

### `nova deploy`

Deploy the generated application.

| Flag | Default | Description |
|------|---------|-------------|
| `--stage <name>` | `production` | Deployment stage: `staging`, `production` |
| `--provider <name>` | `vercel` | Provider: `vercel`, `railway`, `fly` |
| `--dir <path>` | `./generated-app` | Path to generated app |

**Exit Codes:**
| Code | Meaning |
|------|---------|
| 0 | Build success |
| 6 | Migrations fail |
| 7 | Credentials missing |

## Configuration File

`nova.config.ts` (created by `nova init`):

```typescript
import { defineConfig } from '@nova/cli';

export default defineConfig({
  // DSL source file
  source: 'app.nova',

  // Output directory
  output: './generated-app',

  // Features
  auth: true,
  billing: false,

  // Database
  database: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL,
  },

  // OAuth providers
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },

  // AI
  ai: {
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'owl-alpha',
  },

  // Deployment
  deploy: {
    provider: 'vercel',
  },
});
```

## Error Formatting

Errors are displayed with chalk colors:

```
✖ Error: Duplicate entity 'User'
  at app.nova:12:1
  Did you mean to rename one of them?

⚠ Warning: Entity 'Log' has no fields
  at app.nova:45:1
```

- **Errors** in red with `✖` prefix
- **Warnings** in yellow with `⚠` prefix
- **Success** in green with `✔` prefix
- **Info** in blue with `ℹ` prefix

## Progress Indicators

For long-running operations, display a spinner:

```
◴ Generating Prisma schema...
```

On completion:
```
✔ Generated Prisma schema (schema.prisma)
```
