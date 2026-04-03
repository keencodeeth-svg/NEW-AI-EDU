export type Subject =
  | "math"
  | "chinese"
  | "english"
  | "science"
  | "physics"
  | "chemistry"
  | "biology"
  | "history"
  | "geography"
  | "politics";
export type Difficulty = "easy" | "medium" | "hard";

export type KnowledgePoint = {
  id: string;
  subject: Subject;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

export type Question = {
  id: string;
  subject: Subject;
  grade: string;
  knowledgePointId: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty?: Difficulty;
  questionType?: string;
  tags?: string[];
  abilities?: string[];
};
