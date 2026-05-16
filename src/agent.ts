import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import { SkillLoader, SkillDefinition, SkillResult } from './skills/loader';
import { Neo4jMemory, EpisodicMemory } from './memory/neo4j';
import { SemanticMemory } from './memory/semantic';
import { Evaluator, EvaluationResult } from './evaluation/evaluator';
import { architectureSummaryDefinition } from './skills/definitions/architecture-summary';
import { healthScoreDefinition } from './skills/definitions/health-score';
import { deadCodeDefinition } from './skills/definitions/dead-code';

export interface AgentConfig {
  anthropicApiKey: string;
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
  targetRepoPath: string;
}

export interface AgentResponse {
  content: string;
  skillUsed: string;
  episodicMemoriesUsed: number;
  semanticMemoriesUsed: number;
  evaluationScore: number;
}

export class ArchitecturalHealthAgent {
  private client: Anthropic;
  private skillLoader: SkillLoader;
  private episodicMemory: Neo4jMemory;
  private semanticMemory: SemanticMemory;
  private evaluator: Evaluator;
  private targetRepoPath: string;

  constructor(config: AgentConfig) {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.skillLoader = new SkillLoader();
    this.episodicMemory = new Neo4jMemory(config.neo4jUri, config.neo4jUser, config.neo4jPassword);
    this.semanticMemory = new SemanticMemory();
    this.evaluator = new Evaluator(config.anthropicApiKey);
    this.targetRepoPath = config.targetRepoPath;
  }

  async initialize(): Promise<void> {
    await this.episodicMemory.initialize();
    this.skillLoader.register(architectureSummaryDefinition);
    this.skillLoader.register(healthScoreDefinition);
    this.skillLoader.register(deadCodeDefinition);
  }

  async processQuery(query: string): Promise<AgentResponse> {
    console.log(`🔵 Processing query: "${query}"`);

    // 1. RETRIEVE MEMORY
    const searchTerms = this.extractSearchTerms(query);
    const episodicResults = await this.episodicMemory.search(searchTerms);
    const semanticResults = this.semanticMemory.search(query);
    console.log(`📚 Found ${semanticResults.length} semantic memories`);

    const memoryContext = this.buildMemoryContext(episodicResults, semanticResults);

    // 2. SELECT SKILL
    const skillResult = await this.selectAndExecuteSkill(query);

    // 3. GENERATE
    const response = await this.generate(query, memoryContext, skillResult);
    console.log(`📝 Response generated (${response.length} chars)`);

    // 4. STORE MEMORY
    const topics = this.extractSearchTerms(query);
    const memoryContent = `Topics: ${topics}\nQuery: ${query}\nSkill: ${skillResult.skillName}\nResponse summary: ${response.slice(0, 500)}`;
    const memId = await this.episodicMemory.store(
      memoryContent,
      { skill: skillResult.skillName, query }
    );
    const topicKey = this.extractTopicKey(query);
    this.semanticMemory.set(topicKey, response.slice(0, 300));

    // 5. EVALUATE
    const evaluation = await this.evaluator.evaluate(
      query,
      skillResult.skillName,
      response,
      memoryContext || undefined
    );

    let finalResponse = response;
    let finalScore = evaluation.score;

    if (!evaluation.passed) {
      console.log('🔄 Score below threshold. Retrying with evaluator feedback...');
      finalResponse = await this.generate(query, memoryContext, skillResult, `${evaluation.feedback} (Score: ${evaluation.score}/100)`);
      const retryEval = await this.evaluator.evaluate(
        query,
        skillResult.skillName,
        finalResponse,
        memoryContext || undefined
      );
      finalScore = retryEval.score;
    }

    console.log('✅ Returning response');

    return {
      content: finalResponse,
      skillUsed: skillResult.skillName,
      episodicMemoriesUsed: episodicResults.length,
      semanticMemoriesUsed: semanticResults.length,
      evaluationScore: finalScore,
    };
  }

  private async selectAndExecuteSkill(query: string): Promise<SkillResult> {
    const tools = this.skillLoader.getAll().map((skill) => ({
      name: skill.name,
      description: skill.description,
      input_schema: skill.input_schema as Anthropic.Tool['input_schema'],
    }));

    const startTime = Date.now();
    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      tools,
      messages: [
        {
          role: 'user',
          content: `You are a skill router for an architectural health agent. Based on the user query, select the most appropriate tool to use. The target repository path is: ${this.targetRepoPath}\n\nUser query: ${query}`,
        },
      ],
    });

    let skillName = 'get_architecture_summary';
    let skillInput: Record<string, any> = { path: this.targetRepoPath };

    for (const block of message.content) {
      if (block.type === 'tool_use') {
        skillName = block.name;
        skillInput = block.input as Record<string, any>;
        break;
      }
    }

    console.log(`⚙️ Executing skill: ${skillName}`);

    // Simulate Depwire MCP execution — in production this calls the actual MCP tool
    const output = await this.executeMcpTool(skillName, skillInput);
    const executionTime = Date.now() - startTime;

    return { skillName, output, executionTime };
  }

  private async executeMcpTool(name: string, input: Record<string, any>): Promise<string> {
    const repoPath = input.path || this.targetRepoPath;
    let command: string;

    switch (name) {
      case 'get_architecture_summary':
        command = `PAGER=cat depwire health --json --verbose "${repoPath}"`;
        break;
      case 'get_health_score':
        command = `PAGER=cat depwire health --json "${repoPath}"`;
        break;
      case 'find_dead_code':
        command = `PAGER=cat depwire dead-code --json "${repoPath}"`;
        break;
      default:
        command = `PAGER=cat depwire health --json "${repoPath}"`;
    }

    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
      });
      return output;
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string };
      return err.stdout || err.stderr || 'Depwire command failed';
    }
  }

  private async generate(query: string, memoryContext: string, skillResult: SkillResult, retryFeedback?: string): Promise<string> {
    const memorySection = memoryContext
      ? `\n\n## PRIOR FINDINGS FROM PREVIOUS SESSIONS\nYou have analysed this codebase before. Use these findings explicitly in your response — reference them, compare to them, build on them:\n\n${memoryContext}`
      : '';

    const retrySection = retryFeedback
      ? `\n\n## EVALUATOR FEEDBACK — MUST ADDRESS\n${retryFeedback}\n\nYour previous response was scored below threshold. Address the feedback above explicitly in your retry.`
      : '';

    const systemPrompt = `You are an architectural health agent analysing a codebase.${memorySection}${retrySection}

SKILL RESULT (${skillResult.skillName}):
${skillResult.output}

When prior findings are available, explicitly reference and compare them in your response. Cite specific numbers from prior sessions.`;

    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  }

  private buildMemoryContext(episodic: EpisodicMemory[], semantic: { value: string }[]): string {
    const parts: string[] = [];
    if (episodic.length > 0) {
      parts.push('[Episodic Memories]');
      for (const mem of episodic) {
        parts.push(`- [${mem.timestamp.toISOString()}] ${mem.content.slice(0, 300)}`);
      }
    }
    if (semantic.length > 0) {
      parts.push('[Semantic Memories]');
      for (const entry of semantic) {
        parts.push(`- ${entry.value}`);
      }
    }
    return parts.join('\n');
  }

  private extractSearchTerms(query: string): string {
    const words = query.toLowerCase().replace(/[?!.,'"]/g, '').split(/\s+/);
    const stopWords = new Set([
      'what', 'is', 'the', 'a', 'an', 'of', 'this', 'how', 'are', 'and',
      'to', 'me', 'give', 'has', 'been', 'can', 'you', 'do', 'does', 'did',
      'have', 'had', 'was', 'were', 'will', 'would', 'could', 'should',
      'that', 'with', 'from', 'for', 'about', 'into', 'its', 'it', 'my',
      'your', 'their', 'our', 'there', 'here', 'when', 'where', 'which',
      'who', 'whom', 'why', 'all', 'each', 'every', 'both', 'few', 'more',
      'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just',
      'full', 'main', 'overall', 'current', 'before', 'after', 'between',
      'found', 'changed', 'comparing',
    ]);
    const meaningful = words.filter((w) => !stopWords.has(w) && w.length > 2);
    return meaningful.join(' ') || query;
  }

  private extractTopicKey(query: string): string {
    const words = query.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/);
    const stopWords = new Set(['what', 'is', 'the', 'a', 'an', 'of', 'this', 'how', 'are', 'and', 'to', 'me', 'give']);
    const meaningful = words.filter((w) => !stopWords.has(w) && w.length > 2);
    return meaningful.slice(0, 3).join('_') || 'general';
  }

  switchRepo(repoPath: string): void {
    this.targetRepoPath = repoPath;
    console.log(`🔵 Switched target repo to: ${repoPath}`);
  }

  async close(): Promise<void> {
    await this.episodicMemory.close();
  }
}
