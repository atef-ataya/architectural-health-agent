import Anthropic from '@anthropic-ai/sdk';

export interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  flags: string[];
}

export class Evaluator {
  private client: Anthropic;

  constructor(private apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async evaluate(
    task: string,
    skill: string,
    response: string,
    memoryContext?: string,
  ): Promise<EvaluationResult> {
    const prompt = `You are evaluating an architectural analysis response.

Original task: "${task}"
Skill used: ${skill}
Memory context provided: ${memoryContext ? 'Yes' : 'No'}

Evaluate on these criteria:
1. Answers the actual task (0–40)
2. Uses appropriate depth for the skill type (0–30)
3. Makes claims with appropriate certainty markers (0–20)
4. Integrates prior context when provided (0–10)

Return ONLY valid JSON, no preamble, no explanation:
{ "score": 0, "feedback": "one sentence", "flags": [] }

Response to evaluate:
${response}`;

    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw =
      message.content[0].type === 'text' ? message.content[0].text : '{}';
    const text = raw
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    const parsed = JSON.parse(text);

    const result: EvaluationResult = {
      score: parsed.score,
      passed: parsed.score >= 70,
      feedback: parsed.feedback,
      flags: parsed.flags || [],
    };

    console.log(`📊 Evaluation score: ${result.score}/100`);
    return result;
  }
}
