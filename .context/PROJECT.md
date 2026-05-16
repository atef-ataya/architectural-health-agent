# Architectural Health Agent

## What This Is
A production TypeScript agent combining three cognitive layers:
- Skills (procedural memory) — what to do and how
- Memory (episodic + semantic) — what happened and what is known
- Evaluation (metacognitive) — is the output good enough?

## Target
Analyses any TypeScript/JavaScript codebase using Depwire MCP tools.
Demo target: honojs/hono repository.

## Tech Stack
- Runtime: Node.js 18+, TypeScript
- LLM: Anthropic Claude (claude-opus-4-6)
- Episodic Memory: Neo4j with full-text index
- Semantic Memory: In-memory Map with TTL
- Skills: Depwire MCP via Anthropic tool_use
- Evaluation: LLM-as-judge with weighted criteria

## Series Context
Part 4 of The Context Layer — YouTube series by Atef Ataya.
Parts 1–3 built each layer separately. This video wires them together.
