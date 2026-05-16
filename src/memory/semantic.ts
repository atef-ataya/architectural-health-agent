export interface SemanticEntry {
  value: string;
  timestamp: number;
  ttl: number;
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class SemanticMemory {
  private store: Map<string, SemanticEntry> = new Map();

  set(key: string, value: string, ttlMs: number = DEFAULT_TTL): void {
    this.store.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
    console.log(`📚 Stored semantic memory: "${key}"`);
  }

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) {
      console.log(`📚 Semantic cache miss: "${key}"`);
      return null;
    }
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      console.log(`📚 Semantic cache miss: "${key}"`);
      return null;
    }
    console.log(`📚 Semantic cache hit: "${key}"`);
    return entry.value;
  }

  search(query: string): SemanticEntry[] {
    const keywords = query.toLowerCase().split(/\s+/);
    const results: SemanticEntry[] = [];
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
        continue;
      }
      const combined = (key + ' ' + entry.value).toLowerCase();
      if (keywords.some((kw) => combined.includes(kw))) {
        results.push(entry);
      }
    }
    return results;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
      } else {
        count++;
      }
    }
    return count;
  }
}
