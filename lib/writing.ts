import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
import type { WritingFeedback } from "./ai";

export type WritingSubmission = {
  id: string;
  userId: string;
  subject: string;
  grade: string;
  title?: string;
  content: string;
  feedback: WritingFeedback;
  createdAt: string;
};

const WRITING_FILE = "writing-submissions.json";

type DbWritingSubmission = {
  id: string;
  user_id: string;
  subject: string;
  grade: string;
  title: string | null;
  content: string;
  feedback: unknown;
  created_at: string;
};

function mapSubmission(row: DbWritingSubmission): WritingSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    grade: row.grade,
    title: row.title ?? undefined,
    content: row.content,
    feedback: row.feedback as WritingFeedback,
    createdAt: row.created_at
  };
}

export async function getWritingSubmissionsByUser(userId: string) {
  if (!isDbEnabled()) {
    const list = readJson<WritingSubmission[]>(WRITING_FILE, []);
    return list.filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = await query<DbWritingSubmission>(
    "SELECT * FROM writing_submissions WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map(mapSubmission);
}

export async function addWritingSubmission(input: {
  userId: string;
  subject: string;
  grade: string;
  title?: string;
  content: string;
  feedback: WritingFeedback;
}) {
  const createdAt = new Date().toISOString();
  const submission: WritingSubmission = {
    id: `writing-${crypto.randomBytes(6).toString("hex")}`,
    userId: input.userId,
    subject: input.subject,
    grade: input.grade,
    title: input.title,
    content: input.content,
    feedback: input.feedback,
    createdAt
  };

  if (!isDbEnabled()) {
    const list = readJson<WritingSubmission[]>(WRITING_FILE, []);
    list.unshift(submission);
    writeJson(WRITING_FILE, list.slice(0, 50));
    return submission;
  }

  const row = await queryOne<DbWritingSubmission>(
    `INSERT INTO writing_submissions
     (id, user_id, subject, grade, title, content, feedback, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      submission.id,
      submission.userId,
      submission.subject,
      submission.grade,
      submission.title ?? null,
      submission.content,
      submission.feedback,
      submission.createdAt
    ]
  );

  return row ? mapSubmission(row) : submission;
}
