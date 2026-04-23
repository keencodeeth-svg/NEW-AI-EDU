import crypto from "crypto";
import { getClassesByStudent, getClassesByTeacher } from "../classes";
import { isDbEnabled, isMissingRelationError, query, queryOne } from "../db";
import { readJson, updateJson } from "../storage";

export type PblProjectRecord = {
  id: string;
  title: string;
  description: string;
  subjects: string[];
  classId?: string | null;
  createdBy: string;
  featured: boolean;
  rubric: string[];
  createdAt: string;
};

export type PblTaskRecord = {
  id: string;
  projectId: string;
  subject: string;
  title: string;
  description: string;
  sortOrder: number;
};

export type PblSubmissionRecord = {
  id: string;
  taskId: string;
  studentId: string;
  content: string;
  aiFeedback?: string | null;
  score?: number | null;
  submittedAt: string;
};

type DbProjectRow = {
  id: string;
  title: string;
  description: string;
  subjects: string[] | null;
  class_id: string | null;
  created_by: string;
  featured: boolean;
  rubric: string[] | null;
  created_at: string;
};

type DbTaskRow = {
  id: string;
  project_id: string;
  subject: string;
  title: string;
  description: string;
  sort_order: number;
};

type DbSubmissionRow = {
  id: string;
  task_id: string;
  student_id: string;
  content: string;
  ai_feedback: string | null;
  score: number | null;
  submitted_at: string;
};

const PROJECT_FILE = "pbl-projects.json";
const TASK_FILE = "pbl-tasks.json";
const SUBMISSION_FILE = "pbl-submissions.json";

function shouldUseFileFallback(error: unknown) {
  return isMissingRelationError(error, ["pbl_projects", "pbl_tasks", "pbl_submissions"]);
}

function mapProject(row: DbProjectRow): PblProjectRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subjects: row.subjects ?? [],
    classId: row.class_id,
    createdBy: row.created_by,
    featured: row.featured,
    rubric: row.rubric ?? [],
    createdAt: row.created_at
  };
}

function mapTask(row: DbTaskRow): PblTaskRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    subject: row.subject,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order
  };
}

function mapSubmission(row: DbSubmissionRow): PblSubmissionRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    studentId: row.student_id,
    content: row.content,
    aiFeedback: row.ai_feedback,
    score: row.score,
    submittedAt: row.submitted_at
  };
}

export async function createPblProject(input: {
  title: string;
  description: string;
  subjects: string[];
  classId?: string;
  createdBy: string;
  featured?: boolean;
  rubric?: string[];
  tasks: Array<{
    subject: string;
    title: string;
    description: string;
  }>;
}) {
  const createdAt = new Date().toISOString();
  const project: PblProjectRecord = {
    id: `pbl-${crypto.randomBytes(6).toString("hex")}`,
    title: input.title,
    description: input.description,
    subjects: input.subjects,
    classId: input.classId ?? null,
    createdBy: input.createdBy,
    featured: Boolean(input.featured),
    rubric: input.rubric ?? [],
    createdAt
  };
  const tasks: PblTaskRecord[] = input.tasks.map((task, index) => ({
    id: `pbl-task-${crypto.randomBytes(6).toString("hex")}`,
    projectId: project.id,
    subject: task.subject,
    title: task.title,
    description: task.description,
    sortOrder: index
  }));

  if (!isDbEnabled()) {
    await updateJson<PblProjectRecord[]>(PROJECT_FILE, [], (list) => {
      list.push(project);
    });
    await updateJson<PblTaskRecord[]>(TASK_FILE, [], (list) => {
      list.push(...tasks);
    });
    return { project, tasks };
  }
  try {
    const projectRow = await queryOne<DbProjectRow>(
      `INSERT INTO pbl_projects
       (id, title, description, subjects, class_id, created_by, featured, rubric, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        project.id,
        project.title,
        project.description,
        project.subjects,
        project.classId ?? null,
        project.createdBy,
        project.featured,
        project.rubric,
        project.createdAt
      ]
    );
    for (const task of tasks) {
      await query(
        `INSERT INTO pbl_tasks (id, project_id, subject, title, description, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [task.id, task.projectId, task.subject, task.title, task.description, task.sortOrder]
      );
    }
    return { project: projectRow ? mapProject(projectRow) : project, tasks };
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    await updateJson<PblProjectRecord[]>(PROJECT_FILE, [], (list) => {
      list.push(project);
    });
    await updateJson<PblTaskRecord[]>(TASK_FILE, [], (list) => {
      list.push(...tasks);
    });
    return { project, tasks };
  }
}

export async function listPblProjectsForTeacher(teacherId: string) {
  const classes = await getClassesByTeacher(teacherId);
  const classIds = new Set(classes.map((item) => item.id));
  const projects = await listPblProjects();
  return projects.filter((item) => item.createdBy === teacherId || (item.classId ? classIds.has(item.classId) : false));
}

export async function listPblProjectsForStudent(studentId: string) {
  const classes = await getClassesByStudent(studentId);
  const classIds = new Set(classes.map((item) => item.id));
  const projects = await listPblProjects();
  return projects.filter((item) => (item.classId ? classIds.has(item.classId) : true));
}

export async function listPblProjects() {
  if (!isDbEnabled()) {
    return readJson<PblProjectRecord[]>(PROJECT_FILE, []).sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }
  try {
    const rows = await query<DbProjectRow>(
      `SELECT * FROM pbl_projects ORDER BY created_at DESC`
    );
    return rows.map(mapProject);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return readJson<PblProjectRecord[]>(PROJECT_FILE, []).sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }
}

export async function getPblTasks(projectId: string) {
  if (!isDbEnabled()) {
    return readJson<PblTaskRecord[]>(TASK_FILE, [])
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }
  try {
    const rows = await query<DbTaskRow>(
      `SELECT * FROM pbl_tasks WHERE project_id = $1 ORDER BY sort_order ASC`,
      [projectId]
    );
    return rows.map(mapTask);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return readJson<PblTaskRecord[]>(TASK_FILE, [])
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }
}

export async function listPblSubmissions(taskId: string) {
  if (!isDbEnabled()) {
    return readJson<PblSubmissionRecord[]>(SUBMISSION_FILE, []).filter((item) => item.taskId === taskId);
  }
  try {
    const rows = await query<DbSubmissionRow>(
      `SELECT * FROM pbl_submissions WHERE task_id = $1 ORDER BY submitted_at DESC`,
      [taskId]
    );
    return rows.map(mapSubmission);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return readJson<PblSubmissionRecord[]>(SUBMISSION_FILE, []).filter((item) => item.taskId === taskId);
  }
}

export async function upsertPblSubmission(input: {
  taskId: string;
  studentId: string;
  content: string;
  aiFeedback?: string;
  score?: number;
}) {
  const record: PblSubmissionRecord = {
    id: `pbl-sub-${crypto.randomBytes(6).toString("hex")}`,
    taskId: input.taskId,
    studentId: input.studentId,
    content: input.content.trim(),
    aiFeedback: input.aiFeedback ?? null,
    score: input.score ?? null,
    submittedAt: new Date().toISOString()
  };

  if (!isDbEnabled()) {
    await updateJson<PblSubmissionRecord[]>(SUBMISSION_FILE, [], (list) => {
      const existingIndex = list.findIndex((item) => item.taskId === input.taskId && item.studentId === input.studentId);
      if (existingIndex >= 0) {
        list[existingIndex] = { ...list[existingIndex], ...record, id: list[existingIndex].id };
        return;
      }
      list.push(record);
    });
    return record;
  }
  try {
    const row = await queryOne<DbSubmissionRow>(
      `INSERT INTO pbl_submissions
       (id, task_id, student_id, content, ai_feedback, score, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (task_id, student_id) DO UPDATE SET
         content = EXCLUDED.content,
         ai_feedback = EXCLUDED.ai_feedback,
         score = EXCLUDED.score,
         submitted_at = EXCLUDED.submitted_at
       RETURNING *`,
      [
        record.id,
        record.taskId,
        record.studentId,
        record.content,
        record.aiFeedback ?? null,
        record.score ?? null,
        record.submittedAt
      ]
    );
    return row ? mapSubmission(row) : record;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    await updateJson<PblSubmissionRecord[]>(SUBMISSION_FILE, [], (list) => {
      const existingIndex = list.findIndex((item) => item.taskId === input.taskId && item.studentId === input.studentId);
      if (existingIndex >= 0) {
        list[existingIndex] = { ...list[existingIndex], ...record, id: list[existingIndex].id };
        return;
      }
      list.push(record);
    });
    return record;
  }
}

export async function togglePblProjectFeatured(projectId: string, featured: boolean) {
  if (!isDbEnabled()) {
    await updateJson<PblProjectRecord[]>(PROJECT_FILE, [], (list) => {
      const item = list.find((entry) => entry.id === projectId);
      if (item) {
        item.featured = featured;
      }
    });
    return true;
  }
  try {
    const rows = await query(
      `UPDATE pbl_projects SET featured = $2 WHERE id = $1 RETURNING id`,
      [projectId, featured]
    );
    return rows.length > 0;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    await updateJson<PblProjectRecord[]>(PROJECT_FILE, [], (list) => {
      const item = list.find((entry) => entry.id === projectId);
      if (item) {
        item.featured = featured;
      }
    });
    return true;
  }
}
