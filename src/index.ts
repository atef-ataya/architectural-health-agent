import * as dotenv from 'dotenv';
dotenv.config();

import { ArchitecturalHealthAgent } from './agent';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const useRepo2 = args.includes('--repo2');
  const query = args.filter((a) => a !== '--repo2').join(' ');

  if (!query) {
    console.error('Usage: npm run dev "your question about the codebase"');
    console.error('       npm run dev --repo2 "your question about the second codebase"');
    process.exit(1);
  }

  const targetRepoPath = useRepo2
    ? process.env.TARGET_REPO_PATH_2!
    : process.env.TARGET_REPO_PATH!;

  const agent = new ArchitecturalHealthAgent({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    neo4jUri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4jUser: process.env.NEO4J_USER || 'neo4j',
    neo4jPassword: process.env.NEO4J_PASSWORD!,
    targetRepoPath,
  });

  await agent.initialize();
  const response = await agent.processQuery(query);

  console.log('\n📋 Final Response:');
  console.log(response.content);
  console.log(`\n✅ Skill used: ${response.skillUsed}`);
  console.log(`🧠 Episodic memories retrieved: ${response.episodicMemoriesUsed}`);
  console.log(`📚 Semantic memories retrieved: ${response.semanticMemoriesUsed}`);
  console.log(`📊 Final score: ${response.evaluationScore}/100`);

  await agent.close();
}

main().catch(console.error);
