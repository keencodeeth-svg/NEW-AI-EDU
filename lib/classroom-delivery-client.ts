import type { StageClassroomMeta } from "@/lib/classroom-integration";
import type { Stage } from "@/lib/types/stage";

type SyncClassroomDeliveryInput = {
  stageId: Stage["id"];
  stageName?: Stage["name"] | null;
  classroomMeta?: StageClassroomMeta | null;
  record: {
    kind: "publish" | "export";
    format?: "pptx" | "resource-pack" | "share-link";
    fileName?: string;
    publishedUrl?: string;
    label?: string;
    createdAt?: string;
  };
};

function cleanString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export async function syncClassroomDeliveryAudit(input: SyncClassroomDeliveryInput) {
  const { classroomMeta, record } = input;

  const response = await fetch("/api/classroom/delivery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stageId: input.stageId,
      stageName: cleanString(input.stageName),
      kind: record.kind,
      format: record.format,
      fileName: cleanString(record.fileName),
      publishedUrl: cleanString(record.publishedUrl),
      label: cleanString(record.label),
      createdAt: cleanString(record.createdAt),
      source: classroomMeta?.source,
      classId: cleanString(classroomMeta?.classId),
      className: cleanString(classroomMeta?.className),
      subject: cleanString(classroomMeta?.subject),
      grade: cleanString(classroomMeta?.grade),
      learningMode: classroomMeta?.learningMode,
      audienceMode: classroomMeta?.audienceMode,
      studentCount: classroomMeta?.studentCount,
      teacherId: cleanString(classroomMeta?.teacher?.id),
      teacherName: cleanString(
        classroomMeta?.teacher?.digitalHuman?.displayName || classroomMeta?.teacher?.name,
      ),
      learnerId: cleanString(classroomMeta?.learner?.id),
      learnerName: cleanString(classroomMeta?.learner?.name),
    }),
  });

  if (!response.ok) {
    let message = "课堂交付台账同步失败";
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      message = payload.error || payload.message || message;
    } catch {
      // Ignore JSON parse failure and keep fallback message.
    }
    throw new Error(message);
  }

  return response;
}
