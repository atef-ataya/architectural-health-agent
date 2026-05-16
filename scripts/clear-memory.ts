import * as dotenv from 'dotenv';
dotenv.config();

import { Neo4jMemory } from '../src/memory/neo4j';
import { SemanticMemory } from '../src/memory/semantic';

async function clearMemory(): Promise<void> {
  console.log('🗑️  Clearing all memory entries...');

  const memory = new Neo4jMemory(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD!
  );

  try {
    await memory.initialize();
    const count = await memory.clear();
    console.log(`✅ Deleted ${count} episodic memory entries`);
  } finally {
    await memory.close();
  }

  const semantic = new SemanticMemory();
  semantic.clear();
  console.log('✅ Semantic cache cleared');
}

clearMemory().catch(console.error);
