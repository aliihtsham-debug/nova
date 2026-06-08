# Next.js Generator Specification

## 1. Overview

The **Next.js App Router Generator** (`@nova/generator-nextjs`) is the largest and most complex generator in the Nova compiler pipeline. It consumes a validated `ProgramNode` AST (produced by `@nova/compiler`) and emits a complete, production-ready Next.js 14+ application using the App Router paradigm.

### 1.1 Generator Contract

The generator implements the `Generator` interface from `@nova/compiler`:

```typescript
import type { Generator, ProgramNode, CompilerContext, GeneratedArtifact } from '@nova/compiler';

export const nextJsGenerator: Generator = {
  name: 'nextjs',
  async generate(program: ProgramNode, context: CompilerContext): Promise<GeneratedArtifact[]> {
    // 1. Walk program.declarations
    // 2. For each EntityNode → emit pages, server actions, REST routes, form/table components
    // 3. For each DashboardNode → emit dashboard page with cards, charts, tables
    // 4. Emit root layout, auth pages, middleware, sidebar, config files
    // 5. Return GeneratedArtifact[] with { path, content, type }
  },
};
```

### 1.2 Input AST Types

The generator reads from these AST node types (defined in `@nova/compiler`):

| AST Node | Source DSL | Purpose |
|----------|-----------|---------|
| `ProgramNode` | Root | Container for all declarations |
| `EntityNode` | `entity Name { ... }` | Database model + CRUD UI |
| `FieldNode` | `fieldName type` | Column definition, form field, table column |
| `DashboardNode` | `dashboard Name { ... }` | Dashboard page with visual elements |
| `CardNode` | `card Name from Entity` | Metric card (count/aggregate) |
| `ChartNode` | `chart bar Name from Entity by field` | Chart (bar/line/pie/donut) |
| `TableViewNode` | `table Name from Entity { ... }` | Interactive data table |
| `WorkflowNode` | `workflow Name { ... }` | Background workflow (future) |

### 1.3 Configuration Flags

The generator behavior is controlled by CLI flags passed through `CompilerContext.options`:

| Flag | Default | Effect |
|------|---------|--------|
| `--auth` | `true` | Emit auth pages, middleware, NextAuth config |
| `--billing` | `false` | Emit Stripe billing pages and API routes |
| `--force` | `false` | Overwrite existing files (skip merge) |
| `--no-format` | `false` | Skip Prettier formatting pass |

### 1.4 Template Engine

All output files are produced from **EJS** (Embedded JavaScript) templates located in `templates/nextjs/`. Templates receive a context object containing:

```typescript
interface TemplateContext {
  program: ProgramNode;
  projectName: string;
  entities: EntityNode[];
  dashboards: DashboardNode[];
  auth: boolean;
  billing: boolean;
  oauthProviders: string[];
  nextauthSecret: string;
  entity: EntityNode;       // Per-entity templates
  dashboard: DashboardNode; // Per-dashboard templates
  mode: 'create' | 'edit';  // Form page templates
}
```

---

## 2. Complete Directory Structure

The generator emits the following directory tree into `<targetDirectory>/`:

```
<target>/
├── package.json                          # Dependencies & scripts
├── tsconfig.json                         # TypeScript config (strict mode)
├── next.config.js                        # Next.js configuration
├── tailwind.config.ts                    # Tailwind + shadcn theme tokens
├── postcss.config.js                     # PostCSS with tailwindcss + autoprefixer
├── .env.example                          # Environment variable template
├── middleware.ts                         # Auth middleware (when --auth)
│
├── prisma/
│   └── schema.prisma                     # From @nova/generator-prisma
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (html, body, fonts)
│   │   ├── page.tsx                      # Home page (redirect to dashboard)
│   │   ├── globals.css                   # Tailwind directives + CSS variables
│   │   │
│   │   ├── auth/                         # Auth pages (when --auth)
│   │   │   ├── layout.tsx                # Centered card layout
│   │   │   ├── login/page.tsx            # Login form
│   │   │   └── register/page.tsx         # Registration form
│   │   │
│   │   ├── dashboard/                    # Dashboard pages
│   │   │   └── [name]/page.tsx           # Dynamic dashboard (one per DashboardNode)
│   │   │
│   │   ├── [entity]/                     # Entity CRUD pages (one per EntityNode)
│   │   │   ├── page.tsx                  # List page (table + search + pagination)
│   │   │   ├── new/page.tsx              # Create form page
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # Detail/show page
│   │   │       └── edit/page.tsx         # Edit form page
│   │   │
│   │   ├── billing/                      # Billing pages (when --billing)
│   │   │   ├── page.tsx                  # Pricing plans
│   │   │   ├── success/page.tsx          # Checkout success
│   │   │   └── cancel/page.tsx           # Checkout cancelled
│   │   │
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts   # NextAuth handler
│   │       ├── [entity]/route.ts             # GET list, POST create
│   │       ├── [entity]/[id]/route.ts        # GET one, PATCH, DELETE
│   │       └── stripe/                       # Stripe endpoints (when --billing)
│   │           ├── webhook/route.ts
│   │           ├── checkout/route.ts
│   │           └── portal/route.ts
│   │
│   ├── lib/
│   │   ├── prisma.ts                     # PrismaClient singleton
│   │   ├── auth.ts                       # NextAuth config (when --auth)
│   │   ├── stripe.ts                     # Stripe client (when --billing)
│   │   ├── utils.ts                      # cn() helper (clsx + tailwind-merge)
│   │   ├── actions/
│   │   │   └── [entity].ts               # Server actions per entity (CRUD)
│   │   └── schemas/
│   │       ├── [Entity]Schema.ts         # From @nova/generator-zod
│   │       └── auth.ts                   # LoginSchema, RegisterSchema
│   │
│   └── components/
│       ├── ui/                           # shadcn/ui components
│       │   ├── button.tsx
│       │   ├── input.tsx
│       │   ├── label.tsx
│       │   ├── checkbox.tsx
│       │   ├── select.tsx
│       │   ├── table.tsx
│       │   ├── card.tsx
│       │   ├── dialog.tsx
│       │   └── dropdown-menu.tsx
│       ├── layout/
│       │   ├── sidebar.tsx               # Auto-generated navigation
│       │   ├── header.tsx                # Top bar with user menu
│       │   └── dashboard-shell.tsx       # Sidebar + header wrapper
│       └── [entity]/
│           ├── [entity]-table.tsx        # Reusable data table
│           └── [entity]-form.tsx         # Reusable form component
```

### 2.1 File Count Summary

For a DSL with **E** entities and **D** dashboards, the generator emits:

| Category | File Count |
|----------|-----------|
| Config files | 6 (package.json, tsconfig, next.config, tailwind, postcss, .env.example) |
| Root app files | 3 (layout, page, globals.css) |
| Auth files | 7 (when --auth) |
| Entity pages | 4E (list, new, detail, edit) |
| Entity API routes | 2E (collection, single resource) |
| Server actions | E (one per entity) |
| Dashboard pages | D (one per dashboard) |
| Layout components | 3 (sidebar, header, shell) |
| **Total (typical)** | **6 + 3 + 7 + 6E + D** |

---

## 3. Page Generation Rules

### 3.1 Root Layout (`src/app/layout.tsx`)

**Template:** `templates/nextjs/root-layout.ejs`

The root layout is the outermost wrapper. It:

1. Imports the Inter font from `next/font/google`
2. Imports `globals.css`
3. Wraps all children in `<html lang="en">` and `<body>`
4. Sets metadata (title from `projectName`)

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '<%= projectName %>',
  description: 'Generated by Nova',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Generation rules:**
- Always emitted (every project needs a root layout)
- `projectName` comes from `CompilerContext.options.projectName`
- When `--auth` is enabled, wraps children in `<SessionProvider>`
- When dashboards exist, wraps children in `<DashboardShell>` with sidebar

### 3.2 Home Page (`src/app/page.tsx`)

Redirects to the first dashboard or to `/auth/login`:

```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}
```

### 3.3 Entity List Page (`src/app/[entity]/page.tsx`)

**Template:** `templates/nextjs/entity-list-page.ejs`

A **Server Component** that fetches and displays a paginated, searchable table.

**Data fetching:**
```typescript
const [items, total] = await Promise.all([
  prisma.<entity>.findMany({
    where,                                    // Built from search params
    skip: (page - 1) * limit,
    take: limit,                              // Default: 20
    orderBy: { createdAt: 'desc' },
  }),
  prisma.<entity>.count({ where }),
]);
```

**Search:** Filters across all `string` fields using Prisma's `contains` with `mode: 'insensitive'`.

**Pagination:** Offset-based with Previous/Next buttons. Shows "Showing X–Y of Z".

**Columns:** Renders up to 5 fields per row (configurable). Each column header is the field name capitalized.

**Row actions:** "View" button linking to `/[entity]/[id]`.

**Top bar:** Entity name as heading + "New [Entity]" button linking to `/[entity]/new`.

### 3.4 Entity Create Page (`src/app/[entity]/new/page.tsx`)

**Template:** `templates/nextjs/entity-form-page.ejs` (with `mode: 'create'`)

A **Client Component** (`'use client'`) that renders a form for creating new records.

**Form behavior:**
- Uses `useActionState` (React 19) for server action integration
- Submits to `create<Entity>()` server action
- On success: server action calls `redirect('/[entity]')`
- On validation error: displays Zod field errors inline
- "Cancel" button links back to `/[entity]`

**Field rendering rules** (see Section 3.7 for full mapping):

| DSL Type | HTML Input Type | Required |
|----------|----------------|----------|
| `string` | `type="text"` | `!field.isNullable` |
| `number` | `type="number"` | `!field.isNullable` |
| `boolean` | `<Checkbox>` | Always optional |
| `date` | `type="datetime-local"` | `!field.isNullable` |
| `money` | `type="number"` step="0.01" | `!field.isNullable` |
| `uuid` | Hidden (auto-generated) | Auto |
| Entity ref | `<Select>` | `!field.isNullable` |

**Auto-excluded fields:** `id`, `createdAt`, `updatedAt` are never rendered in forms.

### 3.5 Entity Detail Page (`src/app/[entity]/[id]/page.tsx`)

**Template:** `templates/nextjs/entity-detail-page.ejs`

A **Server Component** that displays a single record in a read-only card layout.

**Data fetching:**
```typescript
const item = await prisma.<entity>.findUnique({
  where: { id: params.id },
});
if (!item) notFound();  // Renders Next.js 404 page
```

**Layout:**
- Back button linking to `/[entity]`
- Edit button linking to `/[entity]/[id]/edit`
- Delete button (form action calling `delete<Entity>()`)
- Definition list (`<dl>`) showing all fields
- Created At / Updated At timestamps

### 3.6 Entity Edit Page (`src/app/[entity]/[id]/edit/page.tsx`)

**Template:** `templates/nextjs/entity-form-page.ejs` (with `mode: 'edit'`)

Same as the create page but:
- Pre-fills form inputs with `initialData` from the fetched record
- Hidden `<input name="id">` for the record ID
- Submits to `update<Entity>()` server action
- On success: redirects to `/[entity]/[id]`

### 3.7 Field Type to Component Mapping

Complete mapping from DSL `FieldNode.fieldType` to shadcn/ui component:

| DSL Type | shadcn Component | HTML Type / Props | Zod Validator |
|----------|-----------------|-------------------|---------------|
| `string` | `<Input>` | `type="text"` | `z.string()` |
| `number` | `<Input>` | `type="number"` | `z.number()` |
| `boolean` | `<Checkbox>` | — | `z.boolean()` |
| `date` | `<Input>` | `type="datetime-local"` | `z.coerce.date()` |
| `money` | `<Input>` | `type="number"` `step="0.01"` | `z.number().positive()` |
| `uuid` | Hidden input | Auto-generated | `z.string().uuid()` |
| Entity ref | `<Select>` | Options from related entity | `z.string().uuid()` |
| Enum | `<Select>` | Options from enum values | `z.enum([...])` |

---

## 4. Server Action Generation

### 4.1 Output Location

`src/lib/actions/[entity].ts` — one file per `EntityNode`.

**Template:** `templates/nextjs/server-action.ejs`

### 4.2 Generated Code Structure

Each server action file exports three functions:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  <Entity>CreateSchema,
  <Entity>UpdateSchema,
} from '@/lib/schemas/<Entity>Schema';

// ─── CREATE ───
export async function create<Entity>(
  _prevState: unknown,
  formData: FormData,
): Promise<{ errors?: Record<string, string[]> } | void> {
  const raw = Object.fromEntries(formData.entries());
  delete (raw as Record<string, string>).id;

  const result = <Entity>CreateSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  await prisma.<entity>.create({ data: result.data });

  revalidatePath('/<entity>');
  redirect('/<entity>');
}

// ─── UPDATE ───
export async function update<Entity>(
  _prevState: unknown,
  formData: FormData,
): Promise<{ errors?: Record<string, string[]> } | void> {
  const raw = Object.fromEntries(formData.entries());
  const id = (raw as Record<string, string>).id;
  delete (raw as Record<string, string>).id;

  const result = <Entity>UpdateSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  await prisma.<entity>.update({ where: { id }, data: result.data });

  revalidatePath('/<entity>');
  revalidatePath(`/entity>/${id}`);
  redirect(`/<entity>/${id}`);
}

// ─── DELETE ───
export async function delete<Entity>(formData: FormData): Promise<void> {
  const id = formData.get('id') as string;
  await prisma.<entity>.delete({ where: { id } });
  revalidatePath('/<entity>');
}
```

### 4.3 Design Decisions

- **`'use server'` directive:** Required for all Server Actions in Next.js App Router
- **`useActionState` pattern:** The `_prevState` parameter enables progressive enhancement — forms work without JavaScript
- **`safeParse` over `parse`:** Returns structured field errors instead of throwing, enabling inline error display
- **`revalidatePath`:** Ensures the list page cache is invalidated after mutations
- **`redirect`:** Server-side redirect after successful mutation (Post-Redirect-Get pattern)
- **Zod schemas imported from `@/lib/schemas/`:** Generated by `@nova/generator-zod`, ensuring form validation matches database constraints

### 4.4 RBAC Enforcement (when --auth)

When authentication is enabled, server actions include session checks:

```typescript
import { auth } from '@/lib/auth';

export async function create<Entity>(_prevState: unknown, formData: FormData) {
  const session = await auth();
  if (!session) {
    throw new Error('Unauthorized');
  }
  // ... rest of action
}
```

For entity-specific ownership checks:

```typescript
// Verify the user owns the resource before update/delete
const existing = await prisma.<entity>.findUnique({ where: { id } });
if (existing && (existing as any).userId !== session.user.id) {
  throw new Error('Forbidden');
}
```

---

## 5. REST API Route Generation

### 5.1 Collection Route (`src/app/api/[entity]/route.ts`)

**Template:** `templates/nextjs/rest-route.ejs`

Handles `GET` (list) and `POST` (create) for the entity collection.

#### GET — List with Pagination, Search, and Sort

```typescript
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'createdAt';
  const sortOrder = searchParams.get('sortOrder') ?? 'desc';

  const where = search
    ? {
        OR: [
          // Dynamically generated for each string/number field
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    prisma.<entity>.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.<entity>.count({ where }),
  ]);

  return NextResponse.json({
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
```

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number (1-indexed) |
| `limit` | number | `20` | Items per page |
| `search` | string | `''` | Full-text search across string fields |
| `sortBy` | string | `'createdAt'` | Field to sort by |
| `sortOrder` | `'asc' \| 'desc'` | `'desc'` | Sort direction |

**Response envelope:**
```json
{
  "data": [...],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

#### POST — Create

```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = <Entity>CreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const item = await prisma.<entity>.create({ data: result.data });
  return NextResponse.json(item, { status: 201 });
}
```

### 5.2 Single Resource Route (`src/app/api/[entity]/[id]/route.ts`)

**Template:** `templates/nextjs/rest-route-id.ejs`

Handles `GET` (read), `PATCH` (update), and `DELETE` for a single record.

#### GET — Read One

```typescript
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await prisma.<entity>.findUnique({ where: { id: params.id } });
  if (!item) {
    return NextResponse.json({ error: '<Entity> not found' }, { status: 404 });
  }
  return NextResponse.json(item);
}
```

#### PATCH — Update

```typescript
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const result = <Entity>UpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const item = await prisma.<entity>.update({
    where: { id: params.id },
    data: result.data,
  });
  return NextResponse.json(item);
}
```

#### DELETE — Remove

```typescript
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.<entity>.delete({ where: { id: params.id } });
  return new Response(null, { status: 204 });
}
```

### 5.3 API Route Summary

| Method | Path | Handler | Status Codes |
|--------|------|---------|-------------|
| `GET` | `/api/[entity]` | List with pagination | 200, 401 |
| `POST` | `/api/[entity]` | Create new record | 201, 400, 401 |
| `GET` | `/api/[entity]/[id]` | Read single record | 200, 401, 404 |
| `PATCH` | `/api/[entity]/[id]` | Update record | 200, 400, 401, 404 |
| `DELETE` | `/api/[entity]/[id]` | Delete record | 204, 401, 404 |

---

## 6. Dashboard Generation

### 6.1 Dashboard Page (`src/app/dashboard/[name]/page.tsx`)

**Template:** `templates/nextjs/dashboard-page.ejs`

For each `DashboardNode` in the AST, a dynamic route segment is generated. The page renders all dashboard elements (cards, charts, table views) in a responsive grid layout.

**URL pattern:** `/dashboard/[name]` where `[name]` is the URL-encoded dashboard name.

**Layout structure:**
```
┌──────────────────────────────────────────────┐
│  Dashboard Title                             │
│  Dashboard overview                          │
├──────────┬──────────┬──────────┤
│  Card 1  │  Card 2  │  Card 3  │  ← Metric cards (3 cols)
├──────────┴──────────┼──────────┤
│  Chart 1           │  Chart 2 │  ← Charts (2 cols)
├────────────────────┴──────────┤
│  Table View                   │  ← Full-width table
└──────────────────────────────┘
```

### 6.2 Card Component (Metric Cards)

For each `CardNode`, the generator emits a card showing a count or aggregate:

```tsx
<Card>
  <CardHeader>
    <CardDescription><%= card.name %></CardDescription>
    <CardTitle className="text-3xl">
      {await prisma.<card.sourceEntity.toLowerCase() %>.count()}
    </CardTitle>
  </CardHeader>
</Card>
```

**Prisma query generation:**

| Card Configuration | Generated Query |
|-------------------|-----------------|
| No `whereClause` | `prisma.entity.count()` |
| With `whereClause` | `prisma.entity.count({ where: buildWhere(card.whereClause) })` |
| With `selectFields` | `prisma.entity.aggregate({ _sum: { field: true } })` |

**`buildWhere` helper:** Translates `ExpressionNode` trees into Prisma `where` clauses:

```typescript
function buildWhere(expr: ExpressionNode): Record<string, unknown> {
  switch (expr.type) {
    case 'BinaryExpression':
      return {
        [expr.left.name]: {
          [mapOperator(expr.operator)]: expr.right.value,
        },
      };
    case 'LogicalExpression':
      return {
        [expr.operator === '&&' ? 'AND' : 'OR']: [
          buildWhere(expr.left),
          buildWhere(expr.right),
        ],
      };
    default:
      return {};
  }
}

function mapOperator(op: string): string {
  const mapping: Record<string, string> = {
    '==': 'equals',
    '!=': 'not',
    '>': 'gt',
    '<': 'lt',
    '>=': 'gte',
    '<=': 'lte',
  };
  return mapping[op] ?? 'equals';
}
```

### 6.3 Chart Component

For each `ChartNode`, the generator emits a chart using the **recharts** library.

**Chart type mapping:**

| DSL `chartType` | Recharts Component | Notes |
|----------------|-------------------|-------|
| `bar` | `<BarChart>` | Vertical bars with X/Y axes |
| `line` | `<LineChart>` | Monotone line with legend |
| `pie` | `<PieChart>` | Standard pie with outer radius 100 |
| `donut` | `<PieChart>` | Pie with `innerRadius={60}` for donut effect |

**Generated chart code (bar example):**
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="#3b82f6" />
  </BarChart>
</ResponsiveContainer>
```

**Generated chart code (donut example):**
```tsx
<ResponsiveContainer width="100%" height={300}>
  <PieChart>
    <Pie
      data={data}
      dataKey="value"
      nameKey="name"
      cx="50%"
      cy="50%"
      innerRadius={60}
      outerRadius={100}
    >
      {data.map((_, index) => (
        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip />
  </PieChart>
</ResponsiveContainer>
```

**Color palette:**
```typescript
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
```

**Data fetching for charts:**
```typescript
// Server-side aggregation for chart data
const rawData = await prisma.<entity>.groupBy({
  by: ['<groupByField>'],
  _count: { id: true },
  where: chart.whereClause ? buildWhere(chart.whereClause) : undefined,
});

const chartData = rawData.map((item) => ({
  name: String(item.<groupByField>),
  value: item._count.id,
}));
```

### 6.4 Table View Component

For each `TableViewNode`, the generator emits an interactive table with:

- **Client-side search filtering:** Real-time filtering as the user types
- **Server-side pagination:** Offset-based with page navigation
- **Sortable columns:** Click column headers to sort ascending/descending
- **Row actions:** View, Edit, Delete buttons per row

**Column generation from `TableColumn`:**
```tsx
{table.columns.map((col) => (
  <TableHead key={col.name}>
    <Button variant="ghost" onClick={() => toggleSort(col.name)}>
      {col.label ?? col.name}
      {sortField === col.name && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
    </Button>
  </TableHead>
))}
```

---

## 7. Auth Page Generation

Auth pages are emitted when `--auth` is `true` (the default).

### 7.1 NextAuth Configuration (`src/lib/auth.ts`)

**Template:** `templates/nextjs/auth-config.ejs`

```typescript
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import type { NextAuthConfig } from 'next-auth';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { LoginSchema } from '@/lib/schemas/auth';

const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
    newUser: '/auth/register',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role } as any;
      },
    }),
    // Conditionally included based on oauthProviders:
    // Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: ... }),
    // GitHub({ clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: ... }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) token.role = (user as any).role;
      if (trigger === 'update' && session) token.name = session.name;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export const { GET, POST } = handlers;
```

### 7.2 Auth API Route (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

### 7.3 Auth Layout (`src/app/auth/layout.tsx`)

Centered card layout for login and register pages:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

### 7.4 Login Page (`src/app/auth/login/page.tsx`)

- Email + Password form using Credentials provider
- OAuth buttons (Google, GitHub) when configured
- Link to register page
- Error display for invalid credentials (using `?error=CredentialsSignin`)
- Loading state during submission via `useFormStatus`

### 7.5 Register Page (`src/app/auth/register/page.tsx`)

- Name, Email, Password, Confirm Password form
- Password strength validation (min 8 chars)
- Password confirmation match check
- On success: auto-login via `signIn('credentials', ...)`

### 7.6 Middleware (`middleware.ts`)

**Template:** `templates/nextjs/auth-middleware.ejs`

```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = ['/', '/auth/login', '/auth/register'];
const authRoutes = ['/auth/login', '/auth/register'];

export default auth((req: NextRequest & { auth: any }) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublicRoute = publicRoutes.some(
    (route) => nextUrl.pathname === route || nextUrl.pathname.startsWith('/api/'),
  );
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  if (!isPublicRoute && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(
      new URL(`/auth/login?callbackUrl=${callbackUrl}`, nextUrl.origin),
    );
  }

  // RBAC: Admin routes
  if (isLoggedIn && nextUrl.pathname.startsWith('/admin/')) {
    const userRole = req.auth?.user?.role ?? 'MEMBER';
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
```

### 7.7 Access Control Matrix

| Route | Public | Authenticated | Admin |
|-------|--------|--------------|-------|
| `/` | Yes | Yes | Yes |
| `/auth/login` | Yes (redirect if logged in) | — | — |
| `/auth/register` | Yes (redirect if logged in) | — | — |
| `/dashboard` | No | Yes | Yes |
| `/[entity]/*` | No | Yes | Yes |
| `/api/[entity]/*` | No | Yes | Yes |
| `/admin/*` | No | No | Yes |

---

## 8. Navigation / Sidebar Auto-Generation

### 8.1 Sidebar Component (`src/components/layout/sidebar.tsx`)

The sidebar is auto-generated from the entity declarations in the AST. It creates a hierarchical navigation menu.

**Generation algorithm:**

```typescript
import type { EntityNode, DashboardNode } from '@nova/compiler';

interface NavItem {
  title: string;
  href: string;
  icon: string;
}

function generateNavItems(entities: EntityNode[], dashboards: DashboardNode[]): NavItem[] {
  const items: NavItem[] = [];

  // Dashboard link (always first)
  if (dashboards.length > 0) {
    items.push({
      title: 'Dashboard',
      href: `/dashboard/${encodeURIComponent(dashboards[0].name)}`,
      icon: 'LayoutDashboard',
    });
  }

  // Entity links (one per entity)
  for (const entity of entities) {
    items.push({
      title: pluralize(entity.name),  // "Product" → "Products"
      href: `/${camelCase(entity.name)}`,
      icon: 'Table',
    });
  }

  return items;
}
```

### 8.2 Naming Conventions

| Entity Name | Route Path | Display Name |
|-------------|-----------|--------------|
| `Product` | `/product` | Products |
| `OrderItem` | `/orderitem` | OrderItems |
| `User` | `/user` | Users |
| `SalesReport` (dashboard) | `/dashboard/SalesReport` | Dashboard |

### 8.3 Icon Mapping

Icons are from `lucide-react`. The default mapping:

| Nav Item | Icon |
|----------|------|
| Dashboard | `LayoutDashboard` |
| Entity list | `Table` |
| Settings | `Settings` |
| Billing | `CreditCard` |

### 8.4 Active State

The sidebar highlights the current page using `usePathname()`:

```tsx
'use client';

import { usePathname } from 'next/link';
import Link from 'next/link';

function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            pathname === item.href
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted',
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
```

---

## 9. Custom Code Preservation

### 9.1 Annotation Syntax

Developers can mark sections of generated files that should be preserved across re-compilation runs using boundary annotations:

```typescript
// <nova-custom-start id="user-profile-widget">
// Any code between these markers is preserved
// across Nova re-generation cycles.
// This can include custom React components,
// additional imports, or business logic.
// <nova-custom-end id="user-profile-widget">
```

**Rules:**
- Each block must have a unique `id` within the file
- `nova-custom-start` and `nova-custom-end` must appear on their own lines
- The `id` attribute must match between start and end markers
- Markers use single-line comment syntax (`//`) for `.ts`/`.tsx` files
- Multiple custom blocks can exist in a single file
- Custom blocks can appear anywhere in the file

### 9.2 Merge Algorithm

The generator uses a three-way merge algorithm to preserve custom code:

```
┌─────────────────────────────────────────────────────────────┐
│                    MERGE ALGORITHM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input:                                                     │
│    1. existingFile (current file on disk)                   │
│    2. freshContent (newly generated from template)          │
│                                                             │
│  Steps:                                                     │
│                                                             │
│  1. PARSE existing custom blocks                            │
│     ┌──────────────────────────────────────────┐            │
│     │ Regex: /\/\/ <nova-custom-start id="(.*?)">/  │      │
│     │         (.*?)                              │          │
│     │         \/\/ <nova-custom-end id="(.*?)">/    │       │
│     └──────────────────────────────────────────┘            │
│     → Map<id, content>                                      │
│                                                             │
│  2. GENERATE fresh content from EJS template                │
│     → string                                                │
│                                                             │
│  3. SCAN fresh content for insertion points                 │
│     → Locations where custom blocks can be re-inserted      │
│                                                             │
│  4. MERGE: For each custom block ID:                        │
│     a. If fresh content has a matching anchor comment,      │
│        insert the custom block at that position             │
│     b. If no anchor exists, append custom block at end      │
│                                                             │
│  5. WRITE merged content to disk                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pseudocode implementation:**

```typescript
interface CustomBlock {
  id: string;
  content: string;  // Lines between start and end markers
}

function parseCustomBlocks(fileContent: string): Map<string, CustomBlock> {
  const blocks = new Map<string, CustomBlock>();
  const regex = /\/\/\s*<nova-custom-start id="([^"]+)">\n([\s\S]*?)\/\/\s*<nova-custom-end id="([^"]+)">/g;

  let match;
  while ((match = regex.exec(fileContent)) !== null) {
    const [, startId, content, endId] = match;
    if (startId === endId) {
      blocks.set(startId, { id: startId, content: content.trim() });
    }
  }

  return blocks;
}

function mergeWithCustomBlocks(
  freshContent: string,
  existingBlocks: Map<string, CustomBlock>,
): string {
  let result = freshContent;

  for (const [id, block] of existingBlocks) {
    // Look for an anchor comment in the fresh content
    const anchorRegex = new RegExp(`//\\s*<!--\\s*custom:${id}\\s*-->.*?\n`);

    if (anchorRegex.test(result)) {
      // Insert at anchor point
      result = result.replace(
        anchorRegex,
        `// <nova-custom-start id="${id}">\n${block.content}\n// <nova-custom-end id="${id}">\n`,
      );
    } else {
      // Append at end of file
      result += `\n// <nova-custom-start id="${id}">\n${block.content}\n// <nova-custom-end id="${id}">\n`;
    }
  }

  return result;
}
```

### 9.3 Merge Scenarios

| Scenario | Behavior |
|----------|----------|
| First generation (no existing file) | Write fresh content directly |
| Re-generation, no custom blocks | Overwrite with fresh content |
| Re-generation, custom blocks exist | Parse blocks, merge into fresh content |
| Custom block ID no longer has anchor | Append block at end of file |
| File has no custom blocks | Standard overwrite |

### 9.4 Supported File Types

Custom code preservation is applied to all `.ts` and `.tsx` files. It is **not** applied to:
- Config files (`package.json`, `tsconfig.json`, `tailwind.config.ts`)
- CSS files (`globals.css`)
- `.env.example` (always overwritten)

---

## 10. Generated Config Files

### 10.1 `package.json`

**Template:** `templates/nextjs/package-json.ejs`

```json
{
  "name": "<%= projectName %>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@prisma/client": "^5.12.0",
    "zod": "^3.22.0",
    "recharts": "^2.12.0",
    "lucide-react": "^0.363.0",
    "next-auth": "^4.24.0",
    "@auth/prisma-adapter": "^1.5.0",
    "bcryptjs": "^2.4.3",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.0",
    "@radix-ui/react-label": "^2.0.0",
    "@radix-ui/react-checkbox": "^1.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "prisma": "^5.12.0",
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.0",
    "tsx": "^4.7.0"
  }
}
```

**Dependency categories:**

| Category | Packages |
|----------|----------|
| Core | `next`, `react`, `react-dom` |
| Database | `@prisma/client`, `prisma` (dev) |
| Validation | `zod` |
| Charts | `recharts` |
| Icons | `lucide-react` |
| Auth | `next-auth`, `@auth/prisma-adapter`, `bcryptjs` |
| UI (shadcn) | `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge` |
| CSS | `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate` |
| TypeScript | `typescript`, `@types/*` |
| Tooling | `eslint`, `eslint-config-next`, `tsx` |

### 10.2 `tsconfig.json`

**Template:** `templates/nextjs/tsconfig.ejs`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Key settings:**
- `strict: true` — Full type safety (matches Nova coding standards)
- `moduleResolution: "bundler"` — Required for Next.js 14+
- `paths: { "@/*": ["./src/*"] }` — Enables `@/lib/...` import aliases
- `jsx: "preserve"` — Next.js handles JSX transformation

### 10.3 `tailwind.config.ts`

**Template:** `templates/nextjs/tailwind.ejs`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

This configuration uses the **shadcn/ui** design token system with CSS variables for theming.

### 10.4 `postcss.config.js`

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 10.5 `.env.example`

**Template:** `templates/nextjs/env-example.ejs`

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/<%= projectName %>"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<%= nextauthSecret %>"

# OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

<%_ if (billingEnabled) { -%>
# Stripe (optional)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
<%_ } -%>
```

### 10.6 `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features as needed
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
```

### 10.7 `src/lib/prisma.ts`

PrismaClient singleton (prevents connection exhaustion in development):

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### 10.8 `src/lib/utils.ts`

Shared utility (required by shadcn/ui):

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 11. End-to-End Generation Example

Given this DSL input:

```nova
entity Product {
  id uuid
  name string
  price money
  isActive boolean
  category string
}

entity Order {
  id uuid
  total money
  status string
  product Product @relation(Product)
}

dashboard SalesOverview {
  card TotalProducts from Product
  card ActiveProducts from Product where isActive == true
  chart bar RevenueByCategory from Product by category
  table OrderSummary from Order {
    column total label "Order Total"
    column status label "Status"
  }
}
```

The generator produces:

```
generated-app/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── middleware.ts
├── prisma/schema.prisma          (from Prisma generator)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── auth/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── dashboard/
│   │   │   └── SalesOverview/page.tsx    ← 2 cards + 1 chart + 1 table
│   │   ├── product/
│   │   │   ├── page.tsx                  ← List with search/pagination
│   │   │   ├── new/page.tsx              ← Create form
│   │   │   └── [id]/
│   │   │       ├── page.tsx              ← Detail view
│   │   │       └── edit/page.tsx         ← Edit form
│   │   ├── order/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── product/route.ts          ← GET list, POST create
│   │       ├── product/[id]/route.ts     ← GET one, PATCH, DELETE
│   │       ├── order/route.ts
│   │       └── order/[id]/route.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   ├── actions/
│   │   │   ├── product.ts                ← createProduct, updateProduct, deleteProduct
│   │   │   └── order.ts                  ← createOrder, updateOrder, deleteOrder
│   │   └── schemas/
│   │       ├── ProductSchema.ts          ← (from Zod generator)
│   │       ├── OrderSchema.ts            ← (from Zod generator)
│   │       └── auth.ts
│   └── components/
│       ├── ui/                           ← shadcn components
│       ├── layout/
│       │   ├── sidebar.tsx               ← Links: Dashboard, Products, Orders
│       │   ├── header.tsx
│       │   └── dashboard-shell.tsx
│       ├── product/
│       │   ├── product-table.tsx
│       │   └── product-form.tsx
│       └── order/
│           ├── order-table.tsx
│           └── order-form.tsx
```

---

## 12. Error Handling and Diagnostics

### 12.1 Generator-Level Errors

The generator reports errors through `CompilerContext.diagnostics`:

```typescript
context.diagnostics.push({
  severity: 'error',
  message: `Template 'entity-list-page.ejs' not found in templates/nextjs/`,
  code: 'GENERATOR_TEMPLATE_MISSING',
});

context.diagnostics.push({
  severity: 'warning',
  message: `Entity 'User' has no string fields; search will be disabled on list page`,
  code: 'GENERATOR_NO_SEARCHABLE_FIELDS',
});
```

### 12.2 Common Diagnostic Codes

| Code | Severity | Description |
|------|----------|-------------|
| `GENERATOR_TEMPLATE_MISSING` | error | EJS template file not found |
| `GENERATOR_WRITE_FAILURE` | error | Cannot write artifact to disk |
| `GENERATOR_NO_SEARCHABLE_FIELDS` | warning | Entity has no string fields for search |
| `GENERATOR_NO_DASHBOARDS` | warning | No DashboardNode found; dashboard page will be empty |
| `GENERATOR_MERGE_CONFLICT` | warning | Custom block ID mismatch during merge |

---

## 13. Performance Considerations

### 13.1 Generation Performance

- All EJS templates are compiled once and cached
- File I/O is batched: all artifacts are collected in memory, then written sequentially
- Prettier formatting (when `--no-format` is not set) runs as a post-processing pass
- Target: full generation completes in under 10 seconds for typical projects (≤20 entities)

### 13.2 Output Optimization

- Server Components by default (no client-side JS for data fetching)
- Client Components only where interactivity is required (forms, search filters)
- `recharts` is tree-shaken: only imported chart types add to bundle size
- PrismaClient uses the singleton pattern to prevent connection leaks

---

## 14. Relationship to Other Generators

The Next.js generator is designed to work alongside other generators in the pipeline:

| Generator | Package | Coordination |
|-----------|---------|-------------|
| Prisma | `@nova/generator-prisma` | Emits `prisma/schema.prisma` first; Next.js generator imports from `@prisma/client` |
| Zod | `@nova/generator-zod` | Emits `src/lib/schemas/*.ts` first; Next.js generator imports schemas for validation |
| Billing | (conditional) | Extends Prisma with Stripe models; Next.js generator emits billing pages |

All generators receive the same `ProgramNode` AST and `CompilerContext`, ensuring consistent output. The CLI orchestrates the pipeline:

```typescript
// packages/cli/src/commands/generate.ts
const result = await compile(dslSource, options, [
  prismaGenerator,    // Phase 1: Database schema
  zodGenerator,      // Phase 2: Validation schemas
  nextJsGenerator,   // Phase 3: Full Next.js application
]);
```

---

## 15. Future Extensions

Planned enhancements for future versions:

| Feature | Description | Version |
|---------|-------------|---------|
| Workflow UI | Generate workflow visualization pages from `WorkflowNode` | v2.0 |
| Real-time | WebSocket/SSE integration for live dashboard updates | v2.0 |
| Mobile | React Native screen generation from the same AST | v4.0 |
| i18n | Multi-language support with next-intl | v2.0 |
| Tests | Auto-generate Playwright E2E tests for CRUD flows | v1.1 |
| Dark mode | Theme toggle with system preference detection | v1.1 |
