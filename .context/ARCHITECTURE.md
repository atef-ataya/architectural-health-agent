# Architecture

## Agent Loop (5 steps)
1. RETRIEVE MEMORY — search episodic (Neo4j) + semantic (Map) stores
2. SELECT SKILL — route to correct Depwire MCP tool
3. GENERATE — Claude call with skill result + memory context
4. STORE MEMORY — save to episodic (Neo4j) + semantic (Map)
5. EVALUATE — score response, retry once if below threshold

## Memory Architecture
Two stores, two purposes:
- Neo4j (episodic): timestamped findings, queryable across time
- In-memory Map (semantic): fast facts that rarely change, TTL 24h

## Skills Architecture
Depwire MCP tools registered as agent skills via Anthropic tool_use.
Three skills: architecture-summary, health-score, dead-code.
Skill router selects tool based on query intent.

## Evaluation Architecture
Standalone evaluator.ts — no external dependencies.
Threshold: 70. Retry once with feedback as context.
Four weighted criteria: task completion (40), depth (30),
certainty markers (20), context use (10).
