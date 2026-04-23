export type KnowledgeGraphNode = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  chapter: string;
  unit: string;
  masteryScore: number;
  masteryLevel: "weak" | "developing" | "strong" | "locked" | "not_started";
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
