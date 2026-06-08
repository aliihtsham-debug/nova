# ADR-0003: OpenRouter and Owl Alpha Agent Engine

## Status
Accepted

## Context
Nova relies on generative LLM agents to write custom UI layouts, construct functional tests, and run automated type repairs when TypeScript errors occur. The system requires:
1. **Developer Accessibility**: Avoid requiring developers to configure multiple API accounts (OpenAI, Anthropic, Google).
2. **Advanced Coding Performance**: Code layout generation demands a model with deep logical syntax skills.
3. **Structured Formats**: The compiler must receive responses in predictable XML/JSON configurations.

We compared direct SDK implementations (e.g. `@google/genai` or `@openai/api`) against **OpenRouter**.

## Decision
We selected **OpenRouter** as the default API gateway, with **owl-alpha** as the primary coding model:
* **Single-Token Integration**: Developers set a single environment variable (`OPENROUTER_API_KEY`) and gain access to dozens of state-of-the-art models.
* **Model Failovers**: If `owl-alpha` experiences latency spikes or outages, the routing driver can transparently fall back to other coding models (e.g. Claude 3.5 Sonnet) without editing core compiler logic.
* **Context-Window Capacity**: OpenRouter endpoints support large tokens limits, which is necessary for feeding compiler validation errors back into prompt repair context.

## Consequences
* Applications must have web access during the AI code generation phases.
* The compiler packages (`packages/openrouter`) will enforce strict payload schema checks on responses using Zod to capture LLM output drift.
