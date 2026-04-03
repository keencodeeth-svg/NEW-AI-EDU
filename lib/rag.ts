import { getKnowledgePoints, getQuestions } from "./content";

export async function retrieveKnowledgePoints(question: string, subject?: string, grade?: string) {
  const input = question.toLowerCase();
  const knowledgePoints = (await getKnowledgePoints()).filter((kp) => {
    if (subject && kp.subject !== subject) return false;
    if (grade && kp.grade !== grade) return false;
    return true;
  });

  const scored = knowledgePoints
    .map((kp) => {
      const title = kp.title.toLowerCase();
      const chapter = kp.chapter.toLowerCase();
      let score = 0;
      if (input.includes(title)) score += 2;
      if (input.includes(chapter)) score += 1;
      const tokens = title.split(/\s+/).filter(Boolean);
      tokens.forEach((token) => {
        if (token.length > 1 && input.includes(token)) score += 1;
      });
      return { kp, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0)
    .slice(0, 3);

  return scored.map((item) => item.kp);
}

export async function retrieveSimilarQuestion(question: string, subject?: string, grade?: string) {
  const input = question.toLowerCase();
  const questions = (await getQuestions()).filter((q) => {
    if (subject && q.subject !== subject) return false;
    if (grade && q.grade !== grade) return false;
    return true;
  });

  const best = questions
    .map((q) => {
      const stem = q.stem.toLowerCase();
      let score = 0;
      if (input.includes(stem)) score += 3;
      const tokens = stem.split(/\s+/).filter(Boolean);
      tokens.forEach((token) => {
        if (token.length > 1 && input.includes(token)) score += 1;
      });
      return { q, score };
    })
    .sort((a, b) => b.score - a.score)[0];

  return best && best.score > 0 ? best.q : null;
}
