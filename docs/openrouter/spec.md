# OpenRouter Integration Specification

## Overview

The OpenRouter package (`@nova/openrouter`) manages communication with Large Language Models via the OpenRouter API gateway. It provides structured AI agents for code generation, testing, and repair.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `NOVA_MODEL` | No | Model identifier (default: `openrouter/owl-alpha`) |

## OpenRouter Client

```typescript
// packages/openrouter/src/client.ts
import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface CacheEntry {
  hash: string;
  response: string;
  timestamp: number;
}

export class OpenRouterClient {
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // ms

  constructor(apiKey: string, baseUrl = 'https://openrouter.ai/api/v1') {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/nova-compiler/nova',
        'X-Title': 'Nova Application Compiler',
      },
    });
    this.defaultModel = process.env.NOVA_MODEL ?? 'openrouter/owl-alpha';
  }

  async generate(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const cacheKey = this.hashPrompt(prompt);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return cached.response; // 1-hour cache
    }

    const model = options.model ?? this.defaultModel;
    const response = await this.retry(async () => {
      const result = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 4000,
      });
      return result.choices[0]?.message?.content ?? '';
    });

    this.cache.set(cacheKey, { hash: cacheKey, response, timestamp: Date.now() });
    return response;
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.Schema<T>,
    options: CompletionOptions = {},
  ): Promise<T> {
    const jsonSchema = zodToJsonSchema(schema);
    const structuredPrompt = `${prompt}

Return a JSON object conforming to this schema:
${JSON.stringify(jsonSchema, null, 2)}

Output ONLY valid JSON, no markdown, no code fences.`;

    const raw = await this.generate(structuredPrompt, {
      ...options,
      temperature: 0.05, // Lower temp for structured output
    });

    // Strip code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    return schema.parse(JSON.parse(cleaned));
  }

  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === this.maxRetries - 1) throw err;
        const delay = this.baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Unreachable');
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}
```

## Agent System

### Agent Base Class

```typescript
// packages/openrouter/src/agents/base.ts
export interface AgentContext {
  ast: unknown;           // ProgramNodeAST
  projectName: string;
  options: Record<string, unknown>;
}

export interface AgentResult {
  artifacts: Array<{ path: string; content: string }>;
  diagnostics: string[];
}

export abstract class BaseAgent {
  protected readonly client: OpenRouterClient;

  constructor(client: OpenRouterClient) {
    this.client = client;
  }

  abstract readonly name: string;
  abstract execute(context: AgentContext): Promise<AgentResult>;

  protected async generate(prompt: string): Promise<string> {
    return this.client.generate(prompt, { temperature: 0.1 });
  }
}
```

### Architecture Agent

```
Prompt Template:
You are the Nova Architecture Agent.
INPUT: A description of the business requirements.
TASK: Generate a .nova DSL file that defines the data models, dashboards,
     and workflows for this application.
RULES:
1. Output ONLY valid .nova DSL syntax.
2. Use proper entity, dashboard, and workflow declarations.
3. Include appropriate field types and relations.
4. Generate dashboards with cards, charts, and tables.
5. Output is a complete .nova file ready for compilation.
6. Do NOT include markdown code fences.

Requirements:
{{requirements}}
```

### Code Generation Agent

```
Prompt Template:
You are the Nova Code Generation Agent.
INPUT: AST representation of views and dashboards from a compiled .nova file.
TASK: Generate custom React components for the following pages:
     {{page_list}}
RULES:
1. Output ONLY runnable TypeScript/React (.tsx) code.
2. Use standard ESM imports.
3. Import shadcn components from "@/components/ui/".
4. Wrap all client interactions in React Server Actions.
5. Use Tailwind CSS for styling.
6. Do NOT inject comments or markdown code blocks.
7. Preserve any code between // <nova-custom-start> and // <nova-custom-end>.

AST Context:
{{ast_json}}
```

### Testing Agent

```
Prompt Template:
You are the Nova Testing Agent.
INPUT: The application structure and entity definitions.
TASK: Generate Playwright e2e test files for the application.
RULES:
1. Test login/logout flows when auth is enabled.
2. Test CRUD operations for each entity.
3. Test form validation (invalid inputs).
4. Test pagination on list pages.
5. Use page object pattern.
6. Output ONLY valid TypeScript test files.

Entity Definitions:
{{entity_list}}
```

### Repair Agent

```
Prompt Template:
You are the Nova Compiler Repair Agent.
INPUT:
  Broken code:
  {{broken_code}}

  Error messages:
  {{error_messages}}

TASK: Fix the compilation errors in the code above.
RULES:
1. Locate the exact lines causing compilation failures.
2. Output the COMPLETE fixed file, not just a diff.
3. Preserve developer custom hooks bounded by "// <nova-custom-start".
4. Do NOT change the overall file structure.
5. Output ONLY the fixed code, no explanations.
```

## Agent Orchestrator

```typescript
// packages/openrouter/src/orchestrator.ts

export class AgentOrchestrator {
  private readonly agents: Map<string, BaseAgent> = new Map();

  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
  }

  async runPipeline(
    requirements: string,
    options: Record<string, unknown> = {},
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    // Step 1: Architecture Agent → Generate .nova DSL
    const arch = this.agents.get('architecture');
    if (arch) {
      const result = await arch.execute({
        ast: null,
        projectName: options.projectName as string,
        options: { requirements },
      });
      results.push(result);
    }

    // Step 2: Compile the generated DSL (using @nova/compiler)
    // ... compile step ...

    // Step 3: Code Generation Agent → Custom UI components
    const codegen = this.agents.get('codegen');
    if (codegen) {
      const result = await codegen.execute({
        ast: null, // Compiled AST
        projectName: options.projectName as string,
        options,
      });
      results.push(result);
    }

    // Step 4: Testing Agent → Playwright tests
    const testing = this.agents.get('testing');
    if (testing) {
      const result = await testing.execute({
        ast: null,
        projectName: options.projectName as string,
        options,
      });
      results.push(result);
    }

    return results;
  }
}
```

## Rate Limiting

- Max 10 requests per second per API key
- Exponential backoff on 429 responses: 1s, 2s, 4s, 8s
- Fallback model: If `owl-alpha` returns 503, retry with `openrouter/auto`

## Caching Strategy

- Cache key: SHA-256 hash of prompt + model + temperature
- TTL: 1 hour for code generation, 24 hours for architecture
- Storage: In-memory Map (cleared on process exit)
- Cache hit: Return cached response immediately (0 API cost)

## Cost Tracking

```typescript
interface UsageStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number; // USD
  requestCount: number;
}

// Track per-compilation stats
const stats: UsageStats = {
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalCost: 0,
  requestCount: 0,
};

// Target: < $0.05 per compilation
```

## Error Handling

| Error | Action |
|-------|--------|
| 429 Rate Limited | Exponential backoff, retry |
| 503 Model Unavailable | Switch to fallback model |
| Invalid JSON Response | Retry with lower temperature |
| Timeout (> 30s) | Abort, return error to user |
| Context Too Large | Truncate prompt, retry |
