import neo4j, { Driver, Session } from 'neo4j-driver';
import { randomUUID } from 'crypto';

export interface EpisodicMemory {
  id: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class Neo4jMemory {
  private driver: Driver;
  private indexCreated = false;

  constructor(uri: string, user: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  private static readonly INDEX_NAME = 'memory_content_index';

  async initialize(): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `CREATE CONSTRAINT memory_id_unique IF NOT EXISTS FOR (m:Memory) REQUIRE m.id IS UNIQUE`
      );
      await session.run(
        `CREATE FULLTEXT INDEX ${Neo4jMemory.INDEX_NAME} IF NOT EXISTS FOR (m:Memory) ON EACH [m.content]`
      );
      // Wait for the index to come online
      await this.waitForIndex(session);
      console.log('🧠 Episodic memory initialized with full-text index');
      this.indexCreated = true;
    } finally {
      await session.close();
    }
  }

  private async waitForIndex(session: Session): Promise<void> {
    for (let i = 0; i < 30; i++) {
      try {
        await session.run(
          `CALL db.index.fulltext.queryNodes("${Neo4jMemory.INDEX_NAME}", "test") YIELD node RETURN node LIMIT 0`
        );
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  async store(content: string, metadata?: Record<string, any>): Promise<string> {
    const session: Session = this.driver.session();
    const id = `mem_${randomUUID().slice(0, 5)}`;
    try {
      await session.run(
        `CREATE (m:Memory {
          id: $id,
          content: $content,
          timestamp: datetime(),
          metadata: $metadata
        })`,
        { id, content, metadata: JSON.stringify(metadata ?? {}) }
      );
      console.log(`💾 Stored episodic memory: ${id}`);
      return id;
    } finally {
      await session.close();
    }
  }

  async search(query: string, limit: number = 5): Promise<EpisodicMemory[]> {
    if (!this.indexCreated) {
      await this.initialize();
    }
    const session: Session = this.driver.session();
    try {
      let result;
      try {
        result = await session.run(
          `CALL db.index.fulltext.queryNodes("memory_content_index", $query)
           YIELD node, score
           RETURN node
           ORDER BY score DESC
           LIMIT $limit`,
          { query, limit: neo4j.int(limit) }
        );
      } catch {
        // Index may not be online yet — wait and retry once
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await session.close();
        const retrySession: Session = this.driver.session();
        try {
          result = await retrySession.run(
            `CALL db.index.fulltext.queryNodes("memory_content_index", $query)
             YIELD node, score
             RETURN node
             ORDER BY score DESC
             LIMIT $limit`,
            { query, limit: neo4j.int(limit) }
          );
        } catch {
          // Index truly doesn't exist — return empty
          console.log(`🔍 Found 0 episodic memories for query: "${query}"`);
          return [];
        } finally {
          await retrySession.close();
        }
        const memories = result.records.map((record) => {
          const node = record.get('node').properties;
          return {
            id: node.id,
            content: node.content,
            timestamp: new Date(node.timestamp.toString()),
            metadata: node.metadata ? JSON.parse(node.metadata) : undefined,
          };
        });
        console.log(`🔍 Found ${memories.length} episodic memories for query: "${query}"`);
        return memories;
      }
      const memories = result.records.map((record) => {
        const node = record.get('node').properties;
        return {
          id: node.id,
          content: node.content,
          timestamp: new Date(node.timestamp.toString()),
          metadata: node.metadata ? JSON.parse(node.metadata) : undefined,
        };
      });
      console.log(`🔍 Found ${memories.length} episodic memories for query: "${query}"`);
      return memories;
    } finally {
      await session.close();
    }
  }

  async getRecent(limit: number = 5): Promise<EpisodicMemory[]> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (m:Memory)
         RETURN m
         ORDER BY m.timestamp DESC
         LIMIT $limit`,
        { limit: neo4j.int(limit) }
      );
      return result.records.map((record) => {
        const node = record.get('m').properties;
        return {
          id: node.id,
          content: node.content,
          timestamp: new Date(node.timestamp.toString()),
          metadata: node.metadata ? JSON.parse(node.metadata) : undefined,
        };
      });
    } finally {
      await session.close();
    }
  }

  async clear(): Promise<number> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (m:Memory) WITH m, count(m) AS cnt DETACH DELETE m RETURN cnt`
      );
      const count = result.records.length > 0 ? result.records[0].get('cnt').toNumber() : 0;
      return count;
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
