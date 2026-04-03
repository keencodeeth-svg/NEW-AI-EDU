import { after } from 'next/server';
import { nanoid } from 'nanoid';
import { unauthorized } from '@/lib/api/http';
import { createLearningRoute } from '@/lib/api/domains';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import { runClassroomGenerationJob } from '@/lib/server/classroom-job-runner';
import { createClassroomGenerationJob } from '@/lib/server/classroom-job-store';
import { buildClassroomAccessActor, buildRequestOrigin } from '@/lib/server/classroom-storage';

export const maxDuration = 30;

const CLASSROOM_EDITOR_ROLES = ['teacher', 'student', 'school_admin', 'admin'] as const;

export const POST = createLearningRoute({
  role: [...CLASSROOM_EDITOR_ROLES],
  handler: async ({ request, user }) => {
    let rawBody: Partial<GenerateClassroomInput>;
    try {
      rawBody = (await request.json()) as Partial<GenerateClassroomInput>;
    } catch {
      return apiError('INVALID_REQUEST', 400, 'Invalid request body');
    }

    const body: GenerateClassroomInput = {
      requirement: rawBody.requirement || '',
      ...(rawBody.pdfContent ? { pdfContent: rawBody.pdfContent } : {}),
      ...(rawBody.language ? { language: rawBody.language } : {}),
      ...(rawBody.enableWebSearch != null ? { enableWebSearch: rawBody.enableWebSearch } : {}),
      ...(rawBody.enableImageGeneration != null
        ? { enableImageGeneration: rawBody.enableImageGeneration }
        : {}),
      ...(rawBody.enableVideoGeneration != null
        ? { enableVideoGeneration: rawBody.enableVideoGeneration }
        : {}),
      ...(rawBody.enableTTS != null ? { enableTTS: rawBody.enableTTS } : {}),
      ...(rawBody.agentMode ? { agentMode: rawBody.agentMode } : {}),
    };

    if (!body.requirement) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: requirement');
    }

    const actor = buildClassroomAccessActor(user);
    if (!actor) {
      unauthorized();
    }

    const baseUrl = buildRequestOrigin(request);
    const jobId = nanoid(10);
    const job = await createClassroomGenerationJob(jobId, body, actor);
    const pollUrl = `${baseUrl}/api/generate-classroom/${jobId}`;

    after(() => runClassroomGenerationJob(jobId, body, baseUrl, actor));

    return apiSuccess(
      {
        jobId,
        status: job.status,
        step: job.step,
        message: job.message,
        pollUrl,
        pollIntervalMs: 5000,
      },
      202,
    );
  },
});
