import { isDbEnabled, isMissingRelationError, query } from './db';
import { readJson } from './storage';
import { getKnowledgePoints } from './content';
import { getMasteryRecordsByUser, indexMasteryByKnowledgePoint } from './mastery';

export type KnowledgeGraphNode = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  chapter: string;
  unit: string | undefined;
  masteryScore: number;
  masteryLevel: 'weak' | 'developing' | 'strong' | 'locked' | 'not_started';
  confidenceScore: number;
  masteryTrend7d: number;
  totalAttempts: number;
  practiceHref: string;
};

export type KnowledgeGraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type KnowledgeGraphData = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  subjects: string[];
  grades: string[];
};

type DbPrerequisite = {
  id: string;
  knowledge_point_id: string;
  prerequisite_id: string;
};

type JsonPrerequisite = {
  id: string;
  knowledgePointId: string;
  prerequisiteId: string;
};

const PREREQUISITES_FILE = 'kp-prerequisites.json';

function isRecoverableKnowledgeMapSourceError(error: unknown, relationName: string) {
  const message = (error as { message?: string } | null)?.message ?? '';
  return (
    isMissingRelationError(error, relationName) ||
    message.includes(`DATABASE_URL is required for ${relationName}`)
  );
}

async function loadKnowledgePointsForGraph() {
  try {
    return await getKnowledgePoints();
  } catch (error) {
    // Keep the student-facing graph usable while local/staging data migrations catch up.
    if (isRecoverableKnowledgeMapSourceError(error, 'knowledge_points')) {
      return [];
    }
    throw error;
  }
}

async function loadMasteryRecordsForGraph(userId: string) {
  try {
    return await getMasteryRecordsByUser(userId);
  } catch (error) {
    // Mastery is an enhancement on top of the graph; without it nodes can still render as not_started.
    if (isRecoverableKnowledgeMapSourceError(error, 'mastery_records')) {
      return [];
    }
    throw error;
  }
}

async function loadPrerequisites(): Promise<
  { knowledgePointId: string; prerequisiteId: string }[]
> {
  if (isDbEnabled()) {
    try {
      const rows = await query<DbPrerequisite>('SELECT * FROM kp_prerequisites');
      return rows.map((row) => ({
        knowledgePointId: row.knowledge_point_id,
        prerequisiteId: row.prerequisite_id,
      }));
    } catch (error) {
      // Knowledge map should stay usable even before optional prerequisite migrations land locally.
      if (isMissingRelationError(error, 'kp_prerequisites')) {
        return [];
      }
      throw error;
    }
  }
  const items = readJson<JsonPrerequisite[]>(PREREQUISITES_FILE, []);
  return items.map((item) => ({
    knowledgePointId: item.knowledgePointId,
    prerequisiteId: item.prerequisiteId,
  }));
}

export async function buildKnowledgeGraph(
  userId: string,
  subject?: string,
  grade?: string,
): Promise<KnowledgeGraphData> {
  const allKnowledgePoints = await loadKnowledgePointsForGraph();
  const filtered = allKnowledgePoints.filter((kp) => {
    if (subject && kp.subject !== subject) return false;
    if (grade && kp.grade !== grade) return false;
    return true;
  });

  const masteryRecords = await loadMasteryRecordsForGraph(userId);
  const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);

  const allPrerequisites = await loadPrerequisites();
  const kpIdSet = new Set(filtered.map((kp) => kp.id));

  const relevantPrerequisites = allPrerequisites.filter(
    (p) => kpIdSet.has(p.knowledgePointId) && kpIdSet.has(p.prerequisiteId),
  );

  const prerequisitesByKp = new Map<string, string[]>();
  for (const p of relevantPrerequisites) {
    const existing = prerequisitesByKp.get(p.knowledgePointId) ?? [];
    existing.push(p.prerequisiteId);
    prerequisitesByKp.set(p.knowledgePointId, existing);
  }

  const nodes: KnowledgeGraphNode[] = filtered.map((kp) => {
    const mastery = masteryMap.get(kp.id);
    let masteryScore = 0;
    let confidenceScore = 0;
    let masteryTrend7d = 0;
    let totalAttempts = 0;
    let masteryLevel: KnowledgeGraphNode['masteryLevel'] = 'not_started';

    if (mastery) {
      masteryScore = mastery.masteryScore;
      confidenceScore = mastery.confidenceScore;
      masteryTrend7d = mastery.masteryTrend7d;
      totalAttempts = mastery.total;

      if (masteryScore >= 85) {
        masteryLevel = 'strong';
      } else if (masteryScore >= 60) {
        masteryLevel = 'developing';
      } else {
        masteryLevel = 'weak';
      }
    }

    const prereqIds = prerequisitesByKp.get(kp.id) ?? [];
    if (prereqIds.length > 0 && masteryLevel !== 'strong') {
      const hasWeakPrereq = prereqIds.some((prereqId) => {
        const prereqMastery = masteryMap.get(prereqId);
        return !prereqMastery || prereqMastery.masteryScore < 60;
      });
      if (hasWeakPrereq) {
        masteryLevel = 'locked';
      }
    }

    const practiceHref = `/tutor?subject=${encodeURIComponent(kp.subject)}&knowledgePoint=${encodeURIComponent(kp.id)}`;

    return {
      id: kp.id,
      title: kp.title,
      subject: kp.subject,
      grade: kp.grade,
      chapter: kp.chapter,
      unit: kp.unit,
      masteryScore,
      masteryLevel,
      confidenceScore,
      masteryTrend7d,
      totalAttempts,
      practiceHref,
    };
  });

  const edges: KnowledgeGraphEdge[] = relevantPrerequisites.map((p) => ({
    id: `edge-${p.prerequisiteId}-${p.knowledgePointId}`,
    source: p.prerequisiteId,
    target: p.knowledgePointId,
  }));

  const subjectSet = new Set<string>();
  const gradeSet = new Set<string>();
  for (const kp of allKnowledgePoints) {
    subjectSet.add(kp.subject);
    gradeSet.add(kp.grade);
  }

  return {
    nodes,
    edges,
    subjects: Array.from(subjectSet).sort(),
    grades: Array.from(gradeSet).sort(),
  };
}
