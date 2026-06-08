# Contributing Guidelines

## Code Style
- **TypeScript**: `strict` mode enabled, no `any`.
- **Prettier**: Run automatically on pre‑commit.
- **ESLint**: Extend `eslint:recommended` and `plugin:@typescript-eslint/recommended`.

## Workflow
1. **Fork** the repository and clone your fork.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Install dependencies and run lint before committing:
   ```bash
   pnpm install
   pnpm run lint
   ```
4. Run the validation script to ensure docs contain no placeholders:
   ```bash
   python validate_docs.py
   ```
5. Submit a PR with a clear description of your change.

## Commit Message Convention
```
<type>(<scope>): <subject>

<body>

<footer>
```
- `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- `scope`: the package or area (e.g., `parser`, `generator-nextjs`)
- `subject`: short summary, ≤ 72 characters.

## Running Tests
```bash
pnpm run test          # Unit tests (Vitest)
pnpm run test:e2e      # End‑to‑end tests (Playwright)
```

---
For more details see the [README](../README.md).
