import { SkillDefinition } from '../loader';

export const architectureSummaryDefinition: SkillDefinition = {
  name: 'get_architecture_summary',
  description: 'Analyse the high-level architecture of the target codebase. Returns structural overview including module boundaries, coupling patterns, and design decisions. Use this ONLY when the query is specifically about structure, modules, or design patterns — NOT about health scores or quality metrics.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the repository to analyse'
      },
      focus: {
        type: 'string',
        description: 'Optional specific area to focus on'
      }
    },
    required: ['path']
  }
};
