import { getAttempts } from "./progress";
import { updateQuestion } from "./content";
import type { Difficulty } from "./types";

export type DifficultyCalibrationResult = {
  actualDifficulty: number | null;
  expectedDifficulty: number;
  deviation: number | null;
  total: number;
  correct: number;
  calibrated: boolean;
};

const EXPECTED_DIFFICULTY_SCORE: Record<Difficulty, number> = {
  easy: 30,
  medium: 55,
  hard: 80
};

export function calculateActualDifficulty(params: {
  correct: number;
  total: number;
  presetDifficulty?: Difficulty | null;
}): DifficultyCalibrationResult {
  const expectedDifficulty = EXPECTED_DIFFICULTY_SCORE[params.presetDifficulty ?? "medium"];
  if (params.total < 10) {
    return {
      actualDifficulty: null,
      expectedDifficulty,
      deviation: null,
      total: params.total,
      correct: params.correct,
      calibrated: false
    };
  }

  const correctRate = params.total > 0 ? params.correct / params.total : 0;
  const actualDifficulty = Math.max(0, Math.min(100, Math.round((1 - correctRate) * 100)));
  return {
    actualDifficulty,
    expectedDifficulty,
    deviation: actualDifficulty - expectedDifficulty,
    total: params.total,
    correct: params.correct,
    calibrated: true
  };
}

export async function recalibrateQuestionDifficulty(questionId: string, presetDifficulty?: Difficulty | null) {
  const attempts = (await getAttempts()).filter((item) => item.questionId === questionId);
  const correct = attempts.filter((item) => item.correct).length;
  const result = calculateActualDifficulty({
    correct,
    total: attempts.length,
    presetDifficulty
  });

  if (result.calibrated && typeof result.actualDifficulty === "number") {
    await updateQuestion(questionId, {
      actualDifficulty: result.actualDifficulty
    });
  }

  return result;
}

