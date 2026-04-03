import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createLearningRoute } from '@/lib/api/domains';
import { forbidden, unauthorized } from '@/lib/api/http';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import {
  buildClassroomAccessActor,
  buildRequestOrigin,
  canManageClassroom,
  canReadClassroom,
  isValidClassroomId,
  persistClassroom,
  readClassroom,
} from '@/lib/server/classroom-storage';
import type { Scene, Stage } from '@/lib/types/stage';

const CLASSROOM_EDITOR_ROLES = ['teacher', 'student', 'school_admin', 'admin'] as const;

export const POST = createLearningRoute({
  role: [...CLASSROOM_EDITOR_ROLES],
  handler: async ({ request, user }) => {
    let body: { stage?: Stage; scenes?: Scene[] };
    try {
      body = (await request.json()) as { stage?: Stage; scenes?: Scene[] };
    } catch {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid request body');
    }

    const { stage, scenes } = body;
    if (!stage || !scenes) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required fields: stage, scenes',
      );
    }

    const actor = buildClassroomAccessActor(user);
    if (!actor) {
      unauthorized();
    }

    const id = stage.id || randomUUID();
    if (!isValidClassroomId(id)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    const existing = await readClassroom(id);
    if (existing && !canManageClassroom(existing, actor)) {
      forbidden('classroom access denied');
    }

    const baseUrl = buildRequestOrigin(request);
    const persisted = await persistClassroom({ id, stage: { ...stage, id }, scenes }, baseUrl, {
      actor,
    });

    return apiSuccess({ id: persisted.id, url: persisted.url }, 201);
  },
});

export const GET = createLearningRoute({
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const audienceView = url.searchParams.get('audience') === '1';

    if (!id) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required parameter: id',
      );
    }

    if (!isValidClassroomId(id)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    const classroom = await readClassroom(id);
    if (!classroom) {
      return NextResponse.json(
        {
          success: false,
          classroom: null,
          errorCode: API_ERROR_CODES.INVALID_REQUEST,
          error: 'Classroom not found',
        },
        { status: 200 },
      );
    }

    const actor = buildClassroomAccessActor(await getCurrentUser());
    if (!canReadClassroom(classroom, { actor, audienceView })) {
      if (!audienceView && !actor) {
        unauthorized();
      }

      forbidden(
        audienceView
          ? 'classroom is not published for audience viewing'
          : 'classroom access denied',
      );
    }

    return apiSuccess({ classroom });
  },
});
