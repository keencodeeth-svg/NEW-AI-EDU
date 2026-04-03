import crypto from "crypto";
import {
  buildDeliveryRecordLabel,
  type ClassroomDeliveryAuditRecord,
  type ClassroomDeliveryClassSummary,
  type SchoolClassroomDeliveryDetailPayload,
  type SchoolClassroomDeliveryFilterOptions,
  type ClassroomDeliveryKind,
  type ClassroomDeliveryActorRole,
  type ClassroomExportFormat,
  type SchoolClassroomDeliverySummary,
} from "@/lib/classroom-integration";
import { isDbEnabled, query, queryOne } from "@/lib/db";
import { shouldAllowDbBootstrapFromJsonFallback } from "@/lib/runtime-guardrails";
import { readJson, updateJson } from "@/lib/storage";

const CLASSROOM_DELIVERY_LEDGER_FILE = "classroom-delivery-ledger.json";
const MAX_LEDGER_RECORDS = 5000;
const RECENT_DELIVERY_LIMIT = 8;
const TOP_CLASS_LIMIT = 5;

type DbClassroomDeliveryAuditRecord = {
  id: string;
  school_id: string;
  actor_user_id: string;
  actor_name: string | null;
  actor_role: string;
  stage_id: string;
  stage_name: string;
  source: string | null;
  class_id: string | null;
  class_name: string | null;
  subject: string | null;
  grade: string | null;
  learning_mode: string | null;
  audience_mode: string | null;
  student_count: number | null;
  teacher_id: string | null;
  teacher_name: string | null;
  learner_id: string | null;
  learner_name: string | null;
  kind: string;
  format: string | null;
  label: string;
  file_name: string | null;
  published_url: string | null;
  created_at: string | Date;
};

type MutableDeliveryRecord = Partial<ClassroomDeliveryAuditRecord>;

let dbBootstrapReady: Promise<void> | null = null;
let dbBootstrapCompleted = false;

function cleanString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function cleanPositiveInteger(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.round(value);
}

function normalizeTimestamp(value?: string | Date | null) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeDeliveryActorRole(value?: string | null): ClassroomDeliveryActorRole {
  if (value === "teacher" || value === "student" || value === "school_admin" || value === "admin") {
    return value;
  }
  return "teacher";
}

function normalizeDeliveryKind(value?: string | null): ClassroomDeliveryKind {
  return value === "publish" ? "publish" : "export";
}

function normalizeDeliveryFormat(value?: string | null): ClassroomExportFormat | "share-link" | undefined {
  if (value === "pptx" || value === "resource-pack" || value === "share-link") {
    return value;
  }
  return undefined;
}

function buildNormalizedRecord(record: MutableDeliveryRecord): ClassroomDeliveryAuditRecord | null {
  const schoolId = cleanString(record.schoolId);
  const actorUserId = cleanString(record.actorUserId);
  const stageId = cleanString(record.stageId);
  const createdAt = normalizeTimestamp(record.createdAt) ?? new Date().toISOString();

  if (!schoolId || !actorUserId || !stageId) {
    return null;
  }

  const kind = normalizeDeliveryKind(record.kind);
  const format = normalizeDeliveryFormat(record.format);
  const stageName =
    cleanString(record.stageName) ||
    cleanString(record.className) ||
    cleanString(record.label) ||
    "未命名互动课堂";

  return {
    id: cleanString(record.id) ?? `delivery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    schoolId,
    actorUserId,
    actorName: cleanString(record.actorName),
    actorRole: normalizeDeliveryActorRole(record.actorRole),
    stageId,
    stageName,
    source: record.source,
    classId: cleanString(record.classId),
    className: cleanString(record.className) ?? stageName,
    subject: cleanString(record.subject),
    grade: cleanString(record.grade),
    learningMode: record.learningMode,
    audienceMode: record.audienceMode,
    studentCount: cleanPositiveInteger(record.studentCount),
    teacherId: cleanString(record.teacherId),
    teacherName: cleanString(record.teacherName),
    learnerId: cleanString(record.learnerId),
    learnerName: cleanString(record.learnerName),
    kind,
    format,
    label:
      cleanString(record.label) ||
      buildDeliveryRecordLabel({
        kind,
        format,
      }),
    fileName: cleanString(record.fileName),
    publishedUrl: cleanString(record.publishedUrl),
    createdAt,
  };
}

function mapDbRecord(row: DbClassroomDeliveryAuditRecord): ClassroomDeliveryAuditRecord | null {
  return buildNormalizedRecord({
    id: row.id,
    schoolId: row.school_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name ?? undefined,
    actorRole: normalizeDeliveryActorRole(row.actor_role),
    stageId: row.stage_id,
    stageName: row.stage_name,
    source: (row.source ?? undefined) as ClassroomDeliveryAuditRecord["source"],
    classId: row.class_id ?? undefined,
    className: row.class_name ?? undefined,
    subject: row.subject ?? undefined,
    grade: row.grade ?? undefined,
    learningMode: (row.learning_mode ?? undefined) as ClassroomDeliveryAuditRecord["learningMode"],
    audienceMode: (row.audience_mode ?? undefined) as ClassroomDeliveryAuditRecord["audienceMode"],
    studentCount: row.student_count ?? undefined,
    teacherId: row.teacher_id ?? undefined,
    teacherName: row.teacher_name ?? undefined,
    learnerId: row.learner_id ?? undefined,
    learnerName: row.learner_name ?? undefined,
    kind: normalizeDeliveryKind(row.kind),
    format: normalizeDeliveryFormat(row.format),
    label: row.label,
    fileName: row.file_name ?? undefined,
    publishedUrl: row.published_url ?? undefined,
    createdAt: normalizeTimestamp(row.created_at),
  });
}

async function bootstrapDbFromFileIfNeeded() {
  if (!isDbEnabled() || dbBootstrapCompleted) return;
  if (dbBootstrapReady) return dbBootstrapReady;

  dbBootstrapReady = (async () => {
    try {
      const existing = await queryOne<{ id: string }>("SELECT id FROM classroom_delivery_audit LIMIT 1");
      if (existing) {
        dbBootstrapCompleted = true;
        return;
      }

      const fallback = shouldAllowDbBootstrapFromJsonFallback()
        ? readJson<MutableDeliveryRecord[]>(CLASSROOM_DELIVERY_LEDGER_FILE, [])
        : [];
      const normalizedRecords = fallback
        .map((item) => buildNormalizedRecord(item))
        .filter((item): item is ClassroomDeliveryAuditRecord => Boolean(item))
        .sort(compareByCreatedAtDesc);

      for (const record of normalizedRecords) {
        await query(
          `INSERT INTO classroom_delivery_audit (
             id,
             school_id,
             actor_user_id,
             actor_name,
             actor_role,
             stage_id,
             stage_name,
             source,
             class_id,
             class_name,
             subject,
             grade,
             learning_mode,
             audience_mode,
             student_count,
             teacher_id,
             teacher_name,
             learner_id,
             learner_name,
             kind,
             format,
             label,
             file_name,
             published_url,
             created_at
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
             $21, $22, $23, $24, $25
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            record.id,
            record.schoolId,
            record.actorUserId,
            record.actorName ?? null,
            record.actorRole,
            record.stageId,
            record.stageName,
            record.source ?? null,
            record.classId ?? null,
            record.className ?? null,
            record.subject ?? null,
            record.grade ?? null,
            record.learningMode ?? null,
            record.audienceMode ?? null,
            record.studentCount ?? null,
            record.teacherId ?? null,
            record.teacherName ?? null,
            record.learnerId ?? null,
            record.learnerName ?? null,
            record.kind,
            record.format ?? null,
            record.label,
            record.fileName ?? null,
            record.publishedUrl ?? null,
            record.createdAt,
          ],
        );
      }

      dbBootstrapCompleted = true;
    } finally {
      dbBootstrapReady = null;
    }
  })();

  return dbBootstrapReady;
}

function compareByCreatedAtDesc(left: ClassroomDeliveryAuditRecord, right: ClassroomDeliveryAuditRecord) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

export async function readClassroomDeliveryLedger(): Promise<ClassroomDeliveryAuditRecord[]> {
  if (!isDbEnabled()) {
    return readJson<MutableDeliveryRecord[]>(CLASSROOM_DELIVERY_LEDGER_FILE, [])
      .map((item) => buildNormalizedRecord(item))
      .filter((item): item is ClassroomDeliveryAuditRecord => Boolean(item))
      .sort(compareByCreatedAtDesc);
  }

  await bootstrapDbFromFileIfNeeded();
  const rows = await query<DbClassroomDeliveryAuditRecord>(
    `SELECT *
     FROM classroom_delivery_audit
     ORDER BY created_at DESC`,
  );
  return rows
    .map((item) => mapDbRecord(item))
    .filter((item): item is ClassroomDeliveryAuditRecord => Boolean(item));
}

export async function appendClassroomDeliveryLedgerRecord(
  input: Omit<ClassroomDeliveryAuditRecord, "id" | "label" | "createdAt"> & {
    id?: string;
    label?: string;
    createdAt?: string;
  },
) {
  const normalized = buildNormalizedRecord({
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });

  if (!normalized) {
    throw new Error("classroom delivery record is missing required fields");
  }

  if (isDbEnabled()) {
    await query(
      `INSERT INTO classroom_delivery_audit (
         id,
         school_id,
         actor_user_id,
         actor_name,
         actor_role,
         stage_id,
         stage_name,
         source,
         class_id,
         class_name,
         subject,
         grade,
         learning_mode,
         audience_mode,
         student_count,
         teacher_id,
         teacher_name,
         learner_id,
         learner_name,
         kind,
         format,
         label,
         file_name,
         published_url,
         created_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
         $21, $22, $23, $24, $25
       )`,
      [
        normalized.id || `delivery-${crypto.randomBytes(6).toString("hex")}`,
        normalized.schoolId,
        normalized.actorUserId,
        normalized.actorName ?? null,
        normalized.actorRole,
        normalized.stageId,
        normalized.stageName,
        normalized.source ?? null,
        normalized.classId ?? null,
        normalized.className ?? null,
        normalized.subject ?? null,
        normalized.grade ?? null,
        normalized.learningMode ?? null,
        normalized.audienceMode ?? null,
        normalized.studentCount ?? null,
        normalized.teacherId ?? null,
        normalized.teacherName ?? null,
        normalized.learnerId ?? null,
        normalized.learnerName ?? null,
        normalized.kind,
        normalized.format ?? null,
        normalized.label,
        normalized.fileName ?? null,
        normalized.publishedUrl ?? null,
        normalized.createdAt,
      ],
    );
    dbBootstrapCompleted = true;
    return normalized;
  }

  await updateJson<MutableDeliveryRecord[]>(CLASSROOM_DELIVERY_LEDGER_FILE, [], (records) => {
    records.unshift(normalized);
    if (records.length > MAX_LEDGER_RECORDS) {
      records.length = MAX_LEDGER_RECORDS;
    }
    return records;
  });

  return normalized;
}

export async function listSchoolClassroomDeliveryRecords(schoolId: string) {
  return (await readClassroomDeliveryLedger()).filter((item) => item.schoolId === schoolId);
}

export function buildSchoolClassroomDeliverySummary(
  schoolId: string,
  records: ClassroomDeliveryAuditRecord[],
): SchoolClassroomDeliverySummary {
  const sortedRecords = [...records].sort(compareByCreatedAtDesc);
  const uniqueStageIds = new Set(sortedRecords.map((item) => item.stageId));
  const uniqueClassKeys = new Set(
    sortedRecords.map((item) => item.classId || item.className || item.stageId),
  );
  const topClassMap = new Map<string, ClassroomDeliveryClassSummary>();

  sortedRecords.forEach((item) => {
    const key = item.classId || item.className || item.stageId;
    const className = item.className || item.stageName || "未命名课堂";
    const current = topClassMap.get(key);
    if (current) {
      current.deliveryCount += 1;
      current.publishCount += item.kind === "publish" ? 1 : 0;
      current.exportCount += item.kind === "export" ? 1 : 0;
      if (new Date(item.createdAt).getTime() > new Date(current.lastDeliveredAt).getTime()) {
        current.lastDeliveredAt = item.createdAt;
      }
      return;
    }

    topClassMap.set(key, {
      key,
      classId: item.classId,
      className,
      subject: item.subject,
      grade: item.grade,
      deliveryCount: 1,
      publishCount: item.kind === "publish" ? 1 : 0,
      exportCount: item.kind === "export" ? 1 : 0,
      lastDeliveredAt: item.createdAt,
    });
  });

  const topClasses = Array.from(topClassMap.values())
    .sort((left, right) => {
      if (right.deliveryCount !== left.deliveryCount) {
        return right.deliveryCount - left.deliveryCount;
      }
      return new Date(right.lastDeliveredAt).getTime() - new Date(left.lastDeliveredAt).getTime();
    })
    .slice(0, TOP_CLASS_LIMIT);

  return {
    schoolId,
    totalDeliveries: sortedRecords.length,
    deliveredClassroomCount: uniqueStageIds.size,
    coveredClassCount: uniqueClassKeys.size,
    publishCount: sortedRecords.filter((item) => item.kind === "publish").length,
    exportCount: sortedRecords.filter((item) => item.kind === "export").length,
    pptxExportCount: sortedRecords.filter((item) => item.kind === "export" && item.format === "pptx").length,
    resourcePackExportCount: sortedRecords.filter(
      (item) => item.kind === "export" && item.format === "resource-pack",
    ).length,
    wholeClassDeliveryCount: sortedRecords.filter((item) => item.audienceMode === "whole-class").length,
    studentInitiatedCount: sortedRecords.filter((item) => item.actorRole === "student").length,
    teacherInitiatedCount: sortedRecords.filter((item) => item.actorRole === "teacher").length,
    recentDeliveries: sortedRecords.slice(0, RECENT_DELIVERY_LIMIT),
    topClasses,
  };
}

export async function getSchoolClassroomDeliverySummary(schoolId: string) {
  return buildSchoolClassroomDeliverySummary(
    schoolId,
    await listSchoolClassroomDeliveryRecords(schoolId),
  );
}

function buildFilterOptions(records: ClassroomDeliveryAuditRecord[]): SchoolClassroomDeliveryFilterOptions {
  const sortZh = (values: string[]) =>
    [...values].sort((left, right) => left.localeCompare(right, "zh-CN"));

  return {
    actorRoles: Array.from(new Set(records.map((item) => item.actorRole))),
    audienceModes: Array.from(
      new Set(records.map((item) => item.audienceMode).filter(Boolean)),
    ) as SchoolClassroomDeliveryFilterOptions["audienceModes"],
    learningModes: Array.from(
      new Set(records.map((item) => item.learningMode).filter(Boolean)),
    ) as SchoolClassroomDeliveryFilterOptions["learningModes"],
    kinds: Array.from(new Set(records.map((item) => item.kind))),
    formats: Array.from(
      new Set(records.map((item) => item.format).filter(Boolean)),
    ) as SchoolClassroomDeliveryFilterOptions["formats"],
    classNames: sortZh(
      Array.from(new Set(records.map((item) => item.className).filter(Boolean))) as string[],
    ),
    subjects: sortZh(
      Array.from(new Set(records.map((item) => item.subject).filter(Boolean))) as string[],
    ),
    grades: sortZh(
      Array.from(new Set(records.map((item) => item.grade).filter(Boolean))) as string[],
    ),
  };
}

export async function getSchoolClassroomDeliveryDetail(schoolId: string): Promise<SchoolClassroomDeliveryDetailPayload> {
  const records = await listSchoolClassroomDeliveryRecords(schoolId);
  return {
    summary: buildSchoolClassroomDeliverySummary(schoolId, records),
    records,
    filterOptions: buildFilterOptions(records),
  };
}
