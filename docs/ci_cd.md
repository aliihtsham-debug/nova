# CI/CD Guide

This guide describes the continuous integration and deployment pipeline for **Nova**. The repository uses a monorepo managed by **Turborepo** and the primary build toolchain is **pnpm**.

## Workflow Overview
1. **Pull Request Validation** – On every PR:
   - **Lint** (`pnpm lint`) – ESLint + Prettier across all packages.
   - **Type‑check** (`pnpm typecheck`) – TypeScript project references.
   - **Unit Tests** (`pnpm test`) – Jest tests for parser, AST, and generators.
   - **Build** (`pnpm build`) – Turborepo builds the `packages/*` packages and generates the Next.js app.
2. **Continuous Deployment** – After merging to `main`:
   - GitHub Actions triggers the `deploy.yml` workflow.
   - The workflow runs the same validation steps, then builds the Docker image for the Next.js app.
   - The image is pushed to the configured container registry and deployed to the configured environment (e.g., Azure App Service, Vercel, or custom Kubernetes cluster).

## GitHub Actions
### `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test -- --ci
      - run: pnpm build
```

### `.github/workflows/deploy.yml`
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Build Docker image
        run: |
          docker build -t myregistry.com/nova:latest .
      - name: Push to registry
        run: |
          echo "$REGISTRY_PASSWORD" | docker login myregistry.com -u "$REGISTRY_USER" --password-stdin
          docker push myregistry.com/nova:latest
      - name: Deploy
        run: |
          # Insert deployment script or use Azure/K8s CLI here
          echo "Deploying to production..."
``` 

## Caching
Turborepo caches build artifacts between runs. The CI workflow enables caching via the `actions/cache` step (not shown for brevity) to speed up incremental builds.

## Quality Gates
- All PRs must pass the CI workflow before merge.
- The `main` branch is protected; only PR merges can update it.
- Code coverage must stay above **80%** (enforced by Jest coverage thresholds).

---

> **Note**: Adjust the registry URLs, deployment commands, and environment variables to match your target infrastructure.
