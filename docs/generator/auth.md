# Auth Generation Specification

## Overview

The auth generator produces a complete, production-grade authentication system using **NextAuth.js v4** (Auth.js). It is conditionally included when the CLI flag `--auth` is set or when the project config has `auth: true`.

## Generated Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth configuration with providers |
| `src/middleware.ts` | Route protection middleware |
| `src/app/auth/layout.tsx` | Auth pages layout (centered card) |
| `src/app/auth/login/page.tsx` | Login form page |
| `src/app/auth/register/page.tsx` | Registration form page |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth API route handler |
| `src/lib/schemas/auth.ts` | Zod schemas for login/register |

## Database Schema (via Prisma Generator)

The auth generator extends the Prisma generator's output by adding or extending:

### User Model (Extended)

The base `User` entity from the DSL is extended with auth fields:

```prisma
model User {
  id            String    @id @default(uuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String    // Only when credentials provider is used
  role          Role      @default(MEMBER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  memberships   Membership[]  // When multi-tenant
}
```

### Account Model (OAuth)

```prisma
model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

### Session Model

```prisma
model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Verification Token Model

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

## Multi-Tenant Models (Optional)

When `multiTenant: true` in config:

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   Membership[]
}

model Membership {
  id   String @id @default(uuid())
  role Role   @default(MEMBER)

  userId String
  orgId  String

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
}
```

## Role Enum

The role enum is **always** generated when auth is enabled:

```prisma
enum Role {
  ADMIN
  MEMBER
  VIEWER
}
```

Role hierarchy:
| Role | Permissions |
|------|-------------|
| `ADMIN` | Full access, user management, organization settings |
| `MEMBER` | Standard access, create/read/update/delete own resources |
| `VIEWER` | Read-only access |

## NextAuth Configuration

### Providers

| Provider | Required Env Vars |
|----------|------------------|
| Credentials | None (uses password hash) |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |

### Session Strategy

Uses **JWT** strategy:
- JWT token contains: `id`, `email`, `name`, `role`
- Session callback propagates role to client
- No server-side session storage needed

### Callbacks

```typescript
callbacks: {
  jwt: async ({ token, user }) => {
    if (user) token.role = user.role;
    return token;
  },
  session: async ({ session, token }) => {
    session.user.role = token.role;
    session.user.id = token.sub;
    return session;
  },
}
```

## Auth Pages

### Login Page

```
src/app/auth/login/page.tsx
```

- Email + Password form (Credentials provider)
- OAuth buttons (Google, GitHub) when configured
- Links to register page
- Error display for invalid credentials
- Loading state during submission

### Register Page

```
src/app/auth/register/page.tsx
```

- Name, Email, Password, Confirm Password form
- Password strength validation (min 8 chars, uppercase, lowercase, number)
- Password confirmation match check
- Auto-login after successful registration

## Middleware

### Route Protection

```typescript
// middleware.ts
export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public/).*)',
};
```

### Access Rules

| Route | Access |
|-------|--------|
| `/auth/login` | Public (redirect if logged in) |
| `/auth/register` | Public (redirect if logged in) |
| `/dashboard` | Authenticated |
| `/admin/*` | ADMIN role only |
| `/api/*` | Varies (auth routes public, others protected) |

## RBAC Enforcement

### Middleware-level (coarse)

- Check if user is authenticated
- Check if user has required role for `/admin/*` routes

### Server Action-level (fine-grained)

```typescript
'use server';

import { auth } from '@/lib/auth';

export async function adminAction() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }
  // ... admin-only logic
}
```

### API Route-level

```typescript
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... protected logic
}
```

## Password Hashing

- Uses **bcryptjs** with 12 salt rounds
- Passwords are hashed during registration
- Passwords are verified during login via `bcrypt.compare()`
- Password field is **never** returned in API responses

## Seed Data

When auth is enabled, the generator includes a seed script:

```typescript
// prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash,
      role: Role.ADMIN,
    },
  });
}

main();
```
