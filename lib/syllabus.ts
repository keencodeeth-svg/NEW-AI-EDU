import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type CourseSyllabus = {
  id: string;
  classId: string;
  summary: string;
  objectives: string;
  gradingPolicy: string;
  scheduleText: string;
  updatedAt: string;
};

const FILE = "course-syllabi.json";

type DbSyllabus = {
  id: string;
  class_id: string;
  summary: string | null;
  objectives: string | null;
  grading_policy: string | null;
  schedule_text: string | null;
  updated_at: string;
};

function mapSyllabus(row: DbSyllabus): CourseSyllabus {
  return {
    id: row.id,
    classId: row.class_id,
    summary: row.summary ?? "",
    objectives: row.objectives ?? "",
    gradingPolicy: row.grading_policy ?? "",
    scheduleText: row.schedule_text ?? "",
    updatedAt: row.updated_at
  };
}

export async function getSyllabusByClass(classId: string): Promise<CourseSyllabus | null> {
  if (!isDbEnabled()) {
    const list = readJson<CourseSyllabus[]>(FILE, []);
    return list.find((item) => item.classId === classId) ?? null;
  }
  const row = await queryOne<DbSyllabus>("SELECT * FROM course_syllabi WHERE class_id = $1", [classId]);
  return row ? mapSyllabus(row) : null;
}

export async function upsertSyllabus(input: {
  classId: string;
  summary?: string;
  objectives?: string;
  gradingPolicy?: string;
  scheduleText?: string;
}): Promise<CourseSyllabus> {
  const updatedAt = new Date().toISOString();
  if (!isDbEnabled()) {
    const list = readJson<CourseSyllabus[]>(FILE, []);
    const index = list.findIndex((item) => item.classId === input.classId);
    const next: CourseSyllabus = {
      id: index >= 0 ? list[index].id : `syllabus-${crypto.randomBytes(6).toString("hex")}`,
      classId: input.classId,
      summary: input.summary ?? (index >= 0 ? list[index].summary : ""),
      objectives: input.objectives ?? (index >= 0 ? list[index].objectives : ""),
      gradingPolicy: input.gradingPolicy ?? (index >= 0 ? list[index].gradingPolicy : ""),
      scheduleText: input.scheduleText ?? (index >= 0 ? list[index].scheduleText : ""),
      updatedAt
    };
    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(FILE, list);
    return next;
  }

  const id = `syllabus-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbSyllabus>(
    `INSERT INTO course_syllabi (id, class_id, summary, objectives, grading_policy, schedule_text, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (class_id) DO UPDATE SET
      summary = EXCLUDED.summary,
      objectives = EXCLUDED.objectives,
      grading_policy = EXCLUDED.grading_policy,
      schedule_text = EXCLUDED.schedule_text,
      updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      id,
      input.classId,
      input.summary ?? "",
      input.objectives ?? "",
      input.gradingPolicy ?? "",
      input.scheduleText ?? "",
      updatedAt
    ]
  );

  return row ? mapSyllabus(row) : {
    id,
    classId: input.classId,
    summary: input.summary ?? "",
    objectives: input.objectives ?? "",
    gradingPolicy: input.gradingPolicy ?? "",
    scheduleText: input.scheduleText ?? "",
    updatedAt
  };
}
