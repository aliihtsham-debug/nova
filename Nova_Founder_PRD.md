# Nova Founder-Grade Product Requirements Document (PRD)

---

## 1. Executive Summary
Nova is an AI-native full-stack application compiler that converts high-level business specifications written in a human-readable Domain Specific Language (DSL) into production-ready web applications. Unlike traditional low-code platforms that require proprietary runtimes, Nova compiles directly to clean, standard Next.js, React, TypeScript, Prisma, and Zod codebases. The developer retains 100% code ownership. By combining parser engineering with Large Language Models (LLMs), Nova empowers founders, startups, and product teams to ship full-stack web platforms in minutes rather than months, while maintaining complete extensibility.

---

## 2. Vision
Our vision is to build the foundational compiler for declarative software development in the AI era. In the future, developers will not write manual boilerplate code for authentication, billing, database migrations, or form handling. Instead, they will declare their schema, security policies, and workflows in the Nova DSL, and Nova’s compilation suite will construct, verify, test, and deploy the application. Nova will serve as the core engine that turns developer intent into reliable, scalable, and fully owned web applications.

---

## 3. Mission
To reduce full-stack web application development time by 90% without compromising on code quality, performance, or developers' freedom to customize. We strive to make software creation so efficient that a single engineer or founder can design, iterate on, and scale a multi-tenant SaaS application in days, preserving ecosystem compatibility and avoiding vendor lock-in.

---

## 4. Problem Statement
Modern web development is severely fragmented. Fleshing out a full-stack project requires setting up a database schema, building Prisma models, creating Zod validators, implementing multi-tenant authentication, wrapping API endpoints, writing React frontends, styling forms with Tailwind/shadcn, and managing Docker or Vercel configurations. 

While AI assistants (like ChatGPT or Claude) help write code, they suffer from three critical limits:
1. **Architectural Drift**: They generate code snippets that don't match the folder layout, leading to compilation errors.
2. **Hallucinations**: They write code utilizing non-existent libraries or API contracts.
3. **High Maintenance**: Editing generated code requires continuous prompting, which frequently introduces regressions.

---

## 5. Market Opportunity
Nova addresses the rapid expansion of AI-assisted engineering by targeting:
* **Solo Founders & Bootstrappers**: Who need to validate MVPs in days without hiring a full development team.
* **Dev Agencies & Consultants**: Who want to deliver client portals, CRM engines, and back-office apps at 10x speed.
* **Enterprise Platform Teams**: Tasked with building and maintaining internal tools, audit logs, and dashboard systems.
* **AI-First Teams**: Seeking an structured compilation target for their autonomous software agents.

---

## 6. User Personas
* **Sarah (The Solo Founder)**: A non-technical product builder who knows basic data models. She uses Nova to define her startup idea in 50 lines of DSL, compile it, and host it instantly.
* **Alex (The Tech Agency Lead)**: Needs to deliver multiple back-office tools for retail clients. He writes the DSL schema once, compiles a base system, and then hands the generated Next.js code to junior developers for custom styling and API integrations.
* **Marcus (The Enterprise Security Architect)**: Requires all systems to run on-premise. He uses Nova's Postgres + Docker output to build internal inventory logs that adhere strictly to company security policies.

---

## 7. Product Principles
1. **Developer Ownership First**: Zero vendor lock-in. The output is a standard Next.js application that can be built and deployed anywhere.
2. **Determinism over Hallucination**: Parser rules, type systems, and compiler contracts are strictly typed. We only delegate unstructured tasks (like UI styling variants or complex logic blocks) to LLMs under constrained prompts.
3. **Ecosystem Compatibility**: The compiled project uses standard, popular libraries: Next.js App Router, Prisma ORM, Zod, and Tailwind.
4. **Fast Feedback Loops**: Compilation must complete in under 10 seconds, and changes to the DSL should support hot-reloaded diagnostics.

---

## 8. Functional Requirements
* **DSL Parser**: Parse files ending in `.nova` and compile them into a unified Abstract Syntax Tree (AST).
* **Code Generator**: Generate database schemas (Prisma), schema validators (Zod), backend controllers (Next.js Server Actions), and user interface files (React + Tailwind).
* **CLI Engine**: Command line tool `nova` to initialize, test, build, and deploy projects.
* **Authentication Engine**: Generate secure JWT-based multi-tenant user authentication tables and UI forms.
* **Dashboard compiler**: Generate functional tables, charts, and metrics cards based on entity collections.

---

## 9. DSL Specification
The Nova DSL enables declarative definition of the application schema. It supports:
* **Entity Declaration**: Declares databases tables with fields, types, and primary/foreign key relations.
* **Workflow Definition**: Declares state-machine steps, including input schema validation, background processing, and notification hooks.
* **Dashboard View**: Declares analytics displays with bar, line, and pie charts pointing to model fields.
* **Access Rules**: Declares RBAC policies defining which Roles (e.g., `Admin`, `Member`) can invoke which API commands.

---

## 10. Compiler Pipeline
The compiler operates in seven distinct phases:
1. **Lexer**: Tokenizes the raw text DSL, detecting keywords, brackets, types, and operators.
2. **Parser**: Assembles tokens into an initial AST syntax tree, capturing precise file location metadata.
3. **Semantic Analysis**: Verifies that relations refer to existing models, types match expression constraints, and names are unique.
4. **Validation Pipeline**: Checks for circular relationships and invalid user permission policies.
5. **Generator Pipeline**: Feeds the validated AST into Prisma, Zod, and Next.js generator modules.
6. **Code Assembly**: Emitters format the source files into a target directory structure.
7. **Post-processing**: Runs formatting (`prettier`) and linter tests to verify syntactic correctness.

---

## 11. AI Architecture
Nova utilizes **OpenRouter** as its primary LLM provider, defaulting to the **owl-alpha** model for structured reasoning.
* **Model Router**: A wrapper class intercepts LLM calls, handling retries and rate-limiting.
* **Structured Prompts**: Prompts are stored as strict system roles. When generating complex custom UI components, Nova requests XML-wrapped code blocks and validates them using parser rules.
* **Caching**: Compilation steps compile common layouts. LLM queries are cached by hashing the prompt structure to minimize cost.

---

## 12. Authentication
Nova compiles a complete, production-grade Auth setup:
* **Infrastructure**: Emits database fields and relational tables linking `User`, `Account`, `Session`, and `Organization`.
* **Flows**: Integrates **Auth.js** (formerly Next-Auth) using credentials (email/password) and OAuth providers (Google and GitHub).
* **RBAC Policy Enforcement**: Generates middleware routes that intercept requests to `/api/*` and verify that the user's role satisfies the model's access rules.

---

## 13. Billing
SaaS templates generate standard billing abstractions:
* **Subscriptions**: Relational model containing `Subscription`, `Plan`, and `UsageToken`.
* **Stripe Interface**: Generates webhooks and client endpoints to redirect users to Stripe Checkout and Portal.
* **Metering Engine**: Provides server-side helper modules to track user actions (e.g., "AI runs", "PDF generations") and compare usage against plan thresholds.

---

## 14. Dashboard System
Dashboards declare data-visualization templates:
* **Metric Cards**: Display aggregates like total counts, averages, and percentage growth.
* **Tables**: Interactive tables with search, sort, and pagination linked directly to backend Prisma queries.
* **Charts**: Visual components built using `recharts` styled with Tailwind.

---

## 15. API Layer
API routing is clean, structured, and fully typed:
* **Rest API**: Generates Next.js route handlers under `/app/api/[entity]/route.ts` supporting standard `GET`, `POST`, `PATCH`, and `DELETE` requests.
* **Server Actions**: Generates typed server functions for form submissions, ensuring secure database mutation.
* **Typed SDK**: Emits a client-side library `client.ts` containing typed methods (e.g., `api.user.create()`) wrapping standard fetch calls.

---

## 16. Frontend Layer
The generated user interface uses the modern Next.js ecosystem:
* **Architecture**: Next.js App Router using React Server Components (RSC) for page loads and Client Components for form controls.
* **UI styling**: Tailwind CSS utilities paired with a default theme.
* **Components**: Pre-configured **shadcn/ui** elements (Button, Dialog, Sheet, Calendar, Card, Dropdown, Table) styled to match a responsive, dark-mode-first aesthetic.

---

## 17. Database Layer
Nova supports relational database backends:
* **Target Engine**: PostgreSQL (configured via Docker Compose locally and supabase/neondb in production).
* **Prisma Schema**: Auto-emitted `schema.prisma` with relations, indexes, and cascades.
* **Migration Manager**: The CLI handles database push commands and migrates schemas deterministically.

---

## 18. Testing Strategy
Applications compile with a complete testing configuration:
* **Unit Tests**: Emits `Vitest` unit tests covering the parsing logic, Zod validations, and API helper responses.
* **E2E Tests**: Emits `Playwright` script structures that boot the Next.js site locally, log in a dummy user, fill out form fields, and submit transactions.

---

## 19. Deployment
Target applications are deployment-ready out of the box:
* **Docker Setup**: Emits a multi-stage `Dockerfile` optimized for building Next.js apps.
* **Platform Emitters**: Includes deployment configs for Vercel, Railway, and Fly.io.
* **Config Verification**: Validates the environment variables (e.g., `DATABASE_URL`, `NEXTAUTH_SECRET`) before initiating build pipelines.

---

## 20. Security
Security features comply with modern standards:
* **Input Sanitization**: Auto-generated Zod schemas strip unexpected properties from request payloads.
* **SQL Injection**: Prisma ORM parameters prevent raw SQL query assembly.
* **Secrets Management**: CLI includes checking patterns to block committing `.env` files to git.
* **Rate Limiting**: Emits Upstash or memory-based rate limiting configurations for authentication endpoints.

---

## 21. Analytics
Includes client-side and server-side usage telemetry:
* **Compilation Metrics**: Tracks compiling duration, AST sizes, and failure counts for development feedback.
* **Application Metrics**: Generates standard log format hooks for tools like PostHog or Axiom to record user sign-ins and session durations.

---

## 22. Monetization
Nova adopts a hybrid open-source core and cloud service model:
* **Open Source**: The DSL parser, Next.js generator, Prisma generator, and CLI tool are completely open-source (MIT).
* **Nova Cloud**: A paid SaaS platform providing hosted playgrounds, automated staging deployments, team database hosting, and visual schema editors.
* **Enterprise License**: Self-hosted compiler instances featuring advanced security policies, multi-tenant billing suites, and direct vendor SLAs.

---

## 23. Success Metrics
* **Time-to-App**: A complete full-stack CRUD application must compile in under 10 seconds.
* **First-Build Success**: 99% of generated projects should execute `npm run build` successfully without syntax errors.
* **Developer Retention**: Weekly active developers utilizing the CLI tool.
* **API Cost Efficiency**: Cost per compilation using OpenRouter must remain under $0.05.

---

## 24. Roadmap
* **Phase 1 (MVP)**: Chevrotain parser implementation, Prisma models, Next.js routing, simple CLI.
* **Phase 2 (v1.0)**: Add Next-Auth, multi-tenant database partitioning, and Tailwind dashboard widgets.
* **Phase 3 (v2.0)**: Support custom workflow state machines, background queues, and integration hooks (Stripe, Resend).
* **Phase 4 (v3.0)**: LSP editor autocomplete, visual UI builder, and visual dashboard modelers.

---

## 25. Risks & Mitigations
* **Risk 1: AI Non-Determinism**: LLM changes may generate invalid JSX tags.
  * *Mitigation*: Run generated JSX code blocks through a post-parsing syntax check before outputting files.
* **Risk 2: Evolving Next.js API Standards**: Next.js updates can break compile structure.
  * *Mitigation*: Lock the output dependencies strictly to verified NPM minor versions in generated `package.json` templates.
* **Risk 3: DSL Limitations**: Developers need custom code that cannot be declared in the DSL.
  * *Mitigation*: Support "escape hatch" files where developers can write arbitrary React components, which Nova incorporates without overwriting.

---

## 26. Go-To-Market
* **Open Source Launch**: Publish code to GitHub, launching on Product Hunt, Hacker News, and dev.to.
* **Interactive Playground**: Embed a fully functional sandbox in our website where users write 10 lines of DSL and see a live working preview of their Next.js app in their browser.
* **Tutorial Content**: Publish step-by-step videos showing how to construct popular clones (Trello, Stripe Dashboard) using Nova DSL in under 5 minutes.

---

## 27. Competitive Landscape
* **Ruby on Rails / Laravel**: Excellent boilerplates, but require language context switching (Ruby/PHP) and lack AI-native generation architectures.
* **Wasp**: A DSL compiler for React/Node/Prisma. Nova competes by targeting Next.js App Router (RSC) and introducing advanced visual dashboard generation.
* **Vercel v0**: Produces frontend styling, but lacks database integration, backend controllers, and auth architectures. Nova compiles the complete backend-to-frontend stack.

---

## 28. MVP Milestones
* **Day 30**: Complete Chevrotain parsing and AST validation, ensuring a simple `.nova` file compiles to a relational `schema.prisma`.
* **Day 60**: Finalize API routing and Next.js App Router compilation templates. Enable standard CRUD views for tables and forms.
* **Day 90**: Integrate Next-Auth, local CLI commands (`nova init`, `nova dev`), and execute a successful deployment to Vercel.

---

## 29. Funding Narrative
Software engineering is moving from writing manual lines of code to writing high-level instructions. LLM models are extremely capable at code generation, but fail at orchestrating whole project architectures. By providing a strict compiler compiler (Nova) that handles the AST structure, typings, and database wiring, we create the perfect "operating system" target for LLMs. This turns autonomous code creation from a highly fragile process into a structured compile command.

---

## 30. Product End State
A platform where developers declare their entire application schema, security policies, and integrations in a single workspace. With one command, Nova will parse the project, coordinate AI sub-agents to construct custom user components, run localized testing suites, build migrations, and launch a production-grade full-stack SaaS platform in a single, automated developer workflow.
