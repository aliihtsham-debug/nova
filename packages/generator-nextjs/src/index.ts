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

const __dirname = dirname(fileURLToPath(import.meta.url));
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
    .map(
      (f) => `        <div className="py-2">
          <dt className="font-medium text-gray-500">${f.name}</dt>
          <dd>{${lowerName}.${f.name}}</dd>
        </div>`,
    )
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

function generateEntityFormPage(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();

  const formFields = entity.fields
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
      if (f.fieldType === 'string' && (f.name === 'body' || f.name === 'description')) {
        return `        <div>
          <label className="block text-sm font-medium mb-1">${f.name}</label>
          <textarea name="${f.name}" rows={4} className="w-full border rounded px-3 py-2" />
        </div>`;
      }
      return `        <div>
          <label className="block text-sm font-medium mb-1">${f.name}</label>
          <input type="text" name="${f.name}" className="w-full border rounded px-3 py-2" />
        </div>`;
    })
    .join('\n');

  return `'use client';

import { useRouter } from 'next/navigation';

export default function New${name}Page() {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    const res = await fetch('/api/${lowerName}s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) router.push('/${lowerName}s');
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New ${name}</h1>
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

function generateServerAction(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();

  return `'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function create${name}(formData: FormData) {
  const data: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });

  await prisma.${lowerName}.create({ data });
  revalidatePath('/${lowerName}s');
  redirect('/${lowerName}s');
}

export async function update${name}(id: string, formData: FormData) {
  const data: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });

  await prisma.${lowerName}.update({ where: { id }, data });
  revalidatePath('/${lowerName}s');
  redirect('/${lowerName}s');
}

export async function delete${name}(id: string) {
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

export async function GET() {
  const items = await prisma.${lowerName}.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = await request.json();
  const item = await prisma.${lowerName}.create({ data: body });
  return NextResponse.json(item, { status: 201 });
}
`;
}

function generateRestRouteById(entity: EntityNode): string {
  const name = entity.name;
  const lowerName = name.toLowerCase();

  return `import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
  const body = await request.json();
  const item = await prisma.${lowerName}.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(item);
}

export async function DELETE(_request: Request, { params }: Props) {
  await prisma.${lowerName}.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
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
    const dashboardPageTpl = await loadTemplate('dashboard-page.ejs');

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
      content: envExampleTpl,
      type: 'file',
    });

    // Root layout
    artifacts.push({
      path: 'src/app/layout.tsx',
      content: rootLayoutTpl,
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

    // Entity pages
    for (const decl of program.declarations) {
      if (decl.type !== 'Entity') continue;

      const lowerName = decl.name.toLowerCase();
      const pluralName = lowerName + 's';

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
        content: dashboardPageTpl,
        type: 'file',
      });
    }

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
        <Link href="/login" className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50">
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
