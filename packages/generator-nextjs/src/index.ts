// ---------------------------------------------------------------------------
// @nova/generator-nextjs — Next.js App Router Generator
// ---------------------------------------------------------------------------
// Emits a complete Next.js 14+ application from the Nova AST.
// Uses EJS templates for file generation.

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ProgramNode,
  EntityNode,
  CompilerContext,
  GeneratedArtifact,
  Generator,
} from '@nova/compiler';

__dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../../../templates/nextjs');

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------
async function loadTemplate(name: string): Promise<string> {
  return readFile(resolve(TEMPLATES_DIR, name), 'utf-8');
}

// ---------------------------------------------------------------------------
// Simple template renderer (inline EJS-like substitution)
// ---------------------------------------------------------------------------
function render(template: string, data: Record<string, unknown>): string {
  return template.replace(/<%[=-]?\s*(\w+)\s*-?%>/g, (_match, key) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.join('\n');
    return String(value);
  });
}

// ---------------------------------------------------------------------------
// Entity page generation helpers
// ---------------------------------------------------------------------------
function generateEntityListPage(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();
  const pluralName = lowerName + 's';

  return `import { prisma } from '@/lib/prisma';
import { ${name}Table } from './${name}Table';
import Link from 'next/link';

export default async function ${name}ListPage() {
  const ${pluralName} = await prisma.${lowerName}.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">${name}s</h1>
        <Link
          href="/${pluralName}/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New ${name}
        </Link>
      </div>
      <${name}Table data={${pluralName}} />
    </div>
  );
}
`;
}

function generateEntityDetailPage(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();

  const fieldRows = entity.fields
    .filter((f) => f.name !== 'id')
    .map((f) => {
      const isRelation = !!f.relationTarget;
      const displayExpr = isRelation
        ? `{${lowerName}.${f.name}?.id ?? ${lowerName}.${f.name}Id ?? 'N/A'}`
        : `{${lowerName}.${f.name}}`;
      return `        <div className="py-2">
          <dt className="font-medium text-gray-500">${f.name}</dt>
          <dd>${displayExpr}</dd>
        </div>`;
    })
    .join('\n');

  return `import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: { id: string };
}

export default async function ${name}DetailPage({ params }: Props) {
  const ${lowerName} = await prisma.${lowerName}.findUnique({
    where: { id: params.id },
  });

  if (!${lowerName}) notFound();

  return (
    <div className="container mx-auto py-8 px-4">
      <Link href="/${lowerName}s" className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to ${name}s
      </Link>
      <h1 className="text-2xl font-bold mb-6">${name} Details</h1>
      <dl className="grid grid-cols-1 gap-2">
${fieldRows}
      </dl>
    </div>
  );
}
`;
}

function generateEntityFormFields(entity: EntityNode): string {
  return entity.fields
    .filter((f) => f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt')
    .map((f) => {
      if (f.fieldType === 'boolean') {
        return `        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="${f.name}" className="rounded" />
            <span>${f.name}</span>
          </label>
        </div>`;
      }
      if (f.fieldType === 'string' && (f.name === 'body' || f.name === 'description' || f.name === 'text')) {
        return `        <div>
          <label className="block text-sm font-medium mb-1">${f.name}</label>
          <textarea name="${f.name}" rows={4} className="w-full border rounded px-3 py-2" />
        </div>`;
      }
      if (f.fieldType === 'number' || f.fieldType === 'money') {
        return `        <div>
          <label className="block text-sm font-medium mb-1">${f.name}</label>
          <input type="number" name="${f.name}" className="w-full border rounded px-3 py-2" />
        </div>`;
      }
      if (f.fieldType === 'date') {
        return `        <div>
          <label className="block text-sm font-medium mb-1">${f.name}</label>
          <input type="datetime-local" name="${f.name}" className="w-full border rounded px-3 py-2" />
        </div>`;
      }
      return `        <div>
          <label className="block text-sm font-medium mb-1">${f.name}</label>
          <input type="text" name="${f.name}" className="w-full border rounded px-3 py-2" />
        </div>`;
    })
    .join('\n');
}

function generateEntityFormPage(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();
  const formFields = generateEntityFormFields(entity);

  return `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function New${name}Page() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    const res = await fetch('/api/${lowerName}s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push('/${lowerName}s');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to create ${lowerName}. Please try again.');
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New ${name}</h1>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
${formFields}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create ${name}
        </button>
      </form>
    </div>
  );
}
`;
}

function generateEntityEditPage(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();
  const pluralName = lowerName + 's';
  const formFields = generateEntityFormFields(entity);

  return `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: { id: string };
}

export default function Edit${name}Page({ params }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const res = await fetch(\`/api/${pluralName}/\${params.id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData)),
    });

    if (res.ok) {
      router.push('/${pluralName}');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to update. Please try again.');
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg">
      <Link href="/${pluralName}" className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to ${pluralName}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Edit ${name}</h1>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
${formFields}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Save Changes
        </button>
      </form>
    </div>
  );
}
`;
}

function generateEntityTable(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();
  const pluralName = lowerName + 's';
  const displayFields = entity.fields.filter(
    (f) => f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt',
  );

  const headerCells = displayFields
    .map((f) => `            <th className="text-left px-4 py-2">${f.name}</th>`)
    .join('\n');

  const rowCells = displayFields
    .map((f) => {
      const isRelation = !!f.relationTarget;
      return isRelation
        ? `              <td className="px-4 py-2">{item.${f.name}?.id?.slice(0, 8) ?? 'N/A'}</td>`
        : `              <td className="px-4 py-2">{item.${f.name}}</td>`;
    })
    .join('\n');

  return `'use client';

import Link from 'next/link';

interface Props {
  data: Record<string, unknown>[];
}

export function ${name}Table({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-gray-500">No ${pluralName} found.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-2">ID</th>
${headerCells}
            <th className="text-left px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={String(item.id)} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-mono text-xs">{String(item.id).slice(0, 8)}</td>
${rowCells}
              <td className="px-4 py-2">
                <Link href={\`/${pluralName}/\${item.id}\`} className="text-blue-600 hover:underline mr-2">
                  View
                </Link>
                <Link href={\`/${pluralName}/\${item.id}/edit\`} className="text-blue-600 hover:underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;
}

function generateServerAction(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();

  const boolFields = entity.fields.filter((f) => f.fieldType === 'boolean').map((f) => f.name);
  const dateFields = entity.fields.filter((f) => f.fieldType === 'date').map((f) => f.name);
  const numFields = entity.fields.filter((f) => f.fieldType === 'number').map((f) => f.name);

  const transformLines: string[] = [];
  for (const f of boolFields) {
    transformLines.push(`  if (data.${f} !== undefined) data.${f} = data.${f} === 'on' || data.${f} === 'true';`);
  }
  for (const f of dateFields) {
    transformLines.push(`  if (data.${f} && typeof data.${f} === 'string') data.${f} = new Date(data.${f});`);
  }
  for (const f of numFields) {
    transformLines.push(`  if (data.${f} !== undefined && typeof data.${f} === 'string') data.${f} = Number(data.${f});`);
  }

  const transformBlock = transformLines.length > 0
    ? `\n${transformLines.join('\n')}\n`
    : '';

  return `'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { create${name}Schema, update${name}Schema } from '@/lib/validations/${lowerName}';

export async function create${name}(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const data: Record<string, unknown> = {};
  formData.forEach((value, key) => { data[key] = value; });
${transformBlock}
  const parsed = create${name}Schema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Validation failed');

  await prisma.${lowerName}.create({ data: parsed.data });
  revalidatePath('/${lowerName}s');
  redirect('/${lowerName}s');
}

export async function update${name}(id: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const data: Record<string, unknown> = {};
  formData.forEach((value, key) => { data[key] = value; });
${transformBlock}
  const parsed = update${name}Schema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Validation failed');

  await prisma.${lowerName}.update({ where: { id }, data: parsed.data });
  revalidatePath('/${lowerName}s');
  redirect('/${lowerName}s');
}

export async function delete${name}(id: string) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  await prisma.${lowerName}.delete({ where: { id } });
  revalidatePath('/${lowerName}s');
}
`;
}

function generateRestRoute(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();

  return `import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { create${name}Schema } from '@/lib/validations/${lowerName}';

export async function GET() {
  const items = await prisma.${lowerName}.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = create${name}Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const item = await prisma.${lowerName}.create({ data: parsed.data });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create ${lowerName}', details: String(err) },
      { status: 500 },
    );
  }
}
`;
}

function generateRestRouteById(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();

  return `import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { update${name}Schema } from '@/lib/validations/${lowerName}';

interface Props {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Props) {
  const item = await prisma.${lowerName}.findUnique({
    where: { id: params.id },
  });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(request: Request, { params }: Props) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = update${name}Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const item = await prisma.${lowerName}.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json(item);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('P2025') || msg.includes('not found')) {
      return NextResponse.json({ error: '${name} not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update ${lowerName}', details: msg },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Props) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.${lowerName}.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = String(err);
    if (msg.includes('P2025') || msg.includes('not found')) {
      return NextResponse.json({ error: '${name} not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete ${lowerName}', details: msg },
      { status: 500 },
    );
  }
}
`;
}

// ---------------------------------------------------------------------------
// Dashboard page generation
// ---------------------------------------------------------------------------
import type { DashboardNode } from '@nova/compiler';

function generateDashboardPage(dashboards: DashboardNode[]): string {
  const dash = dashboards[0];
  if (!dash) return '// No dashboard defined';
  const cards = dash.elements.filter((e) => e.type === 'Card');
  const charts = dash.elements.filter((e) => e.type === 'Chart');
  const tables = dash.elements.filter((e) => e.type === 'TableView');

  const hasCharts = charts.length > 0;

  const imports = hasCharts
    ? `import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';`
    : `import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';`;

  const colorsConst = hasCharts
    ? `
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
`
    : '';

  const cardQueries = cards.map((card) => {
    const lower = card.sourceEntity.toLowerCase();
    return `  const ${card.name}Count = await prisma.${lower}.count();`;
  }).join('\n');

  const cardElements = cards.map((card) => `        <Card>
          <CardHeader>
            <CardDescription>${card.name}</CardDescription>
            <CardTitle className="text-3xl">{${card.name}Count}</CardTitle>
          </CardHeader>
        </Card>`).join('\n');

  const chartQueries = charts.map((chart) => {
    const lower = chart.sourceEntity.toLowerCase();
    return `  const ${chart.name}Data = await prisma.${lower}.groupBy({
    by: ['${chart.groupByField}'],
    _count: { _all: true },
  });`;
  }).join('\n');

  const chartElements = charts.map((chart) => {
    const chartVar = `${chart.name}Data`;
    let chartComponent: string;
    if (chart.chartType === 'bar') {
      chartComponent = `              <BarChart data={${chartVar}}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>`;
    } else if (chart.chartType === 'line') {
      chartComponent = `              <LineChart data={${chartVar}}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" />
              </LineChart>`;
    } else {
      chartComponent = `              <PieChart>
                <Pie data={${chartVar}} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                  {${chartVar}.map((_: unknown, index: number) => (
                    <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>`;
    }
    return `        <Card>
          <CardHeader>
            <CardTitle>${chart.name}</CardTitle>
            <CardDescription>${chart.chartType} chart from ${chart.sourceEntity} by ${chart.groupByField}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
${chartComponent}
            </ResponsiveContainer>
          </CardContent>
        </Card>`;
  }).join('\n');

  const tableQueries = tables.map((table) => {
    const lower = table.sourceEntity.toLowerCase();
    return `  const ${table.name}Items = await prisma.${lower}.findMany({ take: 50, orderBy: { createdAt: 'desc' } });`;
  }).join('\n');

  const tableElements = tables.map((table) => {
    const columns = table.columns?.length ? table.columns : [{ name: 'id' }];
    const headerCells = columns.map((c) => `<th>${c.label ?? c.name}</th>`).join('');
    const rowCells = columns.map((c) => `<td>{item.${c.name}}</td>`).join('');
    return `        <Card>
          <CardHeader>
            <CardTitle>${table.name}</CardTitle>
            <CardDescription>Table view from ${table.sourceEntity}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr>${headerCells}</tr>
              </thead>
              <tbody>
                {${table.name}Items.map((item: Record<string, unknown>) => (
                  <tr key={String(item.id)}>${rowCells}</tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>`;
  }).join('\n');

  const allQueries = [cardQueries, chartQueries, tableQueries].filter(Boolean).join('\n');

  const dashboardName = dash.name;

  return `${imports}
${colorsConst}
export default async function DashboardPage() {
${allQueries}

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">${dashboardName}</h1>
        <p className="text-muted-foreground">Dashboard overview</p>
      </div>

${cardElements ? `      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
${cardElements}
      </div>` : ''}

${chartElements ? `      <div className="grid gap-4 md:grid-cols-2">
${chartElements}
      </div>` : ''}

${tableElements ? `      <div className="space-y-4">
${tableElements}
      </div>` : ''}
    </div>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Generator implementation
// ---------------------------------------------------------------------------
export const nextjsGenerator: Generator = {
  name: 'nextjs',

  async generate(
    program: ProgramNode,
    context: CompilerContext,
  ): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];
    const projectName = context.options.projectName;

    // Load templates
    const packageJsonTpl = await loadTemplate('package-json.ejs');
    const tsconfigTpl = await loadTemplate('tsconfig.ejs');
    const tailwindTpl = await loadTemplate('tailwind.ejs');
    const envExampleTpl = await loadTemplate('env-example.ejs');
    const rootLayoutTpl = await loadTemplate('root-layout.ejs');
    const authConfigTpl = await loadTemplate('auth-config.ejs');
    const authMiddlewareTpl = await loadTemplate('auth-middleware.ejs');

    // Root config files
    artifacts.push({
      path: 'package.json',
      content: render(packageJsonTpl, { projectName }),
      type: 'file',
    });
    artifacts.push({
      path: 'tsconfig.json',
      content: tsconfigTpl,
      type: 'file',
    });
    artifacts.push({
      path: 'tailwind.config.ts',
      content: tailwindTpl,
      type: 'file',
    });
    artifacts.push({
      path: '.env.example',
      content: render(envExampleTpl, { projectName }),
      type: 'file',
    });

    // PostCSS config (required for Tailwind to work)
    artifacts.push({
      path: 'postcss.config.js',
      content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`,
      type: 'file',
    });

    // Next.js config
    artifacts.push({
      path: 'next.config.mjs',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
`,
      type: 'file',
    });

    // Root layout
    artifacts.push({
      path: 'src/app/layout.tsx',
      content: render(rootLayoutTpl, { projectName }),
      type: 'file',
    });

    // Auth
    artifacts.push({
      path: 'src/lib/auth.ts',
      content: authConfigTpl,
      type: 'file',
    });
    artifacts.push({
      path: 'src/middleware.ts',
      content: authMiddlewareTpl,
      type: 'file',
    });

    // Prisma client
    artifacts.push({
      path: 'src/lib/prisma.ts',
      content: `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`,
      type: 'file',
    });

    // Auth schemas (LoginSchema, RegisterSchema)
    artifacts.push({
      path: 'src/lib/schemas/auth.ts',
      content: `import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).max(255),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
`,
      type: 'file',
    });

    // shadcn/ui utility (cn helper)
    artifacts.push({
      path: 'src/lib/utils.ts',
      content: `import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`,
      type: 'file',
    });

    // NextAuth route handler
    artifacts.push({
      path: 'src/app/api/auth/[...nextauth]/route.ts',
      content: `import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
`,
      type: 'file',
    });

    // Login page
    artifacts.push({
      path: 'src/app/auth/login/page.tsx',
      content: `'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-center text-2xl font-bold">Sign In</h1>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input id="email" name="email" type="email" required className="w-full border rounded px-3 py-2" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <input id="password" name="password" type="password" required className="w-full border rounded px-3 py-2" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
`,
      type: 'file',
    });

    // Register page
    artifacts.push({
      path: 'src/app/auth/register/page.tsx',
      content: `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (res.ok) {
      router.push('/auth/login');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Registration failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-center text-2xl font-bold">Create Account</h1>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
            <input id="name" name="name" type="text" required className="w-full border rounded px-3 py-2" placeholder="Jane Doe" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input id="email" name="email" type="email" required className="w-full border rounded px-3 py-2" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="w-full border rounded px-3 py-2" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
`,
      type: 'file',
    });

    // Register API route
    artifacts.push({
      path: 'src/app/api/auth/register/route.ts',
      content: `import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, password } = body ?? {};

  if (!name || !email || !password) {
    return Response.json(
      { error: 'Name, email, and password are required' },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json(
      { error: 'A user with this email already exists' },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  return Response.json({ id: user.id, email: user.email }, { status: 201 });
}
`,
      type: 'file',
    });

    // shadcn/ui base components
    artifacts.push({
      path: 'src/components/ui/card.tsx',
      content: `import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
`,
      type: 'file',
    });

    artifacts.push({
      path: 'src/components/ui/table.tsx',
      content: `import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
  ),
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />
  ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn('h-12 px-4 text-left align-middle font-medium text-muted-foreground', className)} {...props} />
  ),
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('p-4 align-middle', className)} {...props} />
  ),
);
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
`,
      type: 'file',
    });

    // Entity pages
    for (const decl of program.declarations) {
      if (decl.type !== 'Entity') continue;

      const lowerName = decl.name.toLowerCase();
      const pluralName = lowerName + 's';

      // Table component (must come before list page)
      artifacts.push({
        path: `src/app/${pluralName}/${decl.name}Table.tsx`,
        content: generateEntityTable(decl),
        type: 'file',
      });

      // List page
      artifacts.push({
        path: `src/app/${pluralName}/page.tsx`,
        content: generateEntityListPage(decl),
        type: 'file',
      });

      // Detail page
      artifacts.push({
        path: `src/app/${pluralName}/[id]/page.tsx`,
        content: generateEntityDetailPage(decl),
        type: 'file',
      });

      // New form page
      artifacts.push({
        path: `src/app/${pluralName}/new/page.tsx`,
        content: generateEntityFormPage(decl),
        type: 'file',
      });

      // Edit page
      artifacts.push({
        path: `src/app/${pluralName}/[id]/edit/page.tsx`,
        content: generateEntityEditPage(decl),
        type: 'file',
      });

      // Server actions
      artifacts.push({
        path: `src/lib/actions/${lowerName}.ts`,
        content: generateServerAction(decl),
        type: 'file',
      });

      // REST routes
      artifacts.push({
        path: `src/app/api/${pluralName}/route.ts`,
        content: generateRestRoute(decl),
        type: 'file',
      });
      artifacts.push({
        path: `src/app/api/${pluralName}/[id]/route.ts`,
        content: generateRestRouteById(decl),
        type: 'file',
      });
    }

    // Dashboard page
    const dashboards = program.declarations.filter((d) => d.type === 'Dashboard');
    if (dashboards.length > 0) {
      artifacts.push({
        path: 'src/app/dashboard/page.tsx',
        content: generateDashboardPage(dashboards),
        type: 'file',
      });
    }

    // Environment variable validation (lazy — doesn't crash on import)
    artifacts.push({
      path: 'src/lib/env.ts',
      content: `import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  OPENROUTER_API_KEY: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

// Validate lazily so the app doesn't crash on import before .env is set up.
// The first call to getEnv() will throw a descriptive error if vars are missing.
export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => \`  - \${i.path.join('.')}: \${i.message}\`)
      .join('\\n');
    throw new Error(
      \`Invalid environment variables:\\n\\n\${missing}\\n\\n\` +
        \`Please check your .env file and ensure all required variables are set.\`,
    );
  }
  return parsed.data;
}

// Proxy for backwards compatibility — validates on first property access
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  },
});
`,
      type: 'file',
    });

    // Global CSS (Tailwind directives)
    artifacts.push({
      path: 'src/app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 210 40% 98%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 98%;
    --muted-foreground: 215 4 6.3%;
    --accent: 210 40% 98%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 60% 20%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.9%;
    --input: 217.2 32.6% 17.9%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`,
      type: 'file',
    });

    // Home page
    artifacts.push({
      path: 'src/app/page.tsx',
      content: `import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container mx-auto py-16 px-4 text-center">
      <h1 className="text-4xl font-bold mb-4">${projectName}</h1>
      <p className="text-gray-600 mb-8">Generated by Nova</p>
      <div className="space-x-4">
        <Link href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Dashboard
        </Link>
        <Link href="/auth/login" className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50">
          Sign In
        </Link>
      </div>
    </main>
  );
}
`,
      type: 'file',
    });

    return artifacts;
  },
};

export default nextjsGenerator;
