import { createLearningRoute } from "@/lib/api/domains";
import { badRequest, forbidden } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import {
  buildDeliveryRecordLabel,
  type ClassroomAudienceMode,
  type ClassroomDeliveryActorRole,
  type ClassroomDeliveryKind,
  type ClassroomExportFormat,
  type ClassroomLearningMode,
  type ClassroomSource,
} from "@/lib/classroom-integration";
import { getClassById } from "@/lib/classes";
import { assertSameSchool } from "@/lib/guard";
import { DEFAULT_SCHOOL_ID } from "@/lib/schools";
import { appendClassroomDeliveryLedgerRecord } from "@/lib/server/classroom-delivery-ledger";

type ClassroomDeliveryBody = {
  schoolId?: string;
  stageId: string;
  stageName?: string;
  kind: ClassroomDeliveryKind;
  format?: ClassroomExportFormat | "share-link";
  label?: string;
  fileName?: string;
  publishedUrl?: string;
  createdAt?: string;
  source?: ClassroomSource;
  classId?: string;
  className?: string;
  subject?: string;
  grade?: string;
  learningMode?: ClassroomLearningMode;
  audienceMode?: ClassroomAudienceMode;
  studentCount?: number;
  teacherId?: string;
  teacherName?: string;
  learnerId?: string;
  learnerName?: string;
};

const bodySchema = v.object<ClassroomDeliveryBody>(
  {
    schoolId: v.optional(v.string({ minLength: 1 })),
    stageId: v.string({ minLength: 1 }),
    stageName: v.optional(v.string({ minLength: 1 })),
    kind: v.enum(["publish", "export"] as const),
    format: v.optional(v.enum(["pptx", "resource-pack", "share-link"] as const)),
    label: v.optional(v.string({ minLength: 1, maxLength: 120 })),
    fileName: v.optional(v.string({ minLength: 1, maxLength: 240 })),
    publishedUrl: v.optional(v.string({ minLength: 1, maxLength: 2000 })),
    createdAt: v.optional(v.string({ minLength: 1, maxLength: 80 })),
    source: v.optional(v.enum(["teacher-tools", "library", "direct", "student-self-study"] as const)),
    classId: v.optional(v.string({ minLength: 1, maxLength: 120 })),
    className: v.optional(v.string({ minLength: 1, maxLength: 120 })),
    subject: v.optional(v.string({ minLength: 1, maxLength: 80 })),
    grade: v.optional(v.string({ minLength: 1, maxLength: 80 })),
    learningMode: v.optional(
      v.enum(
        [
          "teacher-led",
          "preview-preparation",
          "subject-reinforcement",
          "interest-cultivation",
          "classroom-review",
        ] as const,
      ),
    ),
    audienceMode: v.optional(v.enum(["teacher-private", "whole-class"] as const)),
    studentCount: v.optional(v.number({ min: 0, max: 500, integer: true })),
    teacherId: v.optional(v.string({ minLength: 1, maxLength: 120 })),
    teacherName: v.optional(v.string({ minLength: 1, maxLength: 120 })),
    learnerId: v.optional(v.string({ minLength: 1, maxLength: 120 })),
    learnerName: v.optional(v.string({ minLength: 1, maxLength: 120 })),
  },
  { allowUnknown: false },
);

function resolveActorRole(role: string): ClassroomDeliveryActorRole {
  if (role === "teacher" || role === "student" || role === "school_admin" || role === "admin") {
    return role;
  }
  throw new Error("unsupported actor role");
}

export const POST = createLearningRoute({
  role: ["teacher", "student", "school_admin", "admin"],
  body: bodySchema,
  handler: async ({ user, body }) => {
    if (!user) {
      forbidden("unauthorized");
    }

    const requestedSchoolId = body.schoolId?.trim();
    if (user.role !== "admin" && requestedSchoolId && requestedSchoolId !== user.schoolId) {
      forbidden("cross school access denied");
    }

    const klass = body.classId
      ? await getClassById(
          body.classId,
          user.role === "admin"
            ? requestedSchoolId
              ? { schoolId: requestedSchoolId }
              : undefined
            : user.schoolId
              ? { schoolId: user.schoolId }
              : undefined,
        )
      : null;

    if (klass && user.role !== "admin") {
      assertSameSchool(user, klass.schoolId);
    }

    const resolvedSchoolId = klass?.schoolId ?? requestedSchoolId ?? user.schoolId ?? DEFAULT_SCHOOL_ID;
    if (!resolvedSchoolId) {
      badRequest("schoolId required to record classroom delivery");
    }

    const teacherId =
      body.teacherId ??
      (user.role === "teacher" ? user.id : undefined) ??
      klass?.teacherId ??
      undefined;
    const teacherName =
      body.teacherName ??
      (user.role === "teacher" ? user.name : undefined);
    const learnerId = body.learnerId ?? (user.role === "student" ? user.id : undefined);
    const learnerName = body.learnerName ?? (user.role === "student" ? user.name : undefined);
    const record = await appendClassroomDeliveryLedgerRecord({
      schoolId: resolvedSchoolId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: resolveActorRole(user.role),
      stageId: body.stageId,
      stageName: body.stageName || body.className || body.label || "未命名互动课堂",
      source: body.source,
      classId: body.classId ?? klass?.id ?? undefined,
      className: body.className ?? klass?.name ?? body.stageName ?? undefined,
      subject: body.subject ?? klass?.subject ?? undefined,
      grade: body.grade ?? klass?.grade ?? undefined,
      learningMode: body.learningMode,
      audienceMode: body.audienceMode,
      studentCount: body.studentCount,
      teacherId,
      teacherName,
      learnerId,
      learnerName,
      kind: body.kind,
      format: body.format,
      label:
        body.label ||
        buildDeliveryRecordLabel({
          kind: body.kind,
          format: body.format,
        }),
      fileName: body.fileName,
      publishedUrl: body.publishedUrl,
      createdAt: body.createdAt,
    });

    return { data: record };
  },
});
