<div align="center">

# 🔭 Nova

**An AI-native full-stack application compiler.**

Transform a declarative `.nova` DSL into a production-ready Next.js 14+ application — complete with PostgreSQL, Prisma, Zod validation, authentication, billing, and a full LSP integration.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![Zod](https://img.shields.io/badge/Zod-3-3E67B1?logo=zod)](https://zod.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Overview](#overview) • [Features](#features) • [Quick Start](#quick-start) • [Architecture](#architecture) • [DSL Example](#dsl-example) • [Documentation](#documentation)

</div>

---

## 📖 Overview

Nova is not a framework. It's a **compiler** that transforms your intent into clean, standard code you fully own.

Write a concise `.nova` DSL file that declares your data models, dashboards, and workflows. Nova's compilation engine then produces a complete, production-grade Next.js application — no proprietary runtimes, no vendor lock-in, no black boxes. The output is standard TypeScript, React, Prisma, and Zod code that you can extend, customize, and deploy anywhere.

**Target compile time: under 10 seconds. Target cost: under $0.05 per compilation.**

---

## ✨ Features

### 🏗️ Full-Stack Code Generation
- **Prisma ORM** — Complete `schema.prisma` with models, relations, enums, indexes, and cascades
- **Zod Validation** — Runtime validation schemas for every entity (Create + Update patterns)
- **Next.js App Router** — Full application with pages, API routes, server actions, and middleware

### 🔐 Authentication
- **NextAuth.js (Auth.js) v4** — Credentials + OAuth (Google, GitHub)
- **Multi-tenant RBAC** — Organization, Membership, Session models with ADMIN/MEMBER/VIEWER roles
- **Route protection** — Middleware-based access control with role checking

### 💳 Billing
- **Stripe Integration** — Checkout sessions, customer portal, webhook handling, subscription management
- **Usage Metering** — Track user actions against plan thresholds (e.g., "AI runs", "PDF generations")
- **Plan Management** — Automatic Plan, Subscription, and UsageToken models

### 📊 Dashboard Builder
- **Metric Cards** — Auto-aggregated counts and sums from entity collections
- **Charts** — Bar, line, pie, and donut charts powered by Recharts
- **Interactive Tables** — Search, sort, pagination linked to Prisma queries

### ⚡ Developer Experience
- **CLI Tool** — `nova init`, `nova generate`, `nova dev`, `nova test`, `nova deploy`
- **VS Code LSP** — Diagnostics, completions, go-to-definition, hover docs
- **Custom Code Preservation** — Escape hatch annotations (`nova-custom-start/end`) survive recompilation
- **Hot-reload** — DSL changes propagate to instant diagnostic feedback

### 🤖 AI Integration
- **OpenRouter Gateway** — Single API key access to dozens of LLM models (default: owl-alpha)
- **4 Specialized Agents** — Architecture, Code Generation, Testing, Repair
- **Prompt Caching** — Hash-based caching keeps compilation costs under $0.05

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL (local or hosted)

### Installation

```bash
# Clone the repository
git clone https://github.com/aliihtsham-debug/nova.git
cd nova

# Install dependencies
pnpm install

# Build the compiler
pnpm run build
```

### Create Your First Application

```bash
# Initialize a new Nova project
nova init my-app
cd my-app

# Write your DSL (or use the generated scaffold)
cat app.nova
```

```nova
entity User {
  id    uuid
  name  string
  email string
  role  string
}

entity Post {
  id       uuid
  title    string
  body     string
  author   User @relation(User)
}

dashboard Overview {
  card   TotalUsers   from User
  card   TotalPosts   from Post
  chart  PostsByUser  from Post by author
}
```

```bash
# Compile the DSL into a Next.js app
nova generate --file app.nova --output ./my-app

# Enter the generated app
cd my-app

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL, NEXTAUTH_SECRET, etc.

# Push the database schema
npm run db:push

# Start the dev server
npm run dev
```

Your application is now running at `http://localhost:3000` with full CRUD, authentication, and dashboard views.

---

## 🏛️ Architecture

### Compiler Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  .nova DSL  │───▶│    Lexer    │───▶│    Parser    │───▶│   Visitor   │
│   Source    │    │ (Chevrotain)│    │ (Chevrotain) │    │  (CST→AST)  │
└─────────────┘    └─────────────┘    └──────────────┘    └──────┬──────┘
                                                                  │
                    ┌─────────────────────────────────────────────▼──────┐
                    │                  Typed AST                         │
                    └──────┬───────────────────┬───────────────────────┘
                           │                   │
                    ┌──────▼──────┐    ┌───────▼───────┐
                    │  Semantic   │    │   Validation  │
                    │  Analyzer   │    │   Pipeline    │
                    └──────┬──────┘    └───────┬───────┘
                           │                   │
                    ┌──────▼───────────────────▼───────┐
                    │          Generator Pipeline        │
                    ├──────────┬──────────┬─────────────┤
                    │  Prisma  │   Zod    │   Next.js   │
                    │ Generator│ Generator│  Generator  │
                    └──────────┴──────────┴─────────────┘
```

### Monorepo Structure

```
nova/                          # Root workspace
├── package.json               # Workspace scripts & devDependencies
├── pnpm-workspace.yaml        # pnpm workspace definition
├── turbo.json                 # Turborepo pipeline orchestration
├── tsconfig.json              # Root TypeScript config (strict mode)
│
├── packages/
│   ├── parser/               # Chevrotain lexer + parser + CST→AST visitor
│   │   └── src/
│   │       ├── tokens.ts     # 58 token definitions
│   │       ├── parser.ts     # Full grammar (Chevrotain EmbeddedActionsParser)
│   │       ├── visitor.ts    # CST to typed AST conversion
│   │       └── index.ts      # Public API exports
│   │
│   ├── compiler/             # AST types, analyzer, validator, compile()
│   │   └── src/
│   │       ├── ast.ts        # All TypeScript AST interfaces
│   │       ├── analyzer.ts   # Semantic analysis (4 rules)
│   │       ├── validator.ts  # Circular refs, type checks, RBAC
│   │       └── index.ts      # compile() entry point
│   │
│   ├── generator-prisma/     # Prisma schema (.prisma) emitter
│   ├── generator-zod/        # Zod validation schema emitter
│   ├── generator-nextjs/     # Full Next.js App Router app emitter
│   ├── openrouter/           # LLM client + AI agent orchestration
│   ├── cli/                  # Commander.js CLI (init, generate, dev, test, deploy)
│   └── lsp/                  # VS Code Language Server Protocol implementation
│
├── templates/
│   ├── prisma/               # EJS templates for Prisma schema generation
│   │   ├── model.ejs
│   │   ├── enum.ejs
│   │   └── schema.ejs
│   ├── zod/                  # EJS templates for Zod schema generation
│   │   ├── create-schema.ejs
│   │   └── update-schema.ejs
│   └── nextjs/               # 14 EJS templates for Next.js app generation
│       ├── package-json.ejs
│       ├── tsconfig.ejs
│       ├── tailwind.ejs
│       ├── env-example.ejs
│       ├── root-layout.ejs
│       ├── entity-list-page.ejs
│       ├── entity-detail-page.ejs
│       ├── entity-form-page.ejs
│       ├── server-action.ejs
│       ├── rest-route.ejs
│       ├── rest-route-id.ejs
│       ├── dashboard-page.ejs
│       ├── auth-config.ejs
│       └── auth-middleware.ejs
│
├── docs/
│   ├── generator/            # Generator specifications
│   │   ├── overview.md
│   │   ├── prisma.md
│   │   ├── zod.md
│   │   ├── nextjs.md
│   │   ├── auth.md
│   │   └── billing.md
│   ├── parser/               # Parser documentation
│   │   ├── spec.md
│   │   ├── token_registry.md
│   │   └── ast_extensions.md
│   ├── cli/spec.md           # CLI specification
│   ├── lsp/spec.md           # LSP specification
│   ├── openrouter/spec.md    # AI agent specification
│   ├── deployment.md         # Docker + deployment guide
│   ├── testing.md            # Testing strategy
│   ├── ci_cd.md              # CI/CD pipeline
│   ├── glossary.md           # Key term definitions
│   └── database/role_enum.md # Role enum documentation
│
├── Dockerfile.template       # Multi-stage Dockerfile for generated apps
├── docker-compose.template.yml
│
├── Nova_Founder_PRD.md       # Product Requirements Document
├── Nova_Technical_Architecture_Document.md  # Technical Architecture
├── Nova_Implementation_Blueprint_v1.md     # Implementation Blueprint
├── adr/                      # Architecture Decision Records
│   ├── 0001-parser-chevrotain.md
│   ├── 0002-nextjs-server-actions.md
│   └── 0003-openrouter-owl-alpha.md
│
└── CONTRIBUTING.md           # Contribution guidelines
```

---

## 📝 DSL Example

### Entities & Relations

```nova
entity Organization {
  id   uuid
  name string
  slug string
}

entity User {
  id    uuid
  name  string
  email string
  role  string
}

entity Post {
  id       uuid
  title    string
  body     string
  published boolean
  author   User @relation(User)
}
```

### Dashboard with Cards, Charts & Tables

```nova
dashboard AdminPanel {
  card   TotalUsers       from User
  card   TotalPosts       from Post
  card   PublishedPosts   from Post where published == true

  chart  PostsByUser      from Post by author
  chart  UserGrowth       from User by role

  table  RecentPosts      from Post {
    column title     label "Post Title"
    column published label "Published"
  }
}
```

### Workflows

```nova
workflow Onboarding {
  action SendWelcomeEmail {
    run "sendWelcomeEmail"
    input userEmail userName
    output emailSent
  }

  if emailSent == true
    then action GrantTrialAccess {
      run "grantTrial"
      input userId
    }
    else action NotifyAdmin {
      run "notifyAdmin"
      input userId
    }

  notify WelcomeComplete
    to userEmail
    via email
    message "Welcome to the platform!"
}
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PRD](Nova_Founder_PRD.md) | Full product requirements (30 sections) |
| [Technical Architecture](Nova_Technical_Architecture_Document.md) | System design, package matrix, database DDL |
| [Implementation Blueprint](Nova_Implementation_Blueprint_v1.md) | Code samples, interfaces, test fixtures |
| [Parser Spec](docs/parser/spec.md) | Lexer tokens, grammar, error recovery |
| [Prisma Generator](docs/generator/prisma.md) | Type mapping, model/enum generation |
| [Zod Generator](docs/generator/zod.md) | Validation schema patterns |
| [Next.js Generator](docs/generator/nextjs.md) | Pages, routes, server actions, components |
| [Auth Generator](docs/generator/auth.md) | NextAuth config, RBAC, middleware |
| [Billing Generator](docs/generator/billing.md) | Stripe integration, usage metering |
| [LSP Spec](docs/lsp/spec.md) | Diagnostics, completions, go-to-definition |
| [OpenRouter Spec](docs/openrouter/spec.md) | AI agents, caching, retry, rate-limiting |
| [CLI Spec](docs/cli/spec.md) | Commands, flags, exit codes, error formatting |
| [Deployment](docs/deployment.md) | Docker, Docker Compose, Vercel, Railway, Fly.io |
| [Testing](docs/testing.md) | Vitest, Playwright, coverage thresholds |
| [CI/CD](docs/ci_cd.md) | GitHub Actions pipeline |
| [ADR-0001](adr/0001-parser-chevrotain.md) | Why Chevrotain for parsing |
| [ADR-0002](adr/0002-nextjs-server-actions.md) | Why Server Actions for mutations |
| [ADR-0003](adr/0003-openrouter-owl-alpha.md) | Why OpenRouter + owl-alpha |

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript 5.4 (strict mode) |
| **Parser** | Chevrotain (LL(k)) |
| **Template Engine** | EJS |
| **Output Frontend** | Next.js 14+ (App Router, RSC) |
| **Output ORM** | Prisma 5 |
| **Output Validation** | Zod 3 |
| **Output Auth** | Auth.js (NextAuth) v4 |
| **Output Billing** | Stripe |
| **Output UI** | Tailwind CSS + shadcn/ui |
| **Output Charts** | Recharts |
| **Monorepo** | pnpm + Turborepo |
| **CLI** | Commander.js + Chalk |
| **LSP** | vscode-languageserver |
| **AI** | OpenRouter API gateway |
| **Testing** | Vitest (unit) + Playwright (e2e) |
| **CI/CD** | GitHub Actions |
| **Deployment** | Docker, Vercel, Railway, Fly.io |

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Total files | 82 |
| Documentation files | 25 (.md) |
| EJS templates | 19 |
| TypeScript source files | 11 |
| Package configs | 16 (package.json + tsconfig.json) |
| ADRs | 3 |
| Generator specs | 7 |
| Supported DB providers | PostgreSQL, MySQL, SQLite, SQL Server |
| OAuth providers | Google, GitHub |
| AI agents | 4 (Architecture, Code Gen, Testing, Repair) |

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for code style, workflow, and commit conventions.

```bash
# Fork and clone
git clone https://github.com/aliihtsham-debug/nova.git
cd nova

# Install and build
pnpm install
pnpm run build

# Run tests
pnpm test

# Lint
pnpm run lint
```

---

## 🗺️ Roadmap

| Phase | Milestone | Status |
|-------|-----------|--------|
| **v0.1** | Chevrotain parser + AST validation | ✅ Complete |
| **v0.2** | Prisma + Zod generators | ✅ Complete |
| **v0.3** | Next.js App Router generator | ✅ Complete |
| **v0.4** | CLI (init, generate, dev) | ✅ Complete |
| **v0.5** | Auth generation (NextAuth + RBAC) | ✅ Complete |
| **v0.6** | Billing generation (Stripe) | ✅ Complete |
| **v0.7** | LSP server (diagnostics, completions) | 📋 Spec complete |
| **v0.8** | OpenRouter AI agents | 📋 Spec complete |
| **v1.0** | End-to-end integration + testing | 🔜 Next |
| **v2.0** | Custom workflows, background queues | 📋 Planned |
| **v3.0** | Visual schema editor, playground | 📋 Planned |

---

## 📄 License

[MIT](https://opensource.org/licenses/MIT) — You own 100% of the generated code. No vendor lock-in, ever.

---

<div align="center">

**Built with ❤️ by the Nova team.**

If Nova saves you time, give it a ⭐ on [GitHub](https://github.com/aliihtsham-debug/nova).

</div>
