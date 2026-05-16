# Architectural Health Agent

A production TypeScript agent that analyses codebases using
Skills, Memory, and Evaluation working together.

> Part 4 of [The Context Layer](YOUTUBE_LINK) series by Atef Ataya.
> Parts 1–3 built each layer separately. This video wires them together.

## What It Does
Analyses any TypeScript/JavaScript repository using Depwire MCP tools.
Remembers findings across sessions. Evaluates its own output quality.
Improves answers when memory provides prior context.

## Quick Start
```bash
cp .env.example .env
# fill in your values
docker start neo4j-demo
npm install
npm run clear-memory
npm run dev "What is the overall architecture health of this codebase?"
```

## The Stack
- Skills: Depwire MCP (architecture-summary, health-score, dead-code)
- Episodic Memory: Neo4j with full-text index
- Semantic Memory: In-memory Map with 24h TTL
- Evaluation: LLM-as-judge, threshold 70, retry once
