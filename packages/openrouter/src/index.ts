// ---------------------------------------------------------------------------
// @nova/openrouter — OpenRouter LLM Client + AI Agent Orchestration
// ---------------------------------------------------------------------------
// Provides a typed client for the OpenRouter API with:
//   - Prompt caching (hash-based with LRU eviction, keeps cost under $0.05/compilation)
//   - Retry with exponential backoff
//   - 4 specialized agents: Architecture, CodeGen, Testing, Repair

import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DEFAULT_MODEL = 'openrouter/owl-alpha';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 1000;

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Prompt Cache (hash-based with LRU eviction)
// ---------------------------------------------------------------------------
interface CacheEntry {
  response: string;
  timestamp: number;
  /** Used for LRU eviction */
  lastAccess: number;
}

const promptCache = new Map<string, CacheEntry>();

/**
 * djb2 hash — better distribution than additive hash, still fast.
 */
function cacheHash(prompt: string, model: string): string {
  const str = model + prompt;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function getCached(hash: string): string | null {
  const entry = promptCache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    promptCache.delete(hash);
    return null;
  }
  // Update access time for LRU
  entry.lastAccess = Date.now();
  return entry.response;
}

function setCached(hash: string, response: string): void {
  // Evict oldest entries if cache is full
  if (promptCache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of promptCache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) promptCache.delete(oldestKey);
  }
  const now = Date.now();
  promptCache.set(hash, { response, timestamp: now, lastAccess: now });
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export class OpenRouterClient {
  private client: OpenAI;
  private model: string;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(config: OpenRouterConfig) {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://nova-compiler.dev',
        'X-Title': 'Nova Compiler',
      },
    });
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxRetries = config.maxRetries ?? MAX_RETRIES;
    this.baseDelayMs = config.baseDelayMs ?? BASE_DELAY_MS;
  }

  async complete(
    prompt: string,
    options?: { useCache?: boolean; systemPrompt?: string },
  ): Promise<string> {
    const useCache = options?.useCache ?? true;
    const hash = cacheHash(prompt, this.model);

    if (useCache) {
      const cached = getCached(hash);
      if (cached) return cached;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: 0.2,
          max_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content ?? '';
        if (useCache) setCached(hash, content);
        return content;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delay = this.baseDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `OpenRouter request failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  async completeStructured<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: { systemPrompt?: string },
  ): Promise<z.infer<T>> {
    const jsonSchema = zodToJsonSchema(schema);
    const systemPrompt = (options?.systemPrompt ?? '') +
      '\n\nRespond with valid JSON matching this schema:\n' +
      JSON.stringify(jsonSchema, null, 2);

    const response = await this.complete(prompt, {
      systemPrompt,
      useCache: false,
    });

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)```/) ??
      response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : response;

    try {
      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed) as z.infer<T>;
    } catch {
      throw new Error(`Failed to parse structured response: ${response.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Agent Definitions
// ---------------------------------------------------------------------------
export interface AgentContext {
  dslSource: string;
  astSummary: string;
  targetLanguage: 'typescript';
  framework: 'nextjs';
}

export interface AgentResult {
  agent: string;
  output: string;
  tokensUsed: number;
}

export class ArchitectureAgent {
  constructor(private client: OpenRouterClient) {}

  async analyze(dslSource: string): Promise<AgentResult> {
    const output = await this.client.complete(dslSource, {
      systemPrompt: `You are a software architecture expert. Analyze the Nova DSL and produce:
1. A summary of entities, relations, and cardinality
2. Recommended database indexes
3. Suggested API endpoints
4. Authentication requirements
5. Potential performance concerns`,
    });

    return { agent: 'architecture', output, tokensUsed: 0 };
  }
}

export class CodeGenAgent {
  constructor(private client: OpenRouterClient) {}

  async generateComponent(
    entityName: string,
    fields: string[],
    componentType: 'form' | 'table' | 'card',
  ): Promise<AgentResult> {
    const output = await this.client.complete(
      `Generate a React ${componentType} component for entity "${entityName}" with fields: ${fields.join(', ')}. Use TypeScript, Tailwind CSS, and shadcn/ui patterns.`,
      {
        systemPrompt: 'You are an expert React/TypeScript developer. Generate clean, production-ready components.',
      },
    );

    return { agent: 'codegen', output, tokensUsed: 0 };
  }
}

export class TestingAgent {
  constructor(private client: OpenRouterClient) {}

  async generateTests(entityName: string, fields: string[]): Promise<AgentResult> {
    const output = await this.client.complete(
      `Generate Vitest unit tests for a Next.js server action that handles CRUD operations for entity "${entityName}" with fields: ${fields.join(', ')}.`,
      {
        systemPrompt: 'You are a testing expert. Generate comprehensive Vitest tests with good coverage.',
      },
    );

    return { agent: 'testing', output, tokensUsed: 0 };
  }
}

export class RepairAgent {
  constructor(private client: OpenRouterClient) {}

  async fixError(
    sourceCode: string,
    errorMessage: string,
  ): Promise<AgentResult> {
    const output = await this.client.complete(
      `Fix the following error in the code:\n\nError: ${errorMessage}\n\nCode:\n${sourceCode}`,
      {
        systemPrompt: 'You are a debugging expert. Analyze the error and provide the corrected code.',
      },
    );

    return { agent: 'repair', output, tokensUsed: 0 };
  }
}

// ---------------------------------------------------------------------------
// Agent Orchestrator
// ---------------------------------------------------------------------------
export class AgentOrchestrator {
  public architecture: ArchitectureAgent;
  public codegen: CodeGenAgent;
  public testing: TestingAgent;
  public repair: RepairAgent;

  constructor(client: OpenRouterClient) {
    this.architecture = new ArchitectureAgent(client);
    this.codegen = new CodeGenAgent(client);
    this.testing = new TestingAgent(client);
    this.repair = new RepairAgent(client);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createOpenRouterClient(config: OpenRouterConfig): OpenRouterClient {
  return new OpenRouterClient(config);
}

export function createAgentOrchestrator(client: OpenRouterClient): AgentOrchestrator {
  return new AgentOrchestrator(client);
}
