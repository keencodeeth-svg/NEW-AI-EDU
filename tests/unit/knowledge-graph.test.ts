import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

type KnowledgeGraphModule = typeof import('../../lib/knowledge-graph');

const MODULE_TARGETS = [
  '../../lib/knowledge-graph',
  '../../lib/db',
  '../../lib/content',
  '../../lib/mastery',
] as const;

function resetModules() {
  for (const target of MODULE_TARGETS) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // Ignore cache misses during isolated runs.
    }
  }
}

function loadKnowledgeGraphModule(options?: {
  dbOverrides?: Record<string, unknown>;
  contentOverrides?: Record<string, unknown>;
  masteryOverrides?: Record<string, unknown>;
}) {
  resetModules();
  const db = require('../../lib/db') as Record<string, unknown>;
  const content = require('../../lib/content') as Record<string, unknown>;
  const mastery = require('../../lib/mastery') as Record<string, unknown>;

  Object.assign(db, {
    isDbEnabled: () => true,
    query: async () => [],
    isMissingRelationError: () => false,
  });
  Object.assign(content, {
    getKnowledgePoints: async () => [
      {
        id: 'kp-1',
        title: '一次函数',
        subject: 'math',
        grade: '七年级',
        chapter: '函数',
        unit: '代数',
      },
    ],
  });
  Object.assign(mastery, {
    getMasteryRecordsByUser: async () => [],
    indexMasteryByKnowledgePoint: () => new Map(),
  });

  if (options?.dbOverrides) {
    Object.assign(db, options.dbOverrides);
  }
  if (options?.contentOverrides) {
    Object.assign(content, options.contentOverrides);
  }
  if (options?.masteryOverrides) {
    Object.assign(mastery, options.masteryOverrides);
  }

  return require('../../lib/knowledge-graph') as KnowledgeGraphModule;
}

afterEach(() => {
  resetModules();
});

test('buildKnowledgeGraph tolerates a missing prerequisite relation', async () => {
  const knowledgeGraphModule = loadKnowledgeGraphModule({
    dbOverrides: {
      query: async () => {
        throw new Error('relation "kp_prerequisites" does not exist');
      },
      isMissingRelationError: (error: unknown, relationName?: string | string[]) => {
        const names = Array.isArray(relationName) ? relationName : [relationName];
        return (
          String((error as { message?: string } | null)?.message ?? '').includes(
            'kp_prerequisites',
          ) && names.includes('kp_prerequisites')
        );
      },
    },
  });

  const data = await knowledgeGraphModule.buildKnowledgeGraph('stu-1');

  assert.equal(data.nodes.length, 1);
  assert.equal(data.edges.length, 0);
  assert.deepEqual(data.subjects, ['math']);
  assert.deepEqual(data.grades, ['七年级']);
});

test('buildKnowledgeGraph still renders nodes when mastery storage is unavailable locally', async () => {
  const knowledgeGraphModule = loadKnowledgeGraphModule({
    masteryOverrides: {
      getMasteryRecordsByUser: async () => {
        throw new Error(
          'DATABASE_URL is required for mastery_records. This state no longer supports JSON fallback.',
        );
      },
    },
  });

  const data = await knowledgeGraphModule.buildKnowledgeGraph('stu-1');

  assert.equal(data.nodes.length, 1);
  assert.equal(data.nodes[0].masteryLevel, 'not_started');
  assert.equal(data.nodes[0].masteryScore, 0);
});

test('buildKnowledgeGraph returns an empty graph instead of failing when knowledge point table is absent', async () => {
  const knowledgeGraphModule = loadKnowledgeGraphModule({
    contentOverrides: {
      getKnowledgePoints: async () => {
        throw new Error('Database relation missing: relation "knowledge_points" does not exist');
      },
    },
    dbOverrides: {
      isMissingRelationError: (error: unknown, relationName?: string | string[]) => {
        const names = Array.isArray(relationName) ? relationName : [relationName];
        return (
          String((error as { message?: string } | null)?.message ?? '').includes(
            'knowledge_points',
          ) && names.includes('knowledge_points')
        );
      },
    },
  });

  const data = await knowledgeGraphModule.buildKnowledgeGraph('stu-1');

  assert.deepEqual(data, {
    nodes: [],
    edges: [],
    subjects: [],
    grades: [],
  });
});
