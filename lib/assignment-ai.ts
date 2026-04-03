import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, queryOne } from "./db";

export type AssignmentAIReview = {
  id: string;
  assignmentId: string;
  studentId: string;
  provider?: string;
  result: unknown;
  createdAt: string;
  updatedAt: string;
};

const FILE = "assignment-ai-reviews.json";

type DbAIReview = {
  id: string;
  assignment_id: string;
  student_id: string;
  provider: string | null;
  result: unknown;
  created_at: string;
  updated_at: string;
};

function mapReview(row: DbAIReview): AssignmentAIReview {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    provider: row.provider ?? undefined,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getAssignmentAIReview(assignmentId: string, studentId: string) {
  if (!isDbEnabled()) {
    const list = readJson<AssignmentAIReview[]>(FILE, []);
    return list.find((item) => item.assignmentId === assignmentId && item.studentId === studentId) ?? null;
  }
  const row = await queryOne<DbAIReview>(
    "SELECT * FROM assignment_ai_reviews WHERE assignment_id = $1 AND student_id = $2",
    [assignmentId, studentId]
  );
  return row ? mapReview(row) : null;
}

export async function upsertAssignmentAIReview(input: {
  assignmentId: string;
  studentId: string;
  result: unknown;
  provider?: string;
}) {
  const now = new Date().toISOString();
  if (!isDbEnabled()) {
    const list = readJson<AssignmentAIReview[]>(FILE, []);
    const index = list.findIndex(
      (item) => item.assignmentId === input.assignmentId && item.studentId === input.studentId
    );
    const record: AssignmentAIReview = {
      id: index >= 0 ? list[index].id : `ai-review-${crypto.randomBytes(6).toString("hex")}`,
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      provider: input.provider,
      result: input.result,
      createdAt: index >= 0 ? list[index].createdAt : now,
      updatedAt: now
    };
    if (index >= 0) {
      list[index] = record;
    } else {
      list.unshift(record);
    }
    writeJson(FILE, list);
    return record;
  }

  const existing = await queryOne<DbAIReview>(
    "SELECT * FROM assignment_ai_reviews WHERE assignment_id = $1 AND student_id = $2",
    [input.assignmentId, input.studentId]
  );
  const id = existing?.id ?? `ai-review-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbAIReview>(
    `INSERT INTO assignment_ai_reviews (id, assignment_id, student_id, provider, result, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (assignment_id, student_id) DO UPDATE SET
       provider = EXCLUDED.provider,
       result = EXCLUDED.result,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      id,
      input.assignmentId,
      input.studentId,
      input.provider ?? null,
      input.result as Record<string, unknown>,
      existing?.created_at ?? now,
      now
    ]
  );
  return row ? mapReview(row) : null;
}
