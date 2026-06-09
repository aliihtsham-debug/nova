import { describe, it, expect } from 'vitest';
import { compile } from '../index.js';
import type { GeneratedArtifact } from '../ast.js';

const BASIC_DSL = `entity Post {
  id uuid
  title string
  body string
  published boolean
}`;

const FULL_DSL = `entity Organization {
  id uuid
  name string
  slug string
}

entity User {
  id uuid
  name string
  email string
  role string
}

entity Post {
  id uuid
  title string
  body string
  author User @relation(User)
}

dashboard Admin {
  card TotalUsers from User
  card TotalPosts from Post
  chart bar PostsByUser from Post by author
}`;

describe('compile', () => {
  it('compiles a simple DSL without generators', async () => {
    const result = await compile(BASIC_DSL, { projectName: 'test' });
    expect(result.success).toBe(true);
    expect(result.artifacts).toHaveLength(0);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('compiles and returns diagnostics', async () => {
    const result = await compile(BASIC_DSL, { projectName: 'test' });
    expect(result.success).toBe(true);
    // Should have no errors for valid DSL
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('reports parse errors', async () => {
    const result = await compile(`invalid !!!`, { projectName: 'test' });
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('runs generators and produces artifacts', async () => {
    // Inline generator for testing
    const testGenerator = {
      name: 'test',
      async generate(_program: any, _context: any): Promise<GeneratedArtifact[]> {
        return [
          { path: 'test-output.txt', content: 'hello from generator', type: 'file' },
        ];
      },
    };

    const result = await compile(BASIC_DSL, { projectName: 'test' }, [testGenerator]);
    expect(result.success).toBe(true);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].path).toBe('test-output.txt');
    expect(result.artifacts[0].content).toBe('hello from generator');
  });

  it('runs multiple generators and merges artifacts', async () => {
    const genA = {
      name: 'genA',
      async generate(): Promise<GeneratedArtifact[]> {
        return [{ path: 'a.txt', content: 'A', type: 'file' }];
      },
    };
    const genB = {
      name: 'genB',
      async generate(): Promise<GeneratedArtifact[]> {
        return [
          { path: 'b1.txt', content: 'B1', type: 'file' },
          { path: 'b2.txt', content: 'B2', type: 'file' },
        ];
      },
    };

    const result = await compile(BASIC_DSL, { projectName: 'test' }, [genA, genB]);
    expect(result.success).toBe(true);
    expect(result.artifacts).toHaveLength(3);
    const paths = result.artifacts.map((a) => a.path);
    expect(paths).toContain('a.txt');
    expect(paths).toContain('b1.txt');
    expect(paths).toContain('b2.txt');
  });

  it('stops on generator error', async () => {
    const failingGenerator = {
      name: 'failing',
      async generate(): Promise<GeneratedArtifact[]> {
        throw new Error('Generator exploded');
      },
    };

    const result = await compile(BASIC_DSL, { projectName: 'test' }, [failingGenerator]);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GENERATOR_ERROR')).toBe(true);
    expect(result.artifacts).toHaveLength(0);
  });

  it('passes projectName to generator context', async () => {
    const capturedContext: any = {};
    const ctxGenerator = {
      name: 'ctxCapture',
      async generate(_program: any, context: any): Promise<GeneratedArtifact[]> {
        capturedContext.projectName = context.options.projectName;
        return [];
      },
    };

    await compile(BASIC_DSL, { projectName: 'my-awesome-app' }, [ctxGenerator]);
    expect(capturedContext.projectName).toBe('my-awesome-app');
  });

  it('passes auth/billing options to context', async () => {
    const capturedContext: any = {};
    const ctxGenerator = {
      name: 'ctxCapture',
      async generate(_program: any, context: any): Promise<GeneratedArtifact[]> {
        capturedContext.auth = context.options.auth;
        capturedContext.billing = context.options.billing;
        return [];
      },
    };

    await compile(BASIC_DSL, { projectName: 'x', auth: true, billing: true }, [ctxGenerator]);
    expect(capturedContext.auth).toBe(true);
    expect(capturedContext.billing).toBe(true);
  });

  it('detects duplicate entity declarations', async () => {
    const dsl = `entity User {
  id uuid
}

entity User {
  id uuid
}`;
    const result = await compile(dsl, { projectName: 'test' });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'DUPLICATE_DECLARATION')).toBe(true);
  });

  it('detects duplicate field names', async () => {
    const dsl = `entity User {
  id uuid
  name string
  name string
}`;
    const result = await compile(dsl, { projectName: 'test' });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'DUPLICATE_FIELD')).toBe(true);
  });

  it('detects unknown relation target', async () => {
    const dsl = `entity Post {
  id uuid
  author UnknownEntity @relation(UnknownEntity)
}`;
    const result = await compile(dsl, { projectName: 'test' });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'UNKNOWN_RELATION_TARGET')).toBe(true);
  });

  it('compiles the full SaaS template without errors', async () => {
    const result = await compile(FULL_DSL, { projectName: 'saas-app' });
    expect(result.success).toBe(true);
  });
});
