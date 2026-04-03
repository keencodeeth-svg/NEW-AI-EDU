import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type AssignmentReview = {
  id: string;
  assignmentId: string;
  studentId: string;
  overallComment?: string;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentReviewItem = {
  id: string;
  reviewId: string;
  questionId: string;
  wrongTag?: string;
  comment?: string;
};

const REVIEW_FILE = "assignment-reviews.json";
const REVIEW_ITEM_FILE = "assignment-review-items.json";

type DbReview = {
  id: string;
  assignment_id: string;
  student_id: string;
  overall_comment: string | null;
  created_at: string;
  updated_at: string;
};

type DbReviewItem = {
  id: string;
  review_id: string;
  question_id: string;
  wrong_tag: string | null;
  comment: string | null;
};

function mapReview(row: DbReview): AssignmentReview {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    overallComment: row.overall_comment ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReviewItem(row: DbReviewItem): AssignmentReviewItem {
  return {
    id: row.id,
    reviewId: row.review_id,
    questionId: row.question_id,
    wrongTag: row.wrong_tag ?? undefined,
    comment: row.comment ?? undefined
  };
}

export async function getReview(assignmentId: string, studentId: string) {
  if (!isDbEnabled()) {
    const reviews = readJson<AssignmentReview[]>(REVIEW_FILE, []);
    const review = reviews.find((item) => item.assignmentId === assignmentId && item.studentId === studentId) ?? null;
    if (!review) return { review: null, items: [] };
    const items = readJson<AssignmentReviewItem[]>(REVIEW_ITEM_FILE, []).filter(
      (item) => item.reviewId === review.id
    );
    return { review, items };
  }
  const reviewRow = await queryOne<DbReview>(
    "SELECT * FROM assignment_reviews WHERE assignment_id = $1 AND student_id = $2",
    [assignmentId, studentId]
  );
  if (!reviewRow) return { review: null, items: [] };
  const items = await query<DbReviewItem>("SELECT * FROM assignment_review_items WHERE review_id = $1", [
    reviewRow.id
  ]);
  return { review: mapReview(reviewRow), items: items.map(mapReviewItem) };
}

export async function saveReview(input: {
  assignmentId: string;
  studentId: string;
  overallComment?: string;
  items: Array<{ questionId: string; wrongTag?: string; comment?: string }>;
}) {
  const now = new Date().toISOString();
  if (!isDbEnabled()) {
    const reviews = readJson<AssignmentReview[]>(REVIEW_FILE, []);
    const index = reviews.findIndex(
      (item) => item.assignmentId === input.assignmentId && item.studentId === input.studentId
    );
    const review: AssignmentReview = {
      id: index >= 0 ? reviews[index].id : `review-${crypto.randomBytes(6).toString("hex")}`,
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      overallComment: input.overallComment,
      createdAt: index >= 0 ? reviews[index].createdAt : now,
      updatedAt: now
    };
    if (index >= 0) {
      reviews[index] = review;
    } else {
      reviews.push(review);
    }
    writeJson(REVIEW_FILE, reviews);

    const allItems = readJson<AssignmentReviewItem[]>(REVIEW_ITEM_FILE, []);
    const filtered = allItems.filter((item) => item.reviewId !== review.id);
    const nextItems = input.items.map((item) => ({
      id: `review-item-${crypto.randomBytes(6).toString("hex")}`,
      reviewId: review.id,
      questionId: item.questionId,
      wrongTag: item.wrongTag,
      comment: item.comment
    }));
    writeJson(REVIEW_ITEM_FILE, [...filtered, ...nextItems]);
    return { review, items: nextItems };
  }

  const reviewRow = await queryOne<DbReview>(
    `INSERT INTO assignment_reviews (id, assignment_id, student_id, overall_comment, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (assignment_id, student_id) DO UPDATE SET
       overall_comment = EXCLUDED.overall_comment,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      `review-${crypto.randomBytes(6).toString("hex")}`,
      input.assignmentId,
      input.studentId,
      input.overallComment ?? null,
      now,
      now
    ]
  );

  if (!reviewRow) {
    return { review: null, items: [] };
  }

  await query("DELETE FROM assignment_review_items WHERE review_id = $1", [reviewRow.id]);
  for (const item of input.items) {
    await query(
      `INSERT INTO assignment_review_items (id, review_id, question_id, wrong_tag, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `review-item-${crypto.randomBytes(6).toString("hex")}`,
        reviewRow.id,
        item.questionId,
        item.wrongTag ?? null,
        item.comment ?? null
      ]
    );
  }

  const items = await query<DbReviewItem>("SELECT * FROM assignment_review_items WHERE review_id = $1", [
    reviewRow.id
  ]);

  return { review: mapReview(reviewRow), items: items.map(mapReviewItem) };
}

export async function getReviewItemsByStudent(studentId: string): Promise<AssignmentReviewItem[]> {
  if (!isDbEnabled()) {
    const reviews = readJson<AssignmentReview[]>(REVIEW_FILE, []);
    const reviewIds = reviews.filter((item) => item.studentId === studentId).map((item) => item.id);
    if (!reviewIds.length) return [];
    const items = readJson<AssignmentReviewItem[]>(REVIEW_ITEM_FILE, []);
    const set = new Set(reviewIds);
    return items.filter((item) => set.has(item.reviewId));
  }

  const rows = await query<DbReviewItem>(
    `SELECT ari.*
     FROM assignment_review_items ari
     JOIN assignment_reviews ar ON ar.id = ari.review_id
     WHERE ar.student_id = $1`,
    [studentId]
  );
  return rows.map(mapReviewItem);
}
