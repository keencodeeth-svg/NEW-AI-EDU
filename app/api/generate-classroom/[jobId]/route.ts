import { forbidden, unauthorized } from '@/lib/api/http';
import { createLearningRoute } from '@/lib/api/domains';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  canAccessClassroomGenerationJob,
  isValidClassroomJobId,
  readClassroomGenerationJob,
} from '@/lib/server/classroom-job-store';
import { buildClassroomAccessActor, buildRequestOrigin } from '@/lib/server/classroom-storage';

export const dynamic = 'force-dynamic';

const CLASSROOM_EDITOR_ROLES = ['teacher', 'student', 'school_admin', 'admin'] as const;

export const GET = createLearningRoute({
  role: [...CLASSROOM_EDITOR_ROLES],
  handler: async ({ request, params, user }) => {
    const { jobId } = params;

    if (!isValidClassroomJobId(jobId)) {
      return apiError('INVALID_REQUEST', 400, 'Invalid classroom generation job id');
    }

    const actor = buildClassroomAccessActor(user);
    if (!actor) {
      unauthorized();
    }

    const job = await readClassroomGenerationJob(jobId);
    if (!job) {
      return apiError('INVALID_REQUEST', 404, 'Classroom generation job not found');
    }

    if (!canAccessClassroomGenerationJob(job, actor)) {
      forbidden('classroom generation job access denied');
    }

    const pollUrl = `${buildRequestOrigin(request)}/api/generate-classroom/${jobId}`;

    return apiSuccess({
      jobId: job.id,
      status: job.status,
      step: job.step,
      progress: job.progress,
      message: job.message,
      pollUrl,
      pollIntervalMs: 5000,
      scenesGenerated: job.scenesGenerated,
      totalScenes: job.totalScenes,
      result: job.result,
      error: job.error,
      done: job.status === 'succeeded' || job.status === 'failed',
    });
  },
});
