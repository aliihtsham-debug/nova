import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateCommand } from '../commands/generate.js';

const TEST_DSL = `entity Post {
  id uuid
  title string
  body string
  published boolean
}

dashboard Overview {
  card TotalPosts from Post
  card PublishedPosts from Post where published == true
}`;

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nova-test-'));
}

describe('generate command', () => {
  let tmpDir: string;
  let dslPath: string;
  let outputDir: string;

  // Vitest runs tests in worker threads; process.chdir() is not supported there.
  // We clean up in each test instead.
  // eslint-disable-next-line vitest/no-hooks
  afterAll(() => {
    // best-effort cleanup
    try {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('generates a full Next.js app from DSL', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');

    fs.writeFileSync(dslPath, TEST_DSL);

    await generateCommand({
      file: dslPath,
      output: outputDir,
      auth: true,
      billing: false,
      force: true,
      format: false,
    });

    // Verify key artifacts exist
    expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'prisma/schema.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/lib/validations/post.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/posts/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/posts/[id]/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/posts/new/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/api/posts/route.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/api/posts/[id]/route.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/lib/actions/post.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/dashboard/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/lib/auth.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/middleware.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/lib/prisma.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/lib/env.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/globals.css'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/layout.tsx'))).toBe(true);
  });

  it('generates valid Prisma schema', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');

    fs.writeFileSync(dslPath, TEST_DSL);

    await generateCommand({
      file: dslPath,
      output: outputDir,
      auth: true,
      billing: false,
      force: true,
      format: false,
    });

    const schema = fs.readFileSync(path.join(outputDir, 'prisma/schema.prisma'), 'utf-8');
    expect(schema).toContain('model Post');
    expect(schema).toContain('title String');
    expect(schema).toContain('body String');
    expect(schema).toContain('published Boolean');
    expect(schema).toContain('@@index([createdAt])');
  });

  it('generates valid Zod schemas', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');

    fs.writeFileSync(dslPath, TEST_DSL);

    await generateCommand({
      file: dslPath,
      output: outputDir,
      auth: true,
      billing: false,
      force: true,
      format: false,
    });

    const zodContent = fs.readFileSync(
      path.join(outputDir, 'src/lib/validations/post.ts'),
      'utf-8',
    );
    expect(zodContent).toContain('createPostSchema');
    expect(zodContent).toContain('updatePostSchema');
    expect(zodContent).toContain('z.string()');
    expect(zodContent).toContain('z.boolean()');
    expect(zodContent).toContain('.partial()');
  });

  it('generates entity pages with correct content', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');

    fs.writeFileSync(dslPath, TEST_DSL);

    await generateCommand({
      file: dslPath,
      output: outputDir,
      auth: true,
      billing: false,
      force: true,
      format: false,
    });

    const listPage = fs.readFileSync(
      path.join(outputDir, 'src/app/posts/page.tsx'),
      'utf-8',
    );
    expect(listPage).toContain('PostListPage');
    expect(listPage).toContain('prisma.post.findMany');

    const detailPage = fs.readFileSync(
      path.join(outputDir, 'src/app/posts/[id]/page.tsx'),
      'utf-8',
    );
    expect(detailPage).toContain('PostDetailPage');
    expect(detailPage).toContain('prisma.post.findUnique');

    const formPage = fs.readFileSync(
      path.join(outputDir, 'src/app/posts/new/page.tsx'),
      'utf-8',
    );
    expect(formPage).toContain('NewPostPage');
    expect(formPage).toContain("'use client'");
  });

  it('generates REST API routes', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');

    fs.writeFileSync(dslPath, TEST_DSL);

    await generateCommand({
      file: dslPath,
      output: outputDir,
      auth: true,
      billing: false,
      force: true,
      format: false,
    });

    const listRoute = fs.readFileSync(
      path.join(outputDir, 'src/app/api/posts/route.ts'),
      'utf-8',
    );
    expect(listRoute).toContain('export async function GET');
    expect(listRoute).toContain('export async function POST');

    const idRoute = fs.readFileSync(
      path.join(outputDir, 'src/app/api/posts/[id]/route.ts'),
      'utf-8',
    );
    expect(idRoute).toContain('export async function GET');
    expect(idRoute).toContain('export async function PUT');
    expect(idRoute).toContain('export async function DELETE');
  });

  it('generates dashboard page', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');

    fs.writeFileSync(dslPath, TEST_DSL);

    await generateCommand({
      file: dslPath,
      output: outputDir,
      auth: true,
      billing: false,
      force: true,
      format: false,
    });

    const dashboard = fs.readFileSync(
      path.join(outputDir, 'src/app/dashboard/page.tsx'),
      'utf-8',
    );
    expect(dashboard).toContain('DashboardPage');
    expect(dashboard).toContain('TotalPosts');
    expect(dashboard).toContain('PublishedPosts');
  });

  it('generates env validation file', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');

    fs.writeFileSync(dslPath, TEST_DSL);

    await generateCommand({
      file: dslPath,
      output: outputDir,
      auth: true,
      billing: false,
      force: true,
      format: false,
    });

    const envFile = fs.readFileSync(
      path.join(outputDir, 'src/lib/env.ts'),
      'utf-8',
    );
    expect(envFile).toContain('z.object');
    expect(envFile).toContain('DATABASE_URL');
    expect(envFile).toContain('NEXTAUTH_SECRET');
    expect(envFile).toContain('getEnv');
    expect(envFile).toContain('env');
    expect(envFile).toContain('envSchema');
  });

  // ─── New assertions for Steps 2-14 artifacts ───

  it('generates postcss.config.js', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    expect(fs.existsSync(path.join(outputDir, 'postcss.config.js'))).toBe(true);
    const content = fs.readFileSync(path.join(outputDir, 'postcss.config.js'), 'utf-8');
    expect(content).toContain('tailwindcss');
    expect(content).toContain('autoprefixer');
  });

  it('generates next.config.mjs', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    expect(fs.existsSync(path.join(outputDir, 'next.config.mjs'))).toBe(true);
    const content = fs.readFileSync(path.join(outputDir, 'next.config.mjs'), 'utf-8');
    expect(content).toContain('nextConfig');
  });

  it('generates auth schemas', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    const authSchemas = fs.readFileSync(path.join(outputDir, 'src/lib/schemas/auth.ts'), 'utf-8');
    expect(authSchemas).toContain('LoginSchema');
    expect(authSchemas).toContain('RegisterSchema');
  });

  it('generates utils.ts with cn helper', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    const utils = fs.readFileSync(path.join(outputDir, 'src/lib/utils.ts'), 'utf-8');
    expect(utils).toContain('clsx');
    expect(utils).toContain('twMerge');
    expect(utils).toContain('cn');
  });

  it('generates NextAuth route handler', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    expect(fs.existsSync(path.join(outputDir, 'src/app/api/auth/[...nextauth]/route.ts'))).toBe(true);
  });

  it('generates login and register pages', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    expect(fs.existsSync(path.join(outputDir, 'src/app/auth/login/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/app/auth/register/page.tsx'))).toBe(true);
  });

  it('generates register API route', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    expect(fs.existsSync(path.join(outputDir, 'src/app/api/auth/register/route.ts'))).toBe(true);
  });

  it('generates shadcn/ui card component', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    const card = fs.readFileSync(path.join(outputDir, 'src/components/ui/card.tsx'), 'utf-8');
    expect(card).toContain('Card');
    expect(card).toContain('CardHeader');
    expect(card).toContain('CardTitle');
  });

  it('generates entity table component', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    const table = fs.readFileSync(path.join(outputDir, 'src/app/posts/PostTable.tsx'), 'utf-8');
    expect(table).toContain('PostTable');
    expect(table).toContain("'use client'");
  });

  it('generates entity edit page', async () => {
    tmpDir = createTempDir();
    dslPath = path.join(tmpDir, 'app.nova');
    outputDir = path.join(tmpDir, 'generated');
    fs.writeFileSync(dslPath, TEST_DSL);
    await generateCommand({ file: dslPath, output: outputDir, auth: true, billing: false, force: true, format: false });
    expect(fs.existsSync(path.join(outputDir, 'src/app/posts/[id]/edit/page.tsx'))).toBe(true);
  });
});
