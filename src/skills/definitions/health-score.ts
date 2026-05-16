import { SkillDefinition } from '../loader';

export const healthScoreDefinition: SkillDefinition = {
  name: 'get_health_score',
  description: 'Get a quantitative health score for the target codebase. Returns scores for architecture quality, dependency health, dead code percentage, and an overall score. Use this when the query is about code quality, health metrics, or asking how good the codebase is.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the repository to analyse'
      }
    },
    required: ['path']
  }
};
