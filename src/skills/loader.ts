export interface SkillDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface SkillResult {
  skillName: string;
  output: string;
  executionTime: number;
}

export class SkillLoader {
  private skills: Map<string, SkillDefinition> = new Map();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
    console.log(`⚙️ Registered skill: ${skill.name}`);
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }
}
