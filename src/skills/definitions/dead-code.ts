import { SkillDefinition } from '../loader';

export const deadCodeDefinition: SkillDefinition = {
  name: 'find_dead_code',
  description: 'Find unused exports, unreachable code, and dead dependencies in the target codebase. Use this when the query is about unused code, cleanup opportunities, or reducing bundle size.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the repository to analyse'
      },
      threshold: {
        type: 'number',
        description: 'Minimum confidence threshold for reporting dead code (0-1, default 0.8)'
      }
    },
    required: ['path']
  }
};
